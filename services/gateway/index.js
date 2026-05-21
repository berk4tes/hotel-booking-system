require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
app.use(cors());

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function proxyOptions(pathFilter, target, rewriteTo) {
  return {
    pathFilter,
    target,
    changeOrigin: true,
    pathRewrite: rewriteTo,
    on: {
      error: (err, req, res) => {
        console.error("Gateway proxy error:", err.code || err.name || "Error");
        if (!res.headersSent) {
          res.status(502).json({ error: "Bad gateway" });
        }
      }
    }
  };
}

const services = {
  admin: requiredEnv("ADMIN_SERVICE_URL"),
  search: requiredEnv("SEARCH_SERVICE_URL"),
  bookings: requiredEnv("BOOKING_SERVICE_URL"),
  comments: requiredEnv("COMMENTS_SERVICE_URL"),
  ai: requiredEnv("AI_AGENT_SERVICE_URL")
};

app.get("/health", (req, res) => {
  res.json({ service: "gateway", status: "ok", services });
});

app.use(createProxyMiddleware(proxyOptions("/api/v1/admin", services.admin, { "^/api/v1/admin": "/api/v1" })));

app.use(createProxyMiddleware(proxyOptions("/api/v1/search", services.search, { "^/api/v1/search": "/api/v1" })));

app.use(createProxyMiddleware(proxyOptions("/api/v1/bookings", services.bookings, { "^/api/v1/bookings": "/api/v1" })));

app.use(createProxyMiddleware(proxyOptions("/api/v1/comments", services.comments, { "^/api/v1/comments": "/api/v1" })));

app.use(createProxyMiddleware(proxyOptions("/api/v1/ai", services.ai, { "^/api/v1/ai": "/api/v1/ai" })));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Gateway service running on port " + PORT);
});
