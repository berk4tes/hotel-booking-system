const { createRemoteJWKSet, jwtVerify } = require("jose");

const JWKS = createRemoteJWKSet(
  new URL(process.env.SUPABASE_URL + "/auth/v1/.well-known/jwks.json")
);

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  const token = authHeader.substring(7);
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.substring(7);
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
  } catch (e) {
    req.user = null;
  }
  next();
}

function requireAdmin(req, res, next) {
  const role = req.user && req.user.app_metadata && req.user.app_metadata.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "Admin role required" });
  }
  next();
}

module.exports = { verifyToken, optionalVerifyToken, requireAdmin };
