require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const MODEL = "gpt-4o-mini";

function sendServerError(res, error) {
  console.error("AI agent service error:", error.code || error.name || "Error");
  res.status(500).json({ error: "Internal server error" });
}

function getGatewayUrl() {
  if (!process.env.GATEWAY_URL) {
    throw new Error("GATEWAY_URL is required");
  }
  return process.env.GATEWAY_URL.replace(/\/$/, "");
}

function getOpenAIKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }
  return process.env.OPENAI_API_KEY;
}

function buildQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  return query.toString();
}

async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      body = { raw: text };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: body && body.error ? body.error : "Request failed",
        detail: body && body.detail ? body.detail : undefined
      };
    }

    return body;
  } catch (e) {
    return { ok: false, error: "Gateway request failed" };
  }
}

async function callOpenAI(messages, tools) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOpenAIKey()}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("OpenAI request failed");
    error.code = body.error && (body.error.code || body.error.type);
    throw error;
  }

  return body.choices[0].message;
}

const tools = [
  {
    type: "function",
    function: {
      name: "search_hotels",
      description: "Search available hotels by city, date range, and guest count.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
          guests: { type: "integer", minimum: 1 },
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1 }
        },
        required: ["start_date", "end_date", "guests"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_hotel_details",
      description: "Get hotel details and rooms by hotel id.",
      parameters: {
        type: "object",
        properties: {
          hotel_id: { type: "integer", minimum: 1 }
        },
        required: ["hotel_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_comments_summary",
      description: "Get review summary and category averages for a hotel.",
      parameters: {
        type: "object",
        properties: {
          hotel_id: { type: "integer", minimum: 1 }
        },
        required: ["hotel_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_hotel",
      description: "Create a hotel booking for the authenticated user.",
      parameters: {
        type: "object",
        properties: {
          room_id: { type: "integer", minimum: 1 },
          start_date: { type: "string", description: "YYYY-MM-DD" },
          end_date: { type: "string", description: "YYYY-MM-DD" },
          guests: { type: "integer", minimum: 1 }
        },
        required: ["room_id", "start_date", "end_date", "guests"]
      }
    }
  }
];

async function executeTool(name, args, authHeader) {
  const gatewayUrl = getGatewayUrl();

  if (name === "search_hotels") {
    const query = buildQuery({
      city: args.city,
      start_date: args.start_date,
      end_date: args.end_date,
      guests: args.guests,
      page: args.page || 1,
      limit: args.limit || 5
    });
    return requestJson(`${gatewayUrl}/api/v1/search/hotels/search?${query}`, {
      headers: authHeader ? { Authorization: authHeader } : {}
    });
  }

  if (name === "get_hotel_details") {
    return requestJson(`${gatewayUrl}/api/v1/search/hotels/${args.hotel_id}`);
  }

  if (name === "get_comments_summary") {
    return requestJson(`${gatewayUrl}/api/v1/comments/hotels/${args.hotel_id}/comments/summary`);
  }

  if (name === "book_hotel") {
    if (!authHeader) {
      return { ok: false, status: 401, error: "Booking requires Authorization header" };
    }

    return requestJson(`${gatewayUrl}/api/v1/bookings/bookings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: authHeader
      },
      body: JSON.stringify({
        room_id: args.room_id,
        start_date: args.start_date,
        end_date: args.end_date,
        guests: args.guests
      })
    });
  }

  return { ok: false, error: "Unknown tool" };
}

app.get("/health", (req, res) => {
  res.json({ service: "ai-agent", status: "ok" });
});

app.post("/api/v1/ai/chat", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const normalizedMessages = messages.map((message) => ({
    role: message.role,
    content: message.content
  }));

  if (normalizedMessages.some((message) => !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string")) {
    return res.status(400).json({ error: "messages must include role and content" });
  }

  const conversation = [
    {
      role: "system",
      content: "You are a helpful hotel booking assistant. Use tools for hotel availability, hotel details, review summaries, and bookings. Keep answers concise."
    },
    ...normalizedMessages
  ];

  try {
    const authHeader = req.headers.authorization;
    const firstMessage = await callOpenAI(conversation, tools);
    const toolCalls = firstMessage.tool_calls || [];
    const toolResults = [];

    if (toolCalls.length > 0) {
      conversation.push(firstMessage);

      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = await executeTool(toolCall.function.name, args, authHeader);
        const toolResult = {
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: args,
          result
        };
        toolResults.push(toolResult);
        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      const finalMessage = await callOpenAI(conversation, tools);
      return res.json({
        assistant_message: finalMessage.content || "",
        tool_calls: toolCalls.map((toolCall) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments || "{}")
        })),
        tool_results: toolResults
      });
    }

    res.json({
      assistant_message: firstMessage.content || "",
      tool_calls: [],
      tool_results: []
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log("AI agent service running on port " + PORT);
});
