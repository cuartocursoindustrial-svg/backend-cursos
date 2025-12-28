const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User.cjs");
const Progress = require("../models/Progress.cjs");
const createTransporter = require("../config/mailer.cjs");

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
// REGISTRO (ENVÍA EMAIL DE VERIFICACIÓN)
// =============================================
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatarInicial: nombre.charAt(0).toUpperCase(),
      isVerified: false,
      verificationToken,
      verificationExpires
    });

    const verificationUrl =
      `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: '"Academia" <no-reply@academia.com>',
      to: email,
      subject: "Verifica tu cuenta",
      html: `
        <h3>Hola ${nombre}</h3>
        <p>Verifica tu cuenta haciendo clic en el enlace:</p>
        <a href="${verificationUrl}">Verificar cuenta</a>
        <p>Este enlace caduca en 24 horas.</p>
      `
    });

    res.json({
      success: true,
      message: "Registro correcto. Revisa tu email para verificar la cuenta."
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
// VERIFICAR EMAIL
// =============================================
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Token requerido" });
  }

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: "Token inválido o expirado" });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Cuenta verificada correctamente"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error del servidor" });
  }
});

// =============================================
// REENVIAR VERIFICACIÓN
// =============================================
router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email requerido" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Cuenta ya verificada" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;

    user.verificationToken = verificationToken;
    user.verificationExpires = verificationExpires;
    await user.save();

    const verificationUrl =
      `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: '"Academia" <no-reply@academia.com>',
      to: email,
      subject: "Verifica tu cuenta",
      html: `
        <h3>Hola ${user.nombre}</h3>
        <p>Haz clic para verificar tu cuenta:</p>
        <a href="${verificationUrl}">Verificar cuenta</a>
      `
    });

    res.json({
      success: true,
      message: "Email de verificación reenviado"
    });

  } catch (err) {
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

    if (!user.isVerified) {
      return res.status(403).json({
        error: "Cuenta no verificada",
        needsVerification: true
      });
    }

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
  const user = await User.findById(req.user.userId).select("-password");

  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado" });
  }

  res.json({ success: true, usuario: user });
});

module.exports = router;
