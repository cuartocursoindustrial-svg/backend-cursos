// mailer.cjs - CON CONEXIÓN MÁS SEGURA
const nodemailer = require("nodemailer");

console.log("📧 Inicializando mailer...");

module.exports = function createTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.warn("⚠️  Email no configurado (variables faltantes)");
    return null;
  }

  try {
    console.log("🔧 Creando transporter para:", emailUser);
    
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true para 465, false para otros puertos
      auth: {
        user: emailUser,
        pass: emailPass
      },
      connectionTimeout: 10000, // 10 segundos timeout
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    console.log("✅ Transporter creado");
    return transporter;

  } catch (error) {
    console.error("❌ Error creando transporter:", error.message);
    return null;
  }
};
