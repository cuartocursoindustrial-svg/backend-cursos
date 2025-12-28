// auth.cjs
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const User = require("../models/User.cjs");
const createTransporter = require("../config/mailer.cjs"); 
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

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
// REGISTRO (CON EMAIL)
// =============================================
// En el REGISTRO - mantener como está (envía email)
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

      // En la ruta de registro, MODIFICA la parte de email:
      try {
        console.log('📧 Intentando enviar email a:', email);
        console.log('🔗 FRONTEND_URL:', FRONTEND_URL);
        
        const transporter = createTransporter();
        console.log('📧 Transporter obtenido:', transporter ? '✅ Sí' : '❌ No');
        
        if (transporter) {
          const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
          console.log('🔗 URL de verificación:', verificationUrl);
          
          const mailOptions = {
            from: `"Academia" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Verifica tu cuenta",
            html: `<h3>Hola ${nombre}</h3><p>Verifica tu cuenta: <a href="${verificationUrl}">Click aquí</a></p>`
          };
          
          console.log('📨 Enviando email...');
          const info = await transporter.sendMail(mailOptions);
          console.log(`✅ Email enviado a ${email}, Message ID: ${info.messageId}`);
        } else {
          console.warn('⚠️  Transporter no disponible, email no enviado');
        }
      } catch (emailError) {
        console.error("❌ Error enviando email:", emailError.message);
        console.error("❌ Error completo:", emailError);
      }

    res.json({
      success: true,
      message: "Registro exitoso. Revisa tu email para verificar."
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    res.status(500).json({ error: "Error del servidor" });
  }
});

// =============================================
// LOGIN
// =============================================
// En LOGIN - verificar isVerified
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    // ✅ VERIFICAR SI EL EMAIL ESTÁ CONFIRMADO
    if (!user.isVerified) {
      return res.status(403).json({
        error: "Cuenta no verificada",
        needsVerification: true,  // ← Para el frontend
        message: "Revisa tu email para verificar la cuenta"
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
        email: user.email
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
