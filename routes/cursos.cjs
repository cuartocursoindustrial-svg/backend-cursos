// routes/cursos.cjs
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Curso = require("../models/Curso.cjs");
const Compra = require("../models/Compra.cjs");
const Usuario = require("../models/Usuario.cjs"); // ✅ Necesario para los nuevos endpoints

const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";

// Middleware de autenticación
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
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

// ==================== ENDPOINTS EXISTENTES ====================

// OBTENER TODOS LOS CURSOS (pública)
router.get("/", async (req, res) => {
  try {
    const cursos = await Curso.find({ activo: true }).sort({ id: 1 });
    res.json({
      success: true,
      total: cursos.length,
      cursos
    });
  } catch (error) {
    console.error("Error obteniendo cursos:", error);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// OBTENER CURSO POR ID (pública)
router.get("/:id", async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    
    const curso = await Curso.findOne({ 
      id: cursoId, 
      activo: true 
    });
    
    if (!curso) {
      return res.status(404).json({ 
        success: false, 
        error: "Curso no encontrado" 
      });
    }
    
    res.json({
      success: true,
      curso
    });
  } catch (error) {
    console.error("Error obteniendo curso:", error);
    res.status(500).json({ error: "Error al obtener curso" });
  }
});

// OBTENER CURSOS POR CATEGORÍA/AÑO
router.get("/categoria/:categoria", async (req, res) => {
  try {
    const categoria = req.params.categoria.toLowerCase();
    
    const cursos = await Curso.find({ 
      categoria: { $regex: new RegExp(categoria, "i") },
      activo: true 
    }).sort({ id: 1 });
    
    res.json({
      success: true,
      categoria: req.params.categoria,
      total: cursos.length,
      cursos
    });
  } catch (error) {
    console.error("Error filtrando cursos:", error);
    res.status(500).json({ error: "Error al filtrar cursos" });
  }
});

// OBTENER MIS CURSOS COMPRADOS (protegida)
router.get("/usuario/mis-cursos", authMiddleware, async (req, res) => {
  try {
    const compras = await Compra.find({ 
      usuarioId: req.user.userId,
      estado: 'completada'
    });
    
    if (compras.length === 0) {
      return res.json({
        success: true,
        total: 0,
        cursos: []
      });
    }
    
    const cursosIds = compras.map(compra => compra.cursoId);
    
    const misCursos = await Curso.find({
      id: { $in: cursosIds },
      activo: true
    }).sort({ id: 1 });
    
    res.json({
      success: true,
      total: misCursos.length,
      cursos: misCursos
    });
  } catch (error) {
    console.error("Error obteniendo mis cursos:", error);
    res.status(500).json({ error: "Error al obtener tus cursos" });
  }
});

// COMPRAR CURSO (protegida)
router.post("/comprar", authMiddleware, async (req, res) => {
  try {
    const { cursoId } = req.body;
    
    if (!cursoId) {
      return res.status(400).json({ 
        success: false, 
        error: "ID de curso requerido" 
      });
    }
    
    const curso = await Curso.findOne({ 
      id: cursoId, 
      activo: true 
    });
    
    if (!curso) {
      return res.status(404).json({ 
        success: false, 
        error: "Curso no encontrado" 
      });
    }
    
    const compraExistente = await Compra.findOne({
      usuarioId: req.user.userId,
      cursoId: cursoId
    });
    
    if (compraExistente) {
      return res.status(400).json({
        success: false,
        error: "Ya has comprado este curso"
      });
    }
    
    const nuevaCompra = await Compra.create({
      usuarioId: req.user.userId,
      cursoId: cursoId,
      precioPagado: curso.precio,
      estado: 'completada'
    });
    
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

// OBTENER DETALLES COMPLETOS DE CURSO (protegida)
router.get("/:id/detalles", authMiddleware, async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    
    const curso = await Curso.findOne({ 
      id: cursoId, 
      activo: true 
    });
    
    if (!curso) {
      return res.status(404).json({ 
        success: false, 
        error: "Curso no encontrado" 
      });
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
    
    res.json({
      success: true,
      curso: {
        ...curso.toObject(),
        progreso
      }
    });
  } catch (error) {
    console.error("Error obteniendo detalles:", error);
    res.status(500).json({ error: "Error al obtener detalles del curso" });
  }
});

// ==================== NUEVOS ENDPOINTS DE VERIFICACIÓN DE ACCESO ====================

// 1. Verificar acceso con token temporal (para enlaces de acceso directo)
router.post("/verificar-acceso-token", async (req, res) => {
  try {
    const { tokenAcceso, usuarioId, cursoId } = req.body;
    
    if (!tokenAcceso || !usuarioId || !cursoId) {
      return res.status(400).json({ 
        acceso: false, 
        error: "Datos incompletos" 
      });
    }
    
    // Verificar token temporal
    const decoded = jwt.verify(tokenAcceso, JWT_SECRET);
    
    // Validar que el token corresponda al usuario y curso
    if (decoded.usuarioId !== usuarioId || decoded.cursoId !== parseInt(cursoId)) {
      return res.status(403).json({ 
        acceso: false, 
        error: "Token inválido" 
      });
    }
    
    // Verificar que el token no haya expirado
    if (decoded.exp < Date.now() / 1000) {
      return res.status(403).json({ 
        acceso: false, 
        error: "Token expirado" 
      });
    }
    
    // Verificar que el usuario existe
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).json({ 
        acceso: false, 
        error: "Usuario no encontrado" 
      });
    }
    
    // Verificar que el usuario tiene acceso al curso
    const compra = await Compra.findOne({
      usuarioId: usuarioId,
      cursoId: parseInt(cursoId),
      estado: 'completada'
    });
    
    if (!compra) {
      return res.status(403).json({ 
        acceso: false, 
        error: "Usuario no tiene acceso a este curso" 
      });
    }
    
    // Generar nuevo token para la sesión (24 horas)
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
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        acceso: false, 
        error: "Token inválido" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        acceso: false, 
        error: "Token expirado" 
      });
    }
    
    res.status(500).json({ 
      acceso: false, 
      error: "Error del servidor" 
    });
  }
});

// 2. Verificar acceso con sesión actual (token JWT normal)
router.post("/verificar-acceso", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        acceso: false, 
        error: "No autorizado - Token requerido" 
      });
    }
    
    const { cursoId } = req.body;
    
    if (!cursoId) {
      return res.status(400).json({ 
        acceso: false, 
        error: "ID de curso requerido" 
      });
    }
    
    // Verificar token JWT
    const decoded = jwt.verify(authHeader, JWT_SECRET);
    
    // Buscar usuario
    const usuario = await Usuario.findById(decoded.userId);
    
    if (!usuario) {
      return res.status(404).json({ 
        acceso: false, 
        error: "Usuario no encontrado" 
      });
    }
    
    // Verificar acceso al curso
    const tieneAcceso = await Compra.findOne({
      usuarioId: decoded.userId,
      cursoId: parseInt(cursoId),
      estado: 'completada'
    });
    
    if (!tieneAcceso) {
      return res.status(403).json({ 
        acceso: false, 
        error: "No tienes acceso a este curso" 
      });
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
      return res.status(403).json({ 
        acceso: false, 
        error: "Token inválido" 
      });
    }
    
    res.status(500).json({ 
      acceso: false, 
      error: "Error del servidor" 
    });
  }
});

// 3. Registrar acceso al curso (para seguimiento)
router.post("/registrar-acceso", async (req, res) => {
  try {
    const { cursoId, usuarioId, timestamp } = req.body;
    
    if (!cursoId || !usuarioId) {
      return res.status(400).json({ 
        success: false, 
        error: "Datos incompletos" 
      });
    }
    
    // Aquí puedes implementar lógica para guardar en una colección de "Accesos"
    // Por ahora solo log para debugging
    console.log(`📚 Acceso registrado: 
      Usuario: ${usuarioId}
      Curso: ${cursoId}
      Fecha: ${timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}
    `);
    
    // TODO: En el futuro, guardar en una colección:
    // const acceso = await Acceso.create({ usuarioId, cursoId, timestamp });
    
    res.json({ 
      success: true,
      message: "Acceso registrado"
    });
    
  } catch (error) {
    console.error("Error registrando acceso:", error);
    res.status(500).json({ 
      success: false,
      error: "Error registrando acceso" 
    });
  }
});

// 4. Generar enlace de acceso temporal (protegido)
router.post("/generar-enlace-acceso", authMiddleware, async (req, res) => {
  try {
    const { cursoId } = req.body;
    
    if (!cursoId) {
      return res.status(400).json({ 
        success: false, 
        error: "ID de curso requerido" 
      });
    }
    
    // Verificar que el usuario tiene acceso al curso
    const compra = await Compra.findOne({
      usuarioId: req.user.userId,
      cursoId: parseInt(cursoId),
      estado: 'completada'
    });
    
    if (!compra) {
      return res.status(403).json({ 
        success: false, 
        error: "No tienes acceso a este curso" 
      });
    }
    
    // Generar token temporal (válido por 1 hora)
    const tokenTemporal = jwt.sign(
      { 
        usuarioId: req.user.userId,
        cursoId: parseInt(cursoId),
        tipo: 'acceso_temporal',
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Generar URL con token
    const baseUrl = process.env.FRONTEND_URL || 'https://academiaohara.blogspot.com';
    const urlAcceso = `${baseUrl}/curso.html?curso=${cursoId}&token=${tokenTemporal}&usuario=${req.user.userId}`;
    
    res.json({
      success: true,
      url: urlAcceso,
      token: tokenTemporal,
      expira: new Date(Date.now() + 3600000).toISOString(), // 1 hora
      mensaje: "Enlace generado. Válido por 1 hora."
    });
    
  } catch (error) {
    console.error("Error generando enlace:", error);
    res.status(500).json({ 
      success: false,
      error: "Error generando enlace de acceso" 
    });
  }
});

module.exports = router;
