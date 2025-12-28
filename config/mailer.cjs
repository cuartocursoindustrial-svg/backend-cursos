// mailer.cjs - VERSIÓN SIMPLIFICADA SIN CACHÉ
const nodemailer = require("nodemailer");

console.log('📧 Mailer inicializando...');

module.exports = function createTransporter() {
  console.log('🔍 Mailer - Verificando variables...');
  console.log('  EMAIL_USER:', process.env.EMAIL_USER ? '✅ (' + process.env.EMAIL_USER + ')' : '❌ No configurado');
  console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ (' + process.env.EMAIL_PASS.length + ' chars)' : '❌ No configurado');
  
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    console.warn('⚠️  Email no configurado. Skipping...');
    return null;
  }

  try {
    console.log('🔄 Creando transporter para:', emailUser);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });
    
    console.log('✅ Transporter creado exitosamente');
    return transporter;
    
  } catch (error) {
    console.error('❌ Error creando transporter:', error.message);
    return null;
  }
};
