// routes/auth.cjs - VERSIÓN CON VERIFICACIÓN
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User.cjs");
const Progress = require("../models/Progress.cjs");
const emailService = require("../services/EmailService.cjs"); // NUEVO

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";
const VERIFICATION_TOKEN_EXPIRY = '24h'; // 24 horas para verificar

// =============================================
// REGISTRO DE USUARIO CON VERIFICACIÓN
// =============================================
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generar token de verificación
    const verificationToken = jwt.sign(
      { email, purpose: 'email_verification' },
      JWT_SECRET,
      { expiresIn: VERIFICATION_TOKEN_EXPIRY }
    );

    const user = await User.create({
      nombre,
      email,
      password: hashedPassword,
      avatar: nombre.charAt(0).toUpperCase(),
      // Campos de verificación
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      verificationSentAt: new Date()
    });

    console.log('✅ Usuario creado (no verificado):', user._id);

    try {
      // Enviar email de verificación
      await emailService.sendVerificationEmail(email, nombre, verificationToken);
      console.log('✅ Email de verificación enviado a:', email);
    } catch (emailError) {
      console.error('⚠️ Error enviando email, pero usuario creado:', emailError.message);
      // Continuamos aunque falle el email, el usuario puede solicitar reenvío
    }

    // Crear token de sesión (pero con restricciones hasta verificación)
    const sessionTokenPayload = {
      email: user.email,
      nombre: user.nombre,
      userId: user._id.toString(),
      avatar: user.avatar,
      isVerified: false // IMPORTANTE: indicar que no está verificado
    };
    
    const sessionToken = jwt.sign(sessionTokenPayload, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ 
      success: true,
      mensaje: "Usuario registrado. Por favor verifica tu correo electrónico.",
      token: sessionToken,
      usuario: {
        nombre: user.nombre,
        email: user.email,
        userId: user._id.toString(),
        avatar: user.avatar,
        isVerified: false, // NUEVO
        cursosComprados: user.cursosComprados || [],
        cursosCompletados: user.cursosCompletados || []
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

// =============================================
// VERIFICAR EMAIL
// =============================================
router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Token de verificación requerido" });
  }

  try {
    // Verificar el token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.purpose !== 'email_verification') {
      return res.status(400).json({ error: "Token inválido" });
    }

    // Buscar usuario con este token
    const user = await User.findOne({ 
      email: decoded.email,
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() } // Token no expirado
    });

    if (!user) {
      return res.status(400).json({ 
        error: "Token inválido o expirado",
        code: "TOKEN_EXPIRED"
      });
    }

    // Marcar como verificado
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    console.log('✅ Email verificado para:', user.email);

    // Redireccionar a página de éxito en Blogger
    const bloggerSuccessUrl = `${process.env.BLOGGER_URL}/p/verification-success.html`;
    res.redirect(bloggerSuccessUrl);

  } catch (err) {
    console.error("Error en verificación:", err.message);
    
    if (err.name === 'TokenExpiredError') {
      const bloggerExpiredUrl = `${process.env.BLOGGER_URL}/p/verification-expired.html`;
      return res.redirect(bloggerExpiredUrl);
    }
    
    const bloggerErrorUrl = `${process.env.BLOGGER_URL}/p/verification-error.html`;
    res.redirect(bloggerErrorUrl);
  }
});

// =============================================
// REENVIAR EMAIL DE VERIFICACIÓN
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
      return res.status(400).json({ error: "El usuario ya está verificado" });
    }

    // Verificar si ya envió un email recientemente (evitar spam)
    const timeSinceLastEmail = user.verificationSentAt 
      ? Date.now() - user.verificationSentAt.getTime()
      : Infinity;
    
    if (timeSinceLastEmail < 5 * 60 * 1000) { // 5 minutos
      return res.status(429).json({ 
        error: "Espera 5 minutos antes de solicitar otro email" 
      });
    }

    // Generar nuevo token
    const verificationToken = jwt.sign(
      { email: user.email, purpose: 'email_verification' },
      JWT_SECRET,
      { expiresIn: VERIFICATION_TOKEN_EXPIRY }
    );

    // Actualizar usuario
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.verificationSentAt = new Date();
    await user.save();

    // Enviar email
    await emailService.sendVerificationEmail(user.email, user.nombre, verificationToken);

    res.json({ 
      success: true,
      message: "Email de verificación reenviado" 
    });

  } catch (err) {
    console.error("Error reenviando verificación:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// =============================================
// LOGIN ACTUALIZADO (verifica si el email está confirmado)
// =============================================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log('🔑 Intento de login para:', email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ Usuario no encontrado:', email);
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('❌ Contraseña incorrecta para:', email);
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // VERIFICAR SI EL EMAIL ESTÁ CONFIRMADO
    if (!user.isVerified) {
      console.log('⚠️ Usuario no verificado intentando login:', email);
      
      // Verificar si el token de verificación expiró
      const needsNewToken = !user.verificationToken || 
                           !user.verificationTokenExpires || 
                           user.verificationTokenExpires < new Date();
      
      if (needsNewToken) {
        // Generar nuevo token de verificación
        const verificationToken = jwt.sign(
          { email: user.email, purpose: 'email_verification' },
          JWT_SECRET,
          { expiresIn: VERIFICATION_TOKEN_EXPIRY }
        );
        
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.verificationSentAt = new Date();
        await user.save();
        
        // Enviar nuevo email
        await emailService.sendVerificationEmail(user.email, user.nombre, verificationToken);
      }

      return res.status(403).json({
        error: "Por favor verifica tu correo electrónico antes de iniciar sesión",
        code: "EMAIL_NOT_VERIFIED",
        needsVerification: true,
        email: user.email,
        message: "Revisa tu bandeja de entrada (y spam) para el enlace de verificación"
      });
    }

    // Actualizar último acceso
    user.ultimoAcceso = new Date();
    await user.save();

    // Crear token
    const tokenPayload = {
      email: user.email,
      nombre: user.nombre,
      userId: user._id.toString(),
      avatar: user.avatar,
      isVerified: true // NUEVO
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    console.log('✅ Login exitoso para:', email, 'Token creado');

    res.json({
      success: true,
      mensaje: "Login correcto",
      token,
      usuario: {
        nombre: user.nombre,
        email: user.email,
        userId: user._id.toString(),
        avatar: user.avatar,
        isVerified: true, // NUEVO
        cursosComprados: user.cursosComprados || [],
        cursosCompletados: user.cursosCompletados || []
      }
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// =============================================
// MIDDLEWARE PARA VERIFICAR EMAIL (opcional, para rutas protegidas)
// =============================================
function requireVerifiedEmail(req, res, next) {
  // Este middleware se puede usar en rutas que requieran email verificado
  if (!req.user.isVerified) {
    return res.status(403).json({
      error: "Email no verificado",
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Por favor verifica tu correo electrónico para acceder a esta función"
    });
  }
  next();
}


// ... (el resto de tus rutas existentes se mantienen igual) ...
// Solo añade esto al final, antes de module.exports:
