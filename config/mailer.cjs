// mailer.cjs
const nodemailer = require("nodemailer");

module.exports = function createTransporter() {
  // ✅ NO LANZAR ERROR durante la carga inicial
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  // Si no hay credenciales, devolvemos null PERO NO ERROR
  if (!emailUser || !emailPass) {
    console.warn("⚠️  Credenciales de email no configuradas. Los emails no se enviarán.");
    return null;
  }

  try {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
  } catch (error) {
    console.error("❌ Error creando transporter de email:", error.message);
    return null;
  }
};
