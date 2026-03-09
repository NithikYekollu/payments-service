const jwt = require("jsonwebtoken");
const { logger } = require("../utils/logger");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("JWT verification failed", { error: err.message });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { authMiddleware };
