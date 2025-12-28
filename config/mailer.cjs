// config/mailer.cjs - VERSIÓN CORREGIDA
const Mailjet = require('node-mailjet');

console.log("📧 Inicializando Mailjet...");

// Verificar variables
const apiKey = process.env.MJ_APIKEY_PUBLIC;
const apiSecret = process.env.MJ_APIKEY_PRIVATE;

if (!apiKey || !apiSecret) {
  console.error("❌ ERROR: Variables de Mailjet no configuradas");
  console.log("MJ_APIKEY_PUBLIC:", apiKey ? "✓ Configurada" : "✗ Faltante");
  console.log("MJ_APIKEY_PRIVATE:", apiSecret ? "✓ Configurada" : "✗ Faltante");
}

module.exports = function createTransporter() {
  if (!apiKey || !apiSecret) {
    console.warn("⚠️ Mailjet no disponible - usando modo simulador");
    return {
      sendMail: async ({ to, subject, html }) => {
        console.log("📨 [SIMULADO] Email a:", to);
        console.log("📨 [SIMULADO] Asunto:", subject);
        return { success: true, simulated: true };
      }
    };
  }

  try {
    const client = Mailjet.apiConnect(apiKey, apiSecret);
    
    console.log("✅ Mailjet configurado correctamente");
    
    return {
      sendMail: async ({ to, subject, html }) => {
        try {
          console.log(`📤 Enviando email a: ${to}`);
          
          const request = client
            .post("send", { version: "v3.1" })
            .request({
              Messages: [
                {
                  From: {
                    Email: process.env.FROM_EMAIL || "noreply@academiaohara.com",
                    Name: process.env.FROM_NAME || "Academia Ohara"
                  },
                  To: [{ Email: to }],
                  Subject: subject,
                  HTMLPart: html,
                  TextPart: html.replace(/<[^>]*>/g, '') // Versión texto plano
                }
              ]
            });

          const response = await request;
          console.log(`✅ Email enviado a ${to}:`, response.body.Messages[0].Status);
          return response;
          
        } catch (err) {
          console.error("❌ Error enviando email:", err.message);
          console.error("Detalles:", err.statusCode, err.response?.body);
          throw err;
        }
      }
    };
    
  } catch (error) {
    console.error("❌ Error inicializando Mailjet:", error.message);
    return null;
  }
};
