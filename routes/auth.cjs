// En auth.cjs - MODIFICA EL REGISTRO
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

    // ✅ ENVIAR EMAIL (manejo seguro)
    try {
      const transporter = createTransporter();
      
      if (transporter) {
        const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        await transporter.sendMail({
          from: `"Academia" <${process.env.EMAIL_USER}>`,
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
