// routes/cursos.cjs
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Curso = require("../models/Curso.cjs");
const Compra = require("../models/Compra.cjs"); // ✅ Nuevo modelo añadido

const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";

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

// OBTENER TODOS LOS CURSOS (pública) - ✅ Migrada a MongoDB
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

// OBTENER CURSO POR ID (pública) - ✅ Migrada a MongoDB
router.get("/:id", async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    
    // Buscar por ID numérico en MongoDB
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

// OBTENER CURSOS POR CATEGORÍA/AÑO - ✅ Migrada a MongoDB
router.get("/categoria/:categoria", async (req, res) => {
  try {
    const categoria = req.params.categoria.toLowerCase();
    
    // Buscar en MongoDB (insensible a mayúsculas/minúsculas)
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

// OBTENER MIS CURSOS COMPRADOS (protegida) - ✅ Migrada a MongoDB
router.get("/usuario/mis-cursos", authMiddleware, async (req, res) => {
  try {
    // 1. Obtener compras del usuario
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
    
    // 2. Extraer IDs de cursos
    const cursosIds = compras.map(compra => compra.cursoId);
    
    // 3. Buscar los cursos
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

// COMPRAR CURSO (protegida) - ✅ Migrada a MongoDB
router.post("/comprar", authMiddleware, async (req, res) => {
  try {
    const { cursoId } = req.body;
    
    if (!cursoId) {
      return res.status(400).json({ 
        success: false, 
        error: "ID de curso requerido" 
      });
    }
    
    // 1. Verificar que el curso existe
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
    
    // 2. Verificar que no lo haya comprado antes
try {
  const nuevaCompra = await Compra.create({
    usuarioId: req.user.userId,
    cursoId: cursoId,
    precioPagado: curso.precio,
    estado: 'completada'
  });

  return res.json({
    success: true,
    message: `Curso "${curso.titulo}" comprado exitosamente`,
    curso: curso,
    compraId: nuevaCompra._id,
    fechaCompra: nuevaCompra.fechaCompra
  });

} catch (error) {
  // 🔐 MongoDB bloqueó duplicado (usuarioId + cursoId)
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      error: "Ya has comprado este curso"
    });
  }

  console.error("Error comprando curso:", error);
  return res.status(500).json({ error: "Error al procesar la compra" });
} 
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

// OBTENER DETALLES COMPLETOS DE CURSO (protegida) - ✅ Migrada a MongoDB
router.get("/:id/detalles", authMiddleware, async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    
    // 1. Buscar curso
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
    
    // 2. Verificar si el usuario lo compró
    const compra = await Compra.findOne({
      usuarioId: req.user.userId,
      cursoId: cursoId,
      estado: 'completada'
    });
    
    // 3. Datos de progreso (simulado por ahora)
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

module.exports = router;
