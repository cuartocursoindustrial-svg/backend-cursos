// middlewares/auth.cjs
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: "Token de autorización requerido" });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = {
      userId: decoded.userId || decoded.id || decoded._id,
      email: decoded.email,
      nombre: decoded.nombre,
      avatar: decoded.avatar,
      isVerified: decoded.isVerified || false
    };
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(403).json({ error: "Token inválido" });
  }
}

module.exports = authMiddleware;
