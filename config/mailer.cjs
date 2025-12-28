// config/mailer.cjs
const Mailjet = require('node-mailjet');

console.log("📧 Inicializando Mailjet...");

module.exports = function createTransporter() {
  const apiKey = process.env.MJ_APIKEY_PUBLIC;
  const apiSecret = process.env.MJ_APIKEY_PRIVATE;
  const fromEmail = process.env.FROM_EMAIL || "noreply@academiaohara.com";
  const fromName = process.env.FROM_NAME || "Academia Ohara";

  if (!apiKey || !apiSecret) {
    console.warn("⚠️ Mailjet no configurado (variables faltantes)");
    return null;
  }

  const client = Mailjet.apiConnect(apiKey, apiSecret);

  return {
    sendMail: async ({ to, subject, html }) => {
      try {
        const request = client
          .post("send", { version: "v3.1" })
          .request({
            Messages: [
              {
                From: { Email: fromEmail, Name: fromName },
                To: [{ Email: to }],
                Subject: subject,
                HTMLPart: html
              }
            ]
          });

        const response = await request;
        console.log("✅ Email enviado a", to);
        return response;
      } catch (err) {
        console.error("❌ Error enviando email:", err.message);
        throw err;
      }
    }
  };
};

