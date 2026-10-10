const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendVerificationEmail = async (email, token) => {
    const verificationLink = `http://localhost:3000/api/auth/verify/${token}`;

    const mailOptions = {
        from: `"Querencia" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verifica tu cuenta en Querencia',
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                <h1 style="color: #b89345;">¡Bienvenido al tablao!</h1>
                <p>Gracias por registrarte. Para activar tu cuenta, haz clic en el siguiente enlace:</p>
                <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #b89345; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
                    Verificar mi cuenta
                </a>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Correo de verificación enviado a ${email}`);
    } catch (error) {
        console.error('Error enviando el correo:', error);
    }
};

module.exports = { sendVerificationEmail };