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
// MIDDLEWARE DE AUTENTICACIÓN
// =============================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Formato Bearer inválido" });
  }

  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

// =============================================
// REGISTRO (CON VERIFICACIÓN EMAIL)
// =============================================
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const existe = await User.findOne({ email });
    if (existe) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatarInicial: nombre.charAt(0).toUpperCase(),
      isVerified: false,
      verificationToken,
      verificationExpires
    });

    const verificationUrl =
      `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await transporter.sendMail({
      from: '"Academia Ohara" <no-reply@academiaohara.com>',
      to: email,
      subject: "Verifica tu cuenta - Academia Ohara",
      html: `
        <h2>Hola ${nombre}</h2>
        <p>Gracias por registrarte.</p>
        <p>Haz clic para verificar tu cuenta:</p>
        <a href="${verificationUrl}">Verificar cuenta</a>
        <p>Este enlace expira en 24 horas.</p>
      `
    });

    res.status(201).json({
      success: true,
      requiresVerification: true,
      message: "Cuenta creada. Revisa tu correo."
    });

  } catch (err) {
    console.error("Error en registro:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// =============================================
// VERIFICAR EMAIL
// =============================================
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Token requerido");
  }

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send("Token inválido o expirado");
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    const jwtToken = jwt.sign(
      { userId: user._id.toString() },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/verification-success?token=${jwtToken}`
    );

  } catch (err) {
    console.error("Error verificando email:", err);
    res.status(500).send("Error del servidor");
  }
});

// =============================================
// LOGIN (BLOQUEA CUENTAS NO VERIFICADAS)
// =============================================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Cuenta no verificada" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    user.ultimoAcceso = new Date();
    await user.save();

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
    console.error("Error en login:", err);
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

    res.json({
      success: true,
      usuario: user
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

module.exports = router;
