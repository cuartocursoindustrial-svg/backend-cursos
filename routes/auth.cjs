// auth.cjs
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

    // ✅ CREAR USUARIO primero
    const newUser = await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatarInicial: nombre.charAt(0).toUpperCase(),
      isVerified: false,
      verificationToken,
      verificationExpires
    });

    // ✅ ENVIAR EMAIL (manejo seguro - no bloquea si falla)
    try {
      const transporter = createTransporter();
      
      if (transporter) {
        const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        await transporter.sendMail({
          from: `"Academia" <${process.env.EMAIL_USER || "no-reply@academia.com"}>`,
          to: email,
          subject: "Verifica tu cuenta",
          html: `
            <h3>Hola ${nombre}</h3>
            <p>Verifica tu cuenta haciendo clic en el enlace:</p>
            <a href="${verificationUrl}">Verificar cuenta</a>
            <p>Este enlace caduca en 24 horas.</p>
          `
        });
        
        console.log(`✅ Email de verificación enviado a ${email}`);
      } else {
        console.warn(`⚠️  Email NO enviado a ${email} (transporter no disponible)`);
      }
    } catch (emailError) {
      // ✅ ERROR DE EMAIL NO AFECTA LA RESPUESTA
      console.error("❌ Error enviando email:", emailError.message);
      // Continuamos aunque falle el email
    }

    // ✅ SIEMPRE RESPONDEMOS ÉXITO (aunque falle el email)
    res.json({
      success: true,
      message: "Usuario registrado. Revisa tu email para verificar la cuenta."
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

    // ✅ ENVIAR EMAIL (manejo seguro)
    try {
      const transporter = createTransporter();
      
      if (transporter) {
        const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        await transporter.sendMail({
          from: `"Academia" <${process.env.EMAIL_USER || "no-reply@academia.com"}>`,
          to: email,
          subject: "Verifica tu cuenta",
          html: `
            <h3>Hola ${user.nombre}</h3>
            <p>Haz clic para verificar tu cuenta:</p>
            <a href="${verificationUrl}">Verificar cuenta</a>
          `
        });
        
        console.log(`✅ Email reenviado a ${email}`);
      } else {
        console.warn(`⚠️  Email NO reenviado a ${email} (transporter no disponible)`);
      }
    } catch (emailError) {
      console.error("❌ Error enviando email:", emailError.message);
      // Continuamos aunque falle el email
    }

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
// RESTABLECER CONTRASEÑA (OPCIONAL)
// =============================================
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email requerido" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      // Por seguridad, no revelamos si el email existe
      return res.json({
        success: true,
        message: "Si el email existe, recibirás instrucciones"
      });
    }

    // Generar token de restablecimiento
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hora

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // ✅ ENVIAR EMAIL (manejo seguro)
    try {
      const transporter = createTransporter();
      
      if (transporter) {
        const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        await transporter.sendMail({
          from: `"Academia" <${process.env.EMAIL_USER || "no-reply@academia.com"}>`,
          to: email,
          subject: "Restablecer contraseña",
          html: `
            <h3>Hola ${user.nombre}</h3>
            <p>Para restablecer tu contraseña, haz clic en el enlace:</p>
            <a href="${resetUrl}">Restablecer contraseña</a>
            <p>Este enlace caduca en 1 hora.</p>
          `
        });
        
        console.log(`✅ Email de restablecimiento enviado a ${email}`);
      } else {
        console.warn(`⚠️  Email NO enviado a ${email} (transporter no disponible)`);
      }
    } catch (emailError) {
      console.error("❌ Error enviando email de restablecimiento:", emailError.message);
    }

    res.json({
      success: true,
      message: "Si el email existe, recibirás instrucciones"
    });

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
