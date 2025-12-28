// mailer.cjs - VERSIÓN ACTIVADA
const nodemailer = require("nodemailer");

module.exports = function createTransporter() {
  // Si no hay config de email, devuelve null (modo seguro)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️  Email no configurado. Usando modo sin verificación.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};
