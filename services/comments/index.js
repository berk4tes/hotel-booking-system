require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { getDb } = require("./db");
const { verifyToken } = require("./auth");

const app = express();
app.use(cors());
app.use(express.json());

const ratingKeys = ["cleanliness", "staff", "amenities", "location", "eco_friendly"];

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseHotelId(id) {
  const parsed = parseInt(id, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function normalizeComment(comment) {
  return {
    id: comment._id.toString(),
    hotel_id: comment.hotel_id,
    user_id: comment.user_id,
    user_email: comment.user_email,
    user_country: comment.user_country,
    ratings: comment.ratings,
    average_rating: comment.average_rating,
    text: comment.text,
    verified: comment.verified,
    date: comment.date,
    created_at: comment.created_at
  };
}

function validateRatings(ratings) {
  if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) {
    return "ratings is required";
  }

  for (const key of ratingKeys) {
    const value = ratings[key];
    if (typeof value !== "number" || value < 1 || value > 5) {
      return `${key} rating must be a number between 1 and 5`;
    }
  }

  return null;
}

function calculateAverageRating(ratings) {
  const total = ratingKeys.reduce((sum, key) => sum + ratings[key], 0);
  return parseFloat((total / ratingKeys.length).toFixed(2));
}

function sendServerError(res, error) {
  console.error("Comments service error:", error.code || error.name || "Error");
  res.status(500).json({ error: "Internal server error" });
}

app.get("/health", (req, res) => {
  res.json({ service: "comments", status: "ok" });
});

app.get("/api/v1/hotels/:id/comments", async (req, res) => {
  const hotelId = parseHotelId(req.params.id);
  if (!hotelId) {
    return res.status(400).json({ error: "Invalid hotel id" });
  }

  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 10);
  const offset = (page - 1) * limit;

  try {
    const db = await getDb();
    const collection = db.collection("comments");
    const filter = { hotel_id: hotelId };
    const [comments, total] = await Promise.all([
      collection.find(filter).sort({ date: -1 }).skip(offset).limit(limit).toArray(),
      collection.countDocuments(filter)
    ]);

    res.json({
      data: comments.map(normalizeComment),
      page,
      limit,
      total
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.get("/api/v1/hotels/:id/comments/summary", async (req, res) => {
  const hotelId = parseHotelId(req.params.id);
  if (!hotelId) {
    return res.status(400).json({ error: "Invalid hotel id" });
  }

  try {
    const db = await getDb();
    const [summary] = await db.collection("comments").aggregate([
      { $match: { hotel_id: hotelId } },
      {
        $project: {
          ratings: 1,
          average_overall: {
            $avg: ratingKeys.map((key) => `$ratings.${key}`)
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          average_overall: { $avg: "$average_overall" },
          average_cleanliness: { $avg: "$ratings.cleanliness" },
          average_staff: { $avg: "$ratings.staff" },
          average_amenities: { $avg: "$ratings.amenities" },
          average_location: { $avg: "$ratings.location" },
          average_eco_friendly: { $avg: "$ratings.eco_friendly" }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          average_overall: { $round: ["$average_overall", 2] },
          averages: {
            cleanliness: { $round: ["$average_cleanliness", 2] },
            staff: { $round: ["$average_staff", 2] },
            amenities: { $round: ["$average_amenities", 2] },
            location: { $round: ["$average_location", 2] },
            eco_friendly: { $round: ["$average_eco_friendly", 2] }
          }
        }
      }
    ]).toArray();

    res.json(summary || {
      total: 0,
      average_overall: null,
      averages: {
        cleanliness: null,
        staff: null,
        amenities: null,
        location: null,
        eco_friendly: null
      }
    });
  } catch (e) {
    sendServerError(res, e);
  }
});

app.post("/api/v1/hotels/:id/comments", verifyToken, async (req, res) => {
  const hotelId = parseHotelId(req.params.id);
  if (!hotelId) {
    return res.status(400).json({ error: "Invalid hotel id" });
  }

  const { ratings, text } = req.body;
  const ratingError = validateRatings(ratings);
  if (ratingError) {
    return res.status(400).json({ error: ratingError });
  }

  if (!text || typeof text !== "string" || text.trim().length < 3) {
    return res.status(400).json({ error: "text must be at least 3 characters" });
  }

  try {
    const db = await getDb();
    const now = new Date();
    const comment = {
      hotel_id: hotelId,
      user_id: req.user.sub,
      user_email: req.user.email,
      user_country: req.body.user_country || "Unknown",
      ratings,
      average_rating: calculateAverageRating(ratings),
      text: text.trim(),
      verified: true,
      date: now,
      created_at: now
    };

    const result = await db.collection("comments").insertOne(comment);
    res.status(201).json(normalizeComment({ ...comment, _id: result.insertedId }));
  } catch (e) {
    sendServerError(res, e);
  }
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log("Comments service running on port " + PORT);
});
