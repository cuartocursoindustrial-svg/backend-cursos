const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User.cjs");
const createTransporter = require("../config/mailer.cjs");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET no definido");
}

/* ========================
   AUTH MIDDLEWARE
======================== */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token requerido" });

  const [, token] = authHeader.split(" ");
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

/* ========================
   REGISTRO 
======================== */
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");

    await User.create({
      nombre,
      email,
      password: hashed,
      isVerified: false,
      verificationToken: token,
      verificationExpires: Date.now() + 24 * 60 * 60 * 1000
    });
    
    const transporter = createTransporter();
    if (transporter && FRONTEND_URL) {
      await transporter.sendMail({
        to: email,
        subject: "Verifica tu cuenta",
        html: `<h3>Hola ${nombre},</h3>
               <p>Verifica tu cuenta: <a href="${FRONTEND_URL}/verify-email?token=${verificationToken}">Click aquí</a></p>`
      });
    }


    res.json({
      success: true,
      message: "Registro exitoso. Revisa tu email."
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email ya registrado" });
    }
    console.error(err);
    res.status(500).json({ error: "Error servidor" });
  }
});

/* ========================
   VERIFICAR EMAIL
======================== */
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

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

  res.json({ success: true, message: "Cuenta verificada correctamente" });
});

/* ========================
   LOGIN
======================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Credenciales incorrectas" });

  if (!user.isVerified) {
    return res.status(403).json({ error: "Cuenta no verificada" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Credenciales incorrectas" });

  const token = jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    success: true,
    token,
    usuario: {
      id: user._id,
      nombre: user.nombre,
      email: user.email
    }
  });
});

/* ========================
   PERFIL
======================== */
router.get("/perfil", authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.userId).select("-password");
  res.json({ success: true, usuario: user });
});

module.exports = router;
