// routes/auth.cjs - VERSIÓN MEJORADA
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User.cjs");
const Progress = require("../models/Progress.cjs");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";

// REGISTRO
router.post("/register", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatarInicial: nombre.charAt(0).toUpperCase()
    });

    // Crear token con más información
    const token = jwt.sign(
      { 
        email: user.email, 
        nombre: user.nombre, 
        userId: user._id.toString(),
        avatar: user.avatarInicial
      },
      JWT_SECRET,
      { expiresIn: "7d" } // Token válido por 7 días
    );

    res.json({ 
      success: true,
      mensaje: "Usuario registrado correctamente",
      token,
      usuario: {
        nombre: user.nombre,
        email: user.email,
        userId: user._id.toString(),
        avatar: user.avatarInicial,
        cursosComprados: user.cursosComprados
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    console.error("Error en registro:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // Actualizar último acceso
    user.ultimoAcceso = new Date();
    await user.save();

    const token = jwt.sign(
      { 
        email: user.email, 
        nombre: user.nombre, 
        userId: user._id.toString(),
        avatar: user.avatarInicial
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      mensaje: "Login correcto",
      token,
      usuario: {
        nombre: user.nombre,
        email: user.email,
        userId: user._id.toString(),
        avatar: user.avatarInicial,
        cursosComprados: user.cursosComprados,
        cursosCompletados: user.cursosCompletados
      }
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Middleware JWT (actualizado)
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

// PERFIL
router.get("/perfil", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      success: true,
      usuario: {
        nombre: user.nombre,
        email: user.email,
        userId: user._id.toString(),
        avatar: user.avatarInicial,
        cursosComprados: user.cursosComprados,
        cursosCompletados: user.cursosCompletados,
        fechaRegistro: user.fechaRegistro,
        ultimoAcceso: user.ultimoAcceso
      }
    });
  } catch (err) {
    console.error("Error en /perfil:", err);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

// AGREGAR CURSO COMPRADO
router.post("/agregar-curso", authMiddleware, async (req, res) => {
  const { cursoId } = req.body;

  if (!cursoId) {
    return res.status(400).json({ error: "ID de curso requerido" });
  }

  try {
    const user = await User.findById(req.user.userId);
    
    if (!user.cursosComprados.includes(cursoId)) {
      user.cursosComprados.push(cursoId);
      await user.save();
    }

    res.json({
      success: true,
      message: "Curso agregado a tu cuenta",
      cursosComprados: user.cursosComprados
    });
  } catch (err) {
    console.error("Error agregando curso:", err);
    res.status(500).json({ error: "Error al agregar curso" });
  }
});

// MARCAR CURSO COMO COMPLETADO
router.post("/completar-curso", authMiddleware, async (req, res) => {
  const { cursoId } = req.body;

  if (!cursoId) {
    return res.status(400).json({ error: "ID de curso requerido" });
  }

  try {
    const user = await User.findById(req.user.userId);
    
    // Verificar que el curso esté comprado
    if (!user.cursosComprados.includes(cursoId)) {
      return res.status(400).json({ error: "No tienes este curso comprado" });
    }

    if (!user.cursosCompletados.includes(cursoId)) {
      user.cursosCompletados.push(cursoId);
      await user.save();
    }

    res.json({
      success: true,
      message: "Curso marcado como completado",
      cursosCompletados: user.cursosCompletados
    });
  } catch (err) {
    console.error("Error completando curso:", err);
    res.status(500).json({ error: "Error al completar curso" });
  }
});

// FUNCIONES DE PROGRESO (ya existentes)
router.post("/progreso", authMiddleware, async (req, res) => {
  const { cursoId, leccionId } = req.body;

  if (!cursoId || !leccionId) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    let progreso = await Progress.findOne({
      userId: req.user.userId,
      cursoId
    });

    if (!progreso) {
      progreso = new Progress({
        userId: req.user.userId,
        cursoId,
        leccionesVistas: [leccionId],
        ultimaLeccion: leccionId
      });
    } else {
      if (!progreso.leccionesVistas.includes(leccionId)) {
        progreso.leccionesVistas.push(leccionId);
      }
      progreso.ultimaLeccion = leccionId;
    }

    await progreso.save();

    res.json({ 
      success: true,
      mensaje: "Progreso guardado",
      progreso
    });
  } catch (err) {
    console.error("Error guardando progreso:", err);
    res.status(500).json({ error: "Error al guardar progreso" });
  }
});

router.get("/progreso/:cursoId", authMiddleware, async (req, res) => {
  try {
    const { cursoId } = req.params;

    const progreso = await Progress.findOne({
      userId: req.user.userId,
      cursoId
    });

    if (!progreso) {
      return res.json({
        success: true,
        cursoId,
        leccionesVistas: [],
        ultimaLeccion: null
      });
    }

    res.json({
      success: true,
      cursoId: progreso.cursoId,
      leccionesVistas: progreso.leccionesVistas,
      ultimaLeccion: progreso.ultimaLeccion,
      totalLeccionesVistas: progreso.leccionesVistas.length
    });
  } catch (err) {
    console.error("Error leyendo progreso:", err);
    res.status(500).json({ error: "Error al obtener progreso" });
  }
});

module.exports = router;