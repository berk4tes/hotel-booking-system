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

function proxyOptions(target, rewritePath) {
  return {
    target,
    changeOrigin: true,
    pathRewrite: rewritePath,
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

app.use("/api/v1/admin", createProxyMiddleware(proxyOptions(services.admin, (path) => `/api/v1${path}`)));

app.use("/api/v1/search", createProxyMiddleware(proxyOptions(services.search, (path) => `/api/v1${path}`)));

app.use("/api/v1/bookings", createProxyMiddleware(proxyOptions(services.bookings, (path) => `/api/v1${path}`)));

app.use("/api/v1/comments", createProxyMiddleware(proxyOptions(services.comments, (path) => `/api/v1${path}`)));

app.use("/api/v1/ai", createProxyMiddleware(proxyOptions(services.ai, (path) => `/api/v1/ai${path}`)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Gateway service running on port " + PORT);
});
