const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendVerificationEmail = async (email, token) => {
    const baseUrl = typeof process.env.BACKEND_URL === 'string'
        ? process.env.BACKEND_URL.trim().replace(/\/+$/, '')
        : '';

    if (!baseUrl) {
        throw new Error('BACKEND_URL no está configurada: no se puede construir el enlace de verificación');
    }

    try {
        const urlConfirmacion = `${baseUrl}/api/auth/verify/${token}`;

        const mailOptions = {
            from: `"Querencia" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verifica tu cuenta en Querencia',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2>¡Bienvenido al Tablao de Querencia!</h2>
                    <p>Para poder entrar y escribir en tu diario, necesitamos verificar tu correo.</p>
                    <a href="${urlConfirmacion}" style="background-color: #d4af37; color: black; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verificar mi cuenta</a>
                    <p style="margin-top: 20px; font-size: 12px; color: gray;">Si el botón no funciona, copia y pega este enlace: ${urlConfirmacion}</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Correo de verificación enviado correctamente a: ${email}`);
        return info;

    } catch (error) {
        logger.error(`Nodemailer falló al enviar el correo a ${email}: ${error.message}`);
        throw new Error('Fallo en el servidor de correo. Inténtalo de nuevo más tarde.');
    }
};

module.exports = { sendVerificationEmail };
