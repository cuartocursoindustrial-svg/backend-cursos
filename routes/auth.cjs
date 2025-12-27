const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const User = require("../models/User.cjs");
const Progress = require("../models/Progress.cjs");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";

// =============================================
// CONFIGURACIÓN EMAIL
// =============================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// =============================================
// MIDDLEWARE DE AUTENTICACIÓN (SIN CAMBIOS)
// =============================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token de autorización requerido" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET);
    req.user = {
      userId: decoded.userId
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

// =============================================
// REGISTRO DE USUARIO (CON VERIFICACIÓN EMAIL)
// =============================================
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    // Verificar si ya existe
    const existente = await User.findOne({ email });
    if (existente) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔐 Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    // Crear usuario SIN verificar
    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatarInicial: nombre.charAt(0).toUpperCase(),
      isVerified: false,
      verificationToken,
      verificationExpires
    });

    // Enlace de verificación
    const verificationUrl =
      `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Enviar email
    await transporter.sendMail({
      from: '"Academia Ohara" <no-reply@academiaohara.com>',
      to: email,
      subject: "Verifica tu cuenta - Academia Ohara",
      html: `
        <h2>Hola ${nombre}</h2>
        <p>Gracias por registrarte en Academia Ohara.</p>
        <p>Haz clic en el siguiente enlace para verificar tu cuenta:</p>
        <a href="${verificationUrl}">Verificar mi cuenta</a>
        <p>Este enlace expira en 24 horas.</p>
      `
    });

    // ⚠️ NO se crea sesión
    res.status(201).json({
      success: true,
      requiresVerification: true,
      message: "Cuenta creada. Revisa tu correo para verificarla."
    });

  } catch (err) {
    console.error("Error en registro:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// =============================================
// LOGIN (SIN CAMBIOS POR AHORA)
// =============================================
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

    const token = jwt.sign(
      { userId: user._id.toString() },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token
    });
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// =============================================
// PERFIL, PROGRESO, ETC. (SIN CAMBIOS)
// =============================================

module.exports = router;
