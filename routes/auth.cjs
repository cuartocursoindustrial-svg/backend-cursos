// routes/auth.cjs - AGREGAR después del registro
const createTransporter = require("../config/mailer.cjs");

/* ========================
   REGISTRO CON EMAIL
======================== */
router.post("/registro", async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    // 1. Verificar si el email ya existe
    const existe = await User.findOne({ email });
    if (existe) {
      return res.status(409).json({ error: "Email ya registrado" });
    }

    // 2. Encriptar contraseña
    const hashed = await bcrypt.hash(password, 10);
    
    // 3. Crear token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // 4. Crear usuario (sin verificar inicialmente)
    const user = await User.create({
      nombre,
      email,
      password: hashed,
      isVerified: false,
      verificationToken,
      verificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
    });

    // 5. Enviar email de verificación
    const transporter = createTransporter();
    if (transporter) {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
      
      await transporter.sendMail({
        to: email,
        subject: "Verifica tu cuenta - Academia Ohara",
        html: `
          <h2>¡Bienvenido a Academia Ohara, ${nombre}!</h2>
          <p>Por favor verifica tu cuenta haciendo clic en el siguiente enlace:</p>
          <p><a href="${verificationUrl}" style="
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            display: inline-block;
          ">Verificar Cuenta</a></p>
          <p>O copia esta URL en tu navegador:</p>
          <p>${verificationUrl}</p>
          <p>Este enlace expira en 24 horas.</p>
          <br>
          <p>Saludos,<br>El equipo de Academia Ohara</p>
        `
      });
      
      console.log(`📧 Email de verificación enviado a: ${email}`);
    } else {
      console.warn("⚠️ No se pudo enviar email (transporter no disponible)");
    }

    // 6. Responder al frontend
    res.json({
      success: true,
      message: "Registro exitoso. Revisa tu email para verificar tu cuenta.",
      usuario: {
        id: user._id,
        nombre: user.nombre,
        email: user.email,
        isVerified: false
      }
    });

  } catch (err) {
    console.error("❌ Error en registro:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

/* ========================
   VERIFICAR EMAIL
======================== */
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Token requerido" });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        error: "Token inválido o expirado" 
      });
    }

    // Marcar como verificado
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    res.json({ 
      success: true, 
      message: "¡Cuenta verificada correctamente! Ya puedes iniciar sesión." 
    });

  } catch (error) {
    console.error("❌ Error verificando email:", error);
    res.status(500).json({ error: "Error verificando email" });
  }
});
