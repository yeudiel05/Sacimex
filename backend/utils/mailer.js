// backend/utils/mailer.js
// Configuración SMTP centralizada — todas las rutas importan desde aquí.
// Las credenciales se leen desde backend/.env (nunca se suben al repositorio).

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false', // true por defecto (puerto 465)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }
});

/**
 * Envía un correo electrónico.
 * @param {string} destinatario   - Dirección de destino
 * @param {string} asunto         - Asunto del correo
 * @param {string} mensajeHTML    - Cuerpo en HTML
 */
async function enviarCorreo(destinatario, asunto, mensajeHTML) {
    if (!destinatario) return;
    const remitente = process.env.SMTP_FROM || `"Sacimex" <${process.env.SMTP_USER}>`;
    try {
        await transporter.sendMail({
            from:    remitente,
            to:      destinatario,
            subject: asunto,
            html:    mensajeHTML,
        });
        console.log(`[Mailer] Correo enviado a: ${destinatario}`);
    } catch (e) {
        console.error(`[Mailer] Error al enviar correo a ${destinatario}:`, e.message);
    }
}

module.exports = { transporter, enviarCorreo };