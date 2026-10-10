const nodemailer = require('nodemailer');

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
    try {
        // En producción usará la URL de Render, en local localhost
        const baseUrl = process.env.BACKEND_URL || 'https://habitquest-t309.onrender.com';
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
        console.log('Correo de verificación enviado correctamente a:', email);
        return info;

    } catch (error) {
        console.error('CRÍTICO: Nodemailer falló al enviar el correo:', error);
        throw new Error('Fallo en el servidor de correo. Inténtalo de nuevo más tarde.');
    }
};

module.exports = { sendVerificationEmail };