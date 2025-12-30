// services/EmailService.cjs
const mailjet = require('node-mailjet').apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY
);

class EmailService {
  constructor() {
    this.senderEmail = process.env.MAILJET_SENDER_EMAIL;
    this.senderName = process.env.MAILJET_SENDER_NAME;
    this.frontendVerifyUrl = process.env.FRONTEND_VERIFY_URL;
  }

  async sendVerificationEmail(userEmail, userName, verificationToken) {
    try {
      const verificationLink = `${this.frontendVerifyUrl}?token=${verificationToken}`;
      
      const request = await mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: this.senderEmail,
                Name: this.senderName
              },
              To: [
                {
                  Email: userEmail,
                  Name: userName
                }
              ],
              Subject: "🎓 Verifica tu cuenta - Academia Ohara",
              HTMLPart: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                    <h1 style="margin: 0; font-size: 28px;">¡Bienvenido a Academia Ohara!</h1>
                    <p style="opacity: 0.9; margin-top: 10px;">Tu portal de aprendizaje en línea</p>
                  </div>
                  
                  <div style="padding: 30px; background: #f9f9f9;">
                    <h2 style="color: #333;">Hola ${userName},</h2>
                    <p style="color: #555; line-height: 1.6;">
                      Gracias por registrarte en Academia Ohara. Para comenzar a disfrutar de todos nuestros cursos, 
                      por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo.
                    </p>
                    
                    <div style="text-align: center; margin: 40px 0;">
                      <a href="${verificationLink}" 
                         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                color: white; 
                                padding: 15px 30px; 
                                text-decoration: none; 
                                border-radius: 5px; 
                                font-weight: bold;
                                font-size: 16px;
                                display: inline-block;">
                        ✅ Verificar mi correo
                      </a>
                    </div>
                    
                    <p style="color: #555; font-size: 14px;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                      <code style="background: #eee; padding: 5px 10px; border-radius: 3px; word-break: break-all; display: inline-block; margin-top: 5px;">
                        ${verificationLink}
                      </code>
                    </p>
                    
                    <div style="background: #fff3cd; border-left: 4px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 3px;">
                      <p style="margin: 0; color: #856404;">
                        ⏰ <strong>Importante:</strong> Este enlace expirará en 24 horas.
                      </p>
                    </div>
                    
                    <p style="color: #777; font-size: 14px; border-top: 1px solid #eee; padding-top: 20px;">
                      Si no te registraste en Academia Ohara, por favor ignora este correo.
                    </p>
                  </div>
                  
                  <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px;">
                    <p style="margin: 0;">
                      © ${new Date().getFullYear()} Academia Ohara. Todos los derechos reservados.<br>
                      Este es un correo automático, por favor no responder.
                    </p>
                  </div>
                </div>
              `,
              TextPart: `
¡Bienvenido a Academia Ohara!

Hola ${userName},

Gracias por registrarte en Academia Ohara. Para comenzar a disfrutar de todos nuestros cursos, por favor verifica tu dirección de correo electrónico.

Verifica tu correo aquí: ${verificationLink}

Este enlace expirará en 24 horas.

Si no te registraste en Academia Ohara, por favor ignora este correo.

Saludos,
El equipo de Academia Ohara
              `
            }
          ]
        });

      console.log('✅ Email de verificación enviado a:', userEmail);
      return { 
        success: true, 
        messageId: request.body.Messages[0].To[0].MessageID 
      };
    } catch (error) {
      console.error('❌ Error enviando email de verificación:', error.message);
      
      // Si Mailjet falla, al menos loguear el enlace para desarrollo
      if (process.env.NODE_ENV !== 'production') {
        const verificationLink = `${this.frontendVerifyUrl}?token=${verificationToken}`;
        console.log('🔗 Enlace de verificación (para desarrollo):', verificationLink);
      }
      
      throw new Error(`Error enviando email: ${error.message}`);
    }
  }
}

module.exports = new EmailService();