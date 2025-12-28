// auth.cjs
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User.cjs");
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// =============================================
// MIDDLEWARE AUTH
// =============================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// =============================================
// REGISTRO (SIN EMAIL TEMPORALMENTE)
// =============================================
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ CREAR USUARIO SIN VERIFICACIÓN POR EMAIL (por ahora)
    await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatarInicial: nombre.charAt(0).toUpperCase(),
      isVerified: true, // ← AUTO-VERIFICADO para pruebas
      verificationToken: undefined,
      verificationExpires: undefined
    });

    console.log(`✅ Usuario ${email} registrado (email desactivado)`);

    res.json({
      success: true,
      message: "Usuario registrado exitosamente"
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// =============================================
// LOGIN
// =============================================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // ✅ Como todos están auto-verificados, no checkeamos isVerified
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      usuario: {
        userId: user._id.toString(),
        nombre: user.nombre,
        email: user.email,
        cursosComprados: user.cursosComprados,
        cursosCompletados: user.cursosCompletados
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// =============================================
// PERFIL
// =============================================
router.get("/perfil", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// =============================================
// ACTUALIZAR PERFIL
// =============================================
router.put("/perfil", authMiddleware, async (req, res) => {
  try {
    const { nombre } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (nombre) {
      user.nombre = nombre;
      user.avatarInicial = nombre.charAt(0).toUpperCase();
    }

    await user.save();

    res.json({
      success: true,
      message: "Perfil actualizado",
      usuario: {
        userId: user._id.toString(),
        nombre: user.nombre,
        email: user.email,
        cursosComprados: user.cursosComprados,
        cursosCompletados: user.cursosCompletados
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

module.exports = router;
