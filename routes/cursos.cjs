// routes/cursos.cjs - SOLO RUTAS PÚBLICAS
const express = require("express");
const Curso = require("../models/Curso.cjs");

const router = express.Router();

// GET todos los cursos
router.get("/", async (req, res) => {
  try {
    const cursos = await Curso.find({ activo: true })
      .select("_id id titulo categoria precio descripcion")
      .sort({ id: 1 });

    res.json({
      success: true,
      cursos: cursos
    });

  } catch (error) {
    console.error("❌ Error obteniendo cursos:", error);
    res.status(500).json({ error: "Error al obtener cursos" });
  }
});

// GET curso por ID numérico
router.get("/:id", async (req, res) => {
  try {
    const cursoId = parseInt(req.params.id);
    
    const curso = await Curso.findOne({ 
      id: cursoId,
      activo: true 
    });

    if (!curso) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    res.json({
      success: true,
      curso: curso
    });

  } catch (error) {
    console.error("❌ Error obteniendo curso:", error);
    res.status(500).json({ error: "Error al obtener curso" });
  }
});

module.exports = router;
