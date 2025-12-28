// config/mailer.cjs
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
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });

    console.log("✅ Transporter listo");
    return transporter;
  } catch (err) {
    console.error("❌ Error creando transporter:", err.message);
    return null;
  }
};
