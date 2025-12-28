// mailer.cjs - CON GMAIL
const nodemailer = require("nodemailer");

// Cache del transporter
let cachedTransporter = null;

module.exports = function createTransporter() {
  if (cachedTransporter) return cachedTransporter;
  
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    console.warn("⚠️  Email no configurado. Los emails NO se enviarán.");
    return null;
  }

  try {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
    
    // Verificar que funciona
    cachedTransporter.verify((error) => {
      if (error) {
        console.error("❌ Error configuración email:", error.message);
        cachedTransporter = null;
      } else {
        console.log("✅ Servicio de email listo");
      }
    });
    
    return cachedTransporter;
  } catch (error) {
    console.error("❌ Error creando transporter:", error.message);
    return null;
  }
};
