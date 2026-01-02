const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Curso = require("../models/Curso.cjs");
const Compra = require("../models/Compra.cjs");
const Usuario = require("../models/User.cjs");

const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";

// ==================== MIDDLEWARE ====================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(authHeader, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Error en middleware JWT:", err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: "Token expirado" });
    }
    
    return res.status(403).json({ error: "Token inválido" });
  }
}

// ==================== RUTAS PÚBLICAS ====================

// OBTENER TODOS LOS CURSOS
router.get("/", async (req, res) => {
  try {
    const cursos = await Curso.find({ activo: true }).sort({ id: 1 });
    res.json({ success: true, total: cursos.length, cursos });
  } catch (error) {
    console.error("Error obteniendo cursos:", error);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// OBTENER CURSO POR ID
router.get("/:id", async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    const curso = await Curso.findOne({ id: cursoId, activo: true });
    
    if (!curso) {
      return res.status(404).json({ success: false, error: "Curso no encontrado" });
    }
    
    res.json({ success: true, curso });
  } catch (error) {
    console.error("Error obteniendo curso:", error);
    res.status(500).json({ error: "Error al obtener curso" });
  }
});

// OBTENER CURSOS POR CATEGORÍA
router.get("/categoria/:categoria", async (req, res) => {
  try {
    const categoria = req.params.categoria.toLowerCase();
    const cursos = await Curso.find({ 
      categoria: { $regex: new RegExp(categoria, "i") },
      activo: true 
    }).sort({ id: 1 });
    
    res.json({ success: true, categoria: req.params.categoria, total: cursos.length, cursos });
  } catch (error) {
    console.error("Error filtrando cursos:", error);
    res.status(500).json({ error: "Error al filtrar cursos" });
  }
});

// ==================== RUTAS PROTEGIDAS ====================

// MIS CURSOS COMPRADOS
router.get("/usuario/mis-cursos", authMiddleware, async (req, res) => {
  try {
    const compras = await Compra.find({ usuarioId: req.user.userId, estado: 'completada' });
    
    if (compras.length === 0) {
      return res.json({ success: true, total: 0, cursos: [] });
    }
    
    const cursosIds = compras.map(compra => compra.cursoId);
    const misCursos = await Curso.find({ id: { $in: cursosIds }, activo: true }).sort({ id: 1 });
    
    res.json({ success: true, total: misCursos.length, cursos: misCursos });
  } catch (error) {
    console.error("Error obteniendo mis cursos:", error);
    res.status(500).json({ error: "Error al obtener tus cursos" });
  }
});

// COMPRAR CURSO
router.post("/comprar", authMiddleware, async (req, res) => {
  try {
    const { cursoId } = req.body;
    
    if (!cursoId) {
      return res.status(400).json({ success: false, error: "ID de curso requerido" });
    }
    
    const curso = await Curso.findOne({ id: cursoId, activo: true });
    
    if (!curso) {
      return res.status(404).json({ success: false, error: "Curso no encontrado" });
    }
    
    const compraExistente = await Compra.findOne({ usuarioId: req.user.userId, cursoId: cursoId });
    
    if (compraExistente) {
      return res.status(400).json({ success: false, error: "Ya has comprado este curso" });
    }
    
    const nuevaCompra = await Compra.create({
      usuarioId: req.user.userId,
      cursoId: cursoId,
      precioPagado: curso.precio,
      estado: 'completada'
    });
    
    // ACTUALIZAR MODELO DE USUARIO CON EL CURSO COMPRADO
    await Usuario.findByIdAndUpdate(
      req.user.userId,
      { $addToSet: { cursosComprados: cursoId } }, // Usa $addToSet para evitar duplicados
      { new: true }
    );
    
    res.json({
      success: true,
      message: `Curso "${curso.titulo}" comprado exitosamente`,
      curso: curso,
      compraId: nuevaCompra._id,
      fechaCompra: nuevaCompra.fechaCompra
    });
  } catch (error) {
    console.error("Error comprando curso:", error);
    res.status(500).json({ error: "Error al procesar la compra" });
  }
});

// DETALLES COMPLETOS DE CURSO
router.get("/:id/detalles", authMiddleware, async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    const curso = await Curso.findOne({ id: cursoId, activo: true });
    
    if (!curso) {
      return res.status(404).json({ success: false, error: "Curso no encontrado" });
    }
    
    const compra = await Compra.findOne({
      usuarioId: req.user.userId,
      cursoId: cursoId,
      estado: 'completada'
    });
    
    const progreso = compra ? {
      porcentaje: 42,
      leccionesCompletadas: 2,
      totalLecciones: 4,
      ultimaLeccion: "Derivadas básicas",
      tieneAcceso: true
    } : {
      porcentaje: 0,
      leccionesCompletadas: 0,
      totalLecciones: 4,
      ultimaLeccion: null,
      tieneAcceso: false
    };
    
    res.json({ success: true, curso: { ...curso.toObject(), progreso } });
  } catch (error) {
    console.error("Error obteniendo detalles:", error);
    res.status(500).json({ error: "Error al obtener detalles del curso" });
  }
});

// ==================== VERIFICACIÓN DE ACCESO ====================

// 1. VERIFICAR ACCESO CON TOKEN TEMPORAL (Para enlaces directos)
router.post("/verificar-acceso-token", async (req, res) => {
  try {
    const { tokenAcceso, usuarioId, cursoId } = req.body;
    
    if (!tokenAcceso || !usuarioId || !cursoId) {
      return res.status(400).json({ acceso: false, error: "Datos incompletos" });
    }
    
    // Verificar token temporal
    const decoded = jwt.verify(tokenAcceso, JWT_SECRET);
    
    // Validaciones
    if (decoded.usuarioId !== usuarioId || decoded.cursoId !== parseInt(cursoId)) {
      return res.status(403).json({ acceso: false, error: "Token inválido" });
    }
    
    // Verificar usuario
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ acceso: false, error: "Usuario no encontrado" });
    }
    
    // Verificar acceso al curso
    const tieneAcceso = await Compra.findOne({
      usuarioId: usuarioId,
      cursoId: parseInt(cursoId),
      estado: 'completada'
    });
    
    if (!tieneAcceso) {
      return res.status(403).json({ acceso: false, error: "No tienes acceso a este curso" });
    }
    
    // Generar nuevo token JWT para sesión
    const nuevoToken = jwt.sign(
      { 
        userId: usuario._id.toString(),
        email: usuario.email,
        nombre: usuario.nombre || usuario.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      acceso: true,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre || usuario.email,
        email: usuario.email,
        token: nuevoToken
      }
    });
    
  } catch (error) {
    console.error("Error verificación token temporal:", error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ acceso: false, error: "Token expirado" });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ acceso: false, error: "Token inválido" });
    }
    
    res.status(500).json({ acceso: false, error: "Error del servidor" });
  }
});

// 2. VERIFICAR ACCESO CON SESIÓN ACTUAL
router.post("/verificar-acceso", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { cursoId } = req.body;
    
    if (!authHeader) {
      return res.status(401).json({ acceso: false, error: "No autorizado - Token requerido" });
    }
    
    if (!cursoId) {
      return res.status(400).json({ acceso: false, error: "ID de curso requerido" });
    }
    
    // Verificar token JWT
    const decoded = jwt.verify(authHeader, JWT_SECRET);
    
    // Buscar usuario
    const usuario = await Usuario.findById(decoded.userId);
    if (!usuario) {
      return res.status(404).json({ acceso: false, error: "Usuario no encontrado" });
    }
    
    // Verificar acceso al curso
    const tieneAcceso = await Compra.findOne({
      usuarioId: decoded.userId,
      cursoId: parseInt(cursoId),
      estado: 'completada'
    });
    
    if (!tieneAcceso) {
      return res.status(403).json({ acceso: false, error: "No tienes acceso a este curso" });
    }
    
    res.json({
      acceso: true,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre || usuario.email,
        email: usuario.email
      }
    });
    
  } catch (error) {
    console.error("Error verificación acceso:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ acceso: false, error: "Token inválido" });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ acceso: false, error: "Token expirado" });
    }
    
    res.status(500).json({ acceso: false, error: "Error del servidor" });
  }
});

// 3. REGISTRAR ACCESO AL CURSO (Para seguimiento)
router.post("/registrar-acceso", async (req, res) => {
  try {
    const { cursoId, usuarioId, timestamp, token } = req.body;
    
    if (!cursoId || !usuarioId) {
      return res.status(400).json({ success: false, error: "Datos incompletos" });
    }
    
    console.log(`📚 Acceso registrado: 
      Usuario: ${usuarioId}
      Curso: ${cursoId}
      Token: ${token ? token.substring(0, 20) + '...' : 'N/A'}
      Fecha: ${timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
    `);
    
    // Actualizar último acceso del usuario
    await Usuario.findByIdAndUpdate(usuarioId, { ultimoAcceso: new Date() });
    
    // Registrar en el log del usuario (si tu modelo User tiene accessLogs)
    try {
      await Usuario.findByIdAndUpdate(usuarioId, {
        $push: {
          accessLogs: {
            cursoId: cursoId,
            accessDate: new Date(),
            tokenUsed: token,
            ipAddress: req.ip
          }
        }
      });
    } catch (logError) {
      console.log("Nota: Campo accessLogs no disponible en User model");
    }
    
    res.json({ success: true, message: "Acceso registrado" });
  } catch (error) {
    console.error("Error registrando acceso:", error);
    res.status(500).json({ success: false, error: "Error registrando acceso" });
  }
});

// 4. GENERAR ENLACE DE ACCESO TEMPORAL
router.post("/generar-enlace-acceso", authMiddleware, async (req, res) => {
  try {
    const { cursoId } = req.body;
    
    if (!cursoId) {
      return res.status(400).json({ success: false, error: "ID de curso requerido" });
    }
    
    // Verificar que el usuario tiene acceso al curso
    const compra = await Compra.findOne({
      usuarioId: req.user.userId,
      cursoId: parseInt(cursoId),
      estado: 'completada'
    });
    
    if (!compra) {
      return res.status(403).json({ success: false, error: "No tienes acceso a este curso" });
    }
    
    // Generar token temporal (válido por 1 hora)
    const tokenTemporal = jwt.sign(
      { 
        usuarioId: req.user.userId,
        cursoId: parseInt(cursoId),
        tipo: 'acceso_temporal',
        timestamp: Date.now(),
        exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hora en segundos
      },
      JWT_SECRET
    );
    
    // Generar URL con token
    const baseUrl = process.env.FRONTEND_URL || 'https://academiaohara.blogspot.com';
    const urlAcceso = `${baseUrl}/algebra.html?token=${tokenTemporal}&usuario=${req.user.userId}&curso=${cursoId}`;
    
    res.json({
      success: true,
      url: urlAcceso,
      token: tokenTemporal,
      expira: new Date(Date.now() + 3600000).toISOString(), // 1 hora
      expiraEn: "1 hora",
      mensaje: "Enlace generado. Válido por 1 hora."
    });
    
  } catch (error) {
    console.error("Error generando enlace:", error);
    res.status(500).json({ success: false, error: "Error generando enlace de acceso" });
  }
});

// 5. VERIFICAR SI USUARIO TIENE ACCESO A CURSO (Método rápido)
router.get("/:cursoId/tiene-acceso", authMiddleware, async (req, res) => {
  try {
    const cursoId = parseInt(req.params.cursoId);
    
    const tieneAcceso = await Compra.findOne({
      usuarioId: req.user.userId,
      cursoId: cursoId,
      estado: 'completada'
    });
    
    res.json({
      success: true,
      tieneAcceso: !!tieneAcceso,
      cursoId: cursoId,
      usuarioId: req.user.userId
    });
  } catch (error) {
    console.error("Error verificando acceso:", error);
    res.status(500).json({ success: false, error: "Error verificando acceso" });
  }
});

module.exports = router;
