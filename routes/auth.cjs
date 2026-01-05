// routes/auth.cjs - VERSIÓN CORREGIDA Y COMPLETA
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User.cjs");
const Progress = require("../models/Progress.cjs");
const emailService = require("../services/EmailService.cjs");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "clave-super-secreta";
const VERIFICATION_TOKEN_EXPIRY = '24h';

// =============================================
// 1. MIDDLEWARE DE AUTENTICACIÓN
// =============================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  console.log('🔐 Headers recibidos:', req.headers);
  console.log('🔐 Authorization header:', authHeader);
  
  if (!authHeader) {
    console.log('❌ No hay header Authorization');
    return res.status(401).json({ error: "Token de autorización requerido" });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('❌ Formato de token inválido:', authHeader);
    return res.status(401).json({ error: "Formato de token inválido. Use: Bearer {token}" });
  }

  const token = parts[1];
  console.log('🔐 Token recibido:', token.substring(0, 20) + '...');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decodificado:', decoded);
    
    req.user = {
      userId: decoded.userId || decoded.id || decoded._id,
      email: decoded.email,
      nombre: decoded.nombre,
      avatar: decoded.avatar,
      isVerified: decoded.isVerified || false
    };
    
    console.log('✅ Usuario extraído:', req.user);
    next();
  } catch (err) {
    console.error("❌ Error JWT:", err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expirado" });
    }
    
    return res.status(403).json({ error: "Token inválido: " + err.message });
  }
}

// =============================================
// 2. MIDDLEWARE PARA EMAIL VERIFICADO
// =============================================
function requireVerifiedEmail(req, res, next) {
  if (!req.user.isVerified) {
    return res.status(403).json({
      error: "Email no verificado",
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Por favor verifica tu correo electrónico para acceder a esta función"
    });
  }
  next();
}

// =============================================
// 3. RUTAS PÚBLICAS (sin autenticación)
// =============================================

// REGISTRO DE USUARIO CON VERIFICACIÓN
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
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verificationSentAt: new Date()
    });

    console.log('✅ Usuario creado (no verificado):', user._id);

    try {
      // Enviar email de verificación
      await emailService.sendVerificationEmail(email, nombre, verificationToken);
      console.log('✅ Email de verificación enviado a:', email);
    } catch (emailError) {
      console.error('⚠️ Error enviando email, pero usuario creado:', emailError.message);
    }

    // Crear token de sesión
    const sessionTokenPayload = {
      email: user.email,
      nombre: user.nombre,
      userId: user._id.toString(),
      avatar: user.avatar,
      isVerified: false
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
        isVerified: false,
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

// VERIFICAR EMAIL (SÓLO UNA VERSIÓN - la más completa)
router.get("/verify-email", async (req, res) => {
  const { token, format } = req.query;

  console.log('🔐 [VERIFY-EMAIL] Token recibido:', token);
  console.log('🔐 [VERIFY-EMAIL] Formato solicitado:', format || 'html');

  if (!token) {
    if (format === 'json') {
      return res.status(400).json({ error: "Token de verificación requerido" });
    }
    console.log('❌ No hay token');
    return res.redirect(`${process.env.FRONTEND_URL || ''}/error?message=Token requerido`);
  }

  try {
    // Verificar el token JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decodificado:', decoded);
    
    if (decoded.purpose !== 'email_verification') {
      if (format === 'json') {
        return res.status(400).json({ 
          error: "Token inválido",
          invalidPurpose: true
        });
      }
      return res.redirect(`${process.env.FRONTEND_URL || ''}/error?message=Token inválido`);
    }

    // BUSCAR USUARIO DE 3 MANERAS:
    // 1. Primero buscar por token activo
    let user = await User.findOne({ 
      email: decoded.email,
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    });

    // 2. Si no, buscar por token (aunque esté expirado)
    if (!user) {
      user = await User.findOne({ 
        email: decoded.email,
        verificationToken: token
      });
      
      if (user) {
        console.log('⚠️ Token encontrado pero posiblemente expirado');
        
        // 3. VERIFICAR SI YA ESTÁ VERIFICADO
        if (user.isVerified) {
          console.log('✅ Usuario YA verificado anteriormente');
          
          if (format === 'json') {
            return res.status(200).json({
              success: true,
              alreadyVerified: true,
              message: "Tu cuenta ya estaba verificada anteriormente",
              usuario: {
                email: user.email,
                nombre: user.nombre,
                isVerified: true
              }
            });
          }
          
          return res.redirect(`${process.env.FRONTEND_URL || ''}/already-verified.html`);
        }
        
        // Token expirado y no verificado
        if (format === 'json') {
          return res.status(400).json({ 
            error: "El enlace de verificación ha expirado",
            expired: true,
            needsNewToken: true
          });
        }
        
        return res.redirect(`${process.env.FRONTEND_URL || ''}/verification-expired.html`);
      }
    }

    // 4. Si llegamos aquí, token no encontrado
    if (!user) {
      // ¿Quizás el usuario ya está verificado sin token?
      const verifiedUser = await User.findOne({ 
        email: decoded.email,
        isVerified: true
      });
      
      if (verifiedUser) {
        console.log('✅ Usuario ya verificado (sin token activo)');
        
        if (format === 'json') {
          return res.status(200).json({
            success: true,
            alreadyVerified: true,
            message: "Tu cuenta ya está verificada",
            usuario: {
              email: verifiedUser.email,
              nombre: verifiedUser.nombre
            }
          });
        }
        
        return res.redirect(`${process.env.FRONTEND_URL || ''}/already-verified.html`);
      }
      
      if (format === 'json') {
        return res.status(400).json({ 
          error: "Token inválido o usuario no encontrado",
          invalidToken: true
        });
      }
      
      return res.redirect(`${process.env.FRONTEND_URL || ''}/error?message=Token inválido`);
    }

    // 5. ¡TOKEN VÁLIDO! Marcar como verificado
    console.log('🔄 Actualizando usuario a verificado...');
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();
    
    console.log('✅ Email verificado para:', user.email);

    // 6. Respuesta según formato
    if (format === 'json') {
      return res.status(200).json({
        success: true,
        message: "¡Correo verificado exitosamente!",
        verified: true,
        usuario: {
          email: user.email,
          nombre: user.nombre,
          isVerified: true
        }
      });
    }
    
    // Redirección HTML por defecto
    const successUrl = `${process.env.FRONTEND_URL || process.env.BLOGGER_URL || ''}/verification-success.html`;
    console.log('🔗 Redirigiendo a:', successUrl);
    res.redirect(successUrl);

  } catch (err) {
    console.error("❌ Error completo:", err.message);
    
    // Manejar errores JWT específicos
    if (err.name === 'TokenExpiredError') {
      if (format === 'json') {
        return res.status(400).json({ 
          error: "El enlace de verificación ha expirado",
          expired: true,
          needsNewToken: true
        });
      }
      return res.redirect(`${process.env.FRONTEND_URL || ''}/verification-expired.html`);
    }
    
    if (err.name === 'JsonWebTokenError') {
      if (format === 'json') {
        return res.status(400).json({ 
          error: "Token de verificación inválido",
          invalidToken: true
        });
      }
      return res.redirect(`${process.env.FRONTEND_URL || ''}/error?message=Token inválido`);
    }
    
    // Error genérico
    if (format === 'json') {
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: err.message
      });
    }
    
    const errorUrl = `${process.env.FRONTEND_URL || ''}/verification-error.html`;
    res.redirect(errorUrl);
  }
});

// REENVIAR EMAIL DE VERIFICACIÓN
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

    // Verificar si ya envió un email recientemente
    const timeSinceLastEmail = user.verificationSentAt 
      ? Date.now() - user.verificationSentAt.getTime()
      : Infinity;
    
    if (timeSinceLastEmail < 5 * 60 * 1000) {
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

// LOGIN
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
      
      const needsNewToken = !user.verificationToken || 
                           !user.verificationTokenExpires || 
                           user.verificationTokenExpires < new Date();
      
      if (needsNewToken) {
        const verificationToken = jwt.sign(
          { email: user.email, purpose: 'email_verification' },
          JWT_SECRET,
          { expiresIn: VERIFICATION_TOKEN_EXPIRY }
        );
        
        user.verificationToken = verificationToken;
        user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        user.verificationSentAt = new Date();
        await user.save();
        
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
      isVerified: true
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
        isVerified: true,
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
// 4. RUTAS PROTEGIDAS (requieren autenticación)
// =============================================

// VERIFICAR ESTADO DE VERIFICACIÓN
router.get("/check-verification", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('isVerified email');
    
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      success: true,
      isVerified: user.isVerified,
      email: user.email,
      needsVerification: !user.isVerified
    });
  } catch (err) {
    console.error("Error verificando estado:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// PERFIL DEL USUARIO (solo autenticación)
router.get("/perfil", authMiddleware, async (req, res) => {
  console.log('📋 Solicitando perfil para userId:', req.user.userId);
  
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
    
    if (!user) {
      console.log('❌ Usuario no encontrado en BD:', req.user.userId);
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log('✅ Perfil encontrado:', user.email, 'Cursos:', user.cursosComprados.length);

    res.json({
      success: true,
      usuario: {
        nombre: user.nombre,
        email: user.email,
        userId: user._id.toString(),
        avatar: user.avatar,
        cursosComprados: user.cursosComprados || [],
        cursosCompletados: user.cursosCompletados || [],
        fechaRegistro: user.fechaRegistro,
        ultimoAcceso: user.ultimoAcceso
      }
    });
  } catch (err) {
    console.error("❌ Error en /perfil:", err);
    res.status(500).json({ error: "Error al obtener perfil" });
  }
});

// AGREGAR CURSO COMPRADO (requiere email verificado)
router.post("/agregar-curso", authMiddleware, requireVerifiedEmail, async (req, res) => {
  const { cursoId } = req.body;
  
  console.log('🛒 Agregando curso:', {
    userId: req.user.userId,
    cursoId: cursoId
  });

  if (!cursoId) {
    return res.status(400).json({ error: "ID de curso requerido" });
  }

  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar si el curso ya está comprado
    if (user.cursosComprados.includes(cursoId)) {
      console.log('ℹ️ Curso ya comprado:', cursoId);
      return res.json({
        success: true,
        message: "Ya tienes este curso comprado",
        cursosComprados: user.cursosComprados
      });
    }

    // Agregar el curso
    user.cursosComprados.push(cursoId);
    await user.save();
    
    console.log('✅ Curso agregado exitosamente. Total cursos:', user.cursosComprados.length);

    res.json({
      success: true,
      message: "Curso agregado a tu cuenta",
      cursosComprados: user.cursosComprados,
      totalCursos: user.cursosComprados.length
    });
  } catch (err) {
    console.error("❌ Error agregando curso:", err);
    res.status(500).json({ error: "Error al agregar curso" });
  }
});

// MARCAR CURSO COMO COMPLETADO (requiere email verificado)
router.post("/completar-curso", authMiddleware, requireVerifiedEmail, async (req, res) => {
  const { cursoId } = req.body;

  if (!cursoId) {
    return res.status(400).json({ error: "ID de curso requerido" });
  }

  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Verificar que el curso esté comprado
    if (!user.cursosComprados.includes(cursoId)) {
      return res.status(400).json({ error: "No tienes este curso comprado" });
    }

    // Verificar si ya está completado
    if (user.cursosCompletados.includes(cursoId)) {
      return res.json({
        success: true,
        message: "El curso ya estaba marcado como completado",
        cursosCompletados: user.cursosCompletados
      });
    }

    // Agregar a completados
    user.cursosCompletados.push(cursoId);
    await user.save();

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

// FUNCIONES DE PROGRESO (requieren email verificado)
router.post("/progreso", authMiddleware, requireVerifiedEmail, async (req, res) => {
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

router.get("/progreso/:cursoId", authMiddleware, requireVerifiedEmail, async (req, res) => {
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

// =============================================
// 5. RUTAS DE DESARROLLO (solo en dev)
// =============================================

if (process.env.NODE_ENV !== 'production') {
  router.post("/test-email", async (req, res) => {
    const { email, nombre } = req.body;
    
    if (!email || !nombre) {
      return res.status(400).json({ error: "Email y nombre requeridos" });
    }
    
    try {
      const testToken = jwt.sign(
        { email, purpose: 'test' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      await emailService.sendVerificationEmail(email, nombre, testToken);
      res.json({ success: true, message: "Email de prueba enviado" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// RUTA DE PRUEBA
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "API de autenticación funcionando",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /api/auth/registro",
      "POST /api/auth/login", 
      "GET /api/auth/perfil",
      "POST /api/auth/agregar-curso",
      "POST /api/auth/completar-curso"
    ]
  });
});

// =============================================
// 6. EXPORTACIONES
// =============================================
module.exports = {
  router,
  authMiddleware,       // Para usar en otros archivos
  requireVerifiedEmail  // Para usar en otros archivos
};
