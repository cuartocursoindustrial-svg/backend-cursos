// routes/cursos.cjs - VERSIÓN CORREGIDA Y SIMPLIFICADA
const express = require("express");
const Curso = require("../models/Curso.cjs");

const router = express.Router();

// =============================================
// OBTENER TODOS LOS CURSOS (pública)
// =============================================
router.get("/", async (req, res) => {
  try {
    console.log('📚 Solicitando todos los cursos...');
    
    // ✅ INCLUIR TODOS LOS CAMPOS IMPORTANTES, ESPECIALMENTE 'titulo'
    const cursos = await Curso.find({ activo: true })
      .select('_id id titulo categoria precio descripcion contenido temas') // ← ¡'titulo' incluido!
      .sort({ categoria: 1, id: 1 });
    
    console.log(`✅ ${cursos.length} cursos encontrados`);
    
    res.json({
      success: true,
      total: cursos.length,
      cursos: cursos
    });
    
  } catch (error) {
    console.error("❌ Error obteniendo cursos:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al obtener cursos" 
    });
  }
});

// =============================================
// OBTENER CURSO POR ID (pública)
// =============================================
router.get("/:id", async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    console.log(`🔍 Buscando curso ID: ${cursoId}`);
    
    const curso = await Curso.findOne({ 
      id: cursoId, 
      activo: true 
    }).select('_id id titulo categoria precio descripcion contenido temas');
    
    if (!curso) {
      return res.status(404).json({ 
        success: false, 
        error: "Curso no encontrado" 
      });
    }
    
    res.json({
      success: true,
      curso: curso
    });
    
  } catch (error) {
    console.error("❌ Error obteniendo curso:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al obtener curso" 
    });
  }
});

// =============================================
// OBTENER CURSOS POR CATEGORÍA/AÑO (pública)
// =============================================
router.get("/categoria/:categoria", async (req, res) => {
  try {
    const categoria = req.params.categoria;
    console.log(`📂 Filtrando por categoría: ${categoria}`);
    
    const cursos = await Curso.find({ 
      categoria: { $regex: new RegExp(categoria, "i") },
      activo: true 
    })
    .select('_id id titulo categoria precio descripcion contenido temas')
    .sort({ id: 1 });
    
    res.json({
      success: true,
      categoria: categoria,
      total: cursos.length,
      cursos: cursos
    });
    
  } catch (error) {
    console.error("❌ Error filtrando cursos:", error);
    res.status(500).json({ 
      success: false,
      error: "Error al filtrar cursos" 
    });
  }
});

// =============================================
// RUTA DE PRUEBA/DEBUG
// =============================================
router.get("/debug/estructura", async (req, res) => {
  try {
    // Obtener primer curso para ver estructura
    const primerCurso = await Curso.findOne({ activo: true });
    
    if (!primerCurso) {
      return res.json({
        success: true,
        message: "No hay cursos en la base de datos"
      });
    }
    
    res.json({
      success: true,
      estructura: {
        campos: Object.keys(primerCurso.toObject()),
        ejemplo: {
          _id: primerCurso._id,
          id: primerCurso.id,
          titulo: primerCurso.titulo,
          categoria: primerCurso.categoria,
          precio: primerCurso.precio,
          descripcion: primerCurso.descripcion.substring(0, 50) + "..."
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Error en debug:", error);
    res.status(500).json({ 
      success: false,
      error: "Error en debug" 
    });
  }
});

// =============================================
// NO INCLUIR ESTAS RUTAS (ya están en auth.cjs):
// - /usuario/mis-cursos    → Usa /api/auth/perfil
// - /comprar               → Usa /api/auth/agregar-curso
// - /:id/detalles          → No necesaria
// =============================================

module.exports = router;
