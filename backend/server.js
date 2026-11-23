require('dotenv').config();
const path = require('path');
const morgan = require('morgan');
const logger = require('./logger');
const express = require('express');
const cors = require('cors');
const userModel = require('./userModel');
const { authMiddleware, generateToken, deleteToken } = require('./authMiddleware');
const isAdminMiddleware = require('./adminMiddleware');
const connectDB = require('./database.js');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const { sendVerificationEmail } = require('./mailer');
const { verificarDominio } = require('./domainLogic.js');
const { HttpError } = require('./httpErrors');
const { escapeHtml, serializeForInlineScript } = require('./htmlUtils');
const { DiaryRepository } = require('./diaryModel');
const { createDiaryService } = require('./diaryService');
const { createDiaryRouter } = require('./diaryRouter');
const { DebateRepository } = require('./debateModel');
const { createDebateService } = require('./debateService');
const { createDebateRouter } = require('./debateRouter');
const { VeloRepository } = require('./veloTrackModel');
const { createVeloService } = require('./veloService');
const { createVeloRouter } = require('./veloRouter');
const { VinylRepository } = require('./vinylModel');
const { createArchivoService } = require('./archivoService');
const { createArchivoRouter } = require('./archivoRouter');

const app = express();
const PORT = process.env.PORT || 3000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const diaryService = createDiaryService({
    diaryRepository: DiaryRepository,
    userRepository: userModel,
    vinylRepository: VinylRepository,
    maxTextLength: process.env.DIARY_MAX_TEXT_LENGTH
});

const diaryRouter = createDiaryRouter({
    diaryService,
    authMiddleware
});

const debateService = createDebateService({
    debateRepository: DebateRepository,
    userRepository: userModel,
    vinylRepository: VinylRepository
});

const debateRouter = createDebateRouter({
    debateService,
    authMiddleware,
    adminMiddleware: isAdminMiddleware
});

const veloService = createVeloService({
    veloRepository: VeloRepository,
    userRepository: userModel,
    vinylRepository: VinylRepository
});

const veloRouter = createVeloRouter({
    veloService,
    authMiddleware,
    adminMiddleware: isAdminMiddleware
});

const archivoService = createArchivoService({
    vinylRepository: VinylRepository
});

const archivoRouter = createArchivoRouter({
    archivoService,
    authMiddleware
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

app.use(morgan('dev', {
    stream: { write: message => logger.info(message.trim()) }
}));

app.use(passport.initialize());

app.use('/api/diario', diaryRouter);
app.use('/api/debates', debateRouter);
app.use('/api/velo', veloRouter);
app.use('/api/archivo', archivoRouter);

if (googleOAuthConfigured) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const user = await userModel.loginConGoogle(email);
            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    }));
} else {
    logger.warn('Google OAuth no está configurado: faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET');
}

const requireGoogleOAuth = (options) => (req, res, next) => {
    if (!googleOAuthConfigured) {
        return res.status(503).json({ message: 'Google OAuth no está configurado' });
    }
    return passport.authenticate('google', options)(req, res, next);
};

app.get('/api/auth/google', requireGoogleOAuth({
    scope: ['profile', 'email'],
    session: false
}));

app.get('/api/auth/google/callback',
    requireGoogleOAuth({ failureRedirect: '/index.html', session: false }),
    (req, res) => {
        const token = generateToken({ email: req.user.email, role: req.user.role });
        const tokenLiteral = serializeForInlineScript(token);
        const emailLiteral = serializeForInlineScript(req.user.email);
        const roleLiteral = serializeForInlineScript(req.user.role);

        res.send(`
            <script>
                localStorage.setItem('token', ${tokenLiteral});
                localStorage.setItem('querencia_token', ${tokenLiteral});
                localStorage.setItem('querencia_user', JSON.stringify({ email: ${emailLiteral}, role: ${roleLiteral} }));
                window.location.href = '/muro.html';
            </script>
        `);
    }
);

app.post('/api/registro', async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ message: 'El correo y la contraseña son obligatorios' });
    }

    const normalizedEmail = email.trim();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return res.status(400).json({ message: 'El correo no tiene un formato válido' });
    }

    try {
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const nuevoUsuario = await userModel.create(normalizedEmail, password, verificationToken);

        try {
            await sendVerificationEmail(normalizedEmail, verificationToken);
        } catch (emailError) {
            logger.error(`No se pudo enviar el correo de verificación a ${normalizedEmail}: ${emailError.message}`);
            try {
                await userModel.delete(normalizedEmail);
            } catch (cleanupError) {
                logger.error(`No se pudo revertir el registro de ${normalizedEmail}: ${cleanupError.message}`);
            }
            return res.status(503).json({
                message: 'No se pudo enviar el correo de verificación. Inténtalo de nuevo en unos minutos.'
            });
        }

        res.status(201).json({
            message: 'Usuario registrado. Revisa tu correo para verificar la cuenta.',
            user: { email: nuevoUsuario.email, role: nuevoUsuario.role }
        });
    } catch (error) {
        if (error.code === 'EMAIL_ALREADY_REGISTERED') {
            return res.status(409).json({ message: error.message });
        }

        logger.error(`Error al registrar el usuario ${normalizedEmail}: ${error.stack || error.message}`);
        return res.status(500).json({ message: 'No se pudo completar el registro. Inténtalo de nuevo.' });
    }
});

app.get('/api/auth/verify/:token', async (req, res) => {
    try {
        await userModel.verifyUser(req.params.token);
        res.send(`
            <script>
                alert('¡Cuenta verificada con éxito en el tablao! Ya puedes iniciar sesión.');
                window.location.href = '/index.html';
            </script>
        `);
    } catch (error) {
        res.status(400).send(
            `<h2 style="color:red; text-align:center; margin-top:50px;">Error: ${escapeHtml(error.message)}</h2>`
        );
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    try {
        const usuario = await userModel.login(email.trim(), password);
        const token = generateToken({ email: usuario.email, role: usuario.role });

        res.status(200).json({
            message: 'Inicio de sesión correcto',
            token: token,
            user: { email: usuario.email, role: usuario.role }
        });
    } catch (error) {
        if (error.code === 'INVALID_CREDENTIALS' || error.code === 'EMAIL_NOT_VERIFIED') {
            return res.status(401).json({ message: error.message });
        }

        logger.error(`Error al iniciar sesión: ${error.stack || error.message}`);
        return res.status(500).json({ message: 'No se pudo iniciar sesión. Inténtalo de nuevo.' });
    }
});

app.post('/api/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        deleteToken(token);
    }
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
});

app.get('/api/session', authMiddleware, (req, res) => {
    res.status(200).json({
        authenticated: true,
        user: req.user
    });
});

app.get('/api/admin/dashboard', authMiddleware, isAdminMiddleware, (req, res) => {
    res.status(200).json({ message: 'Bienvenido al panel de administración', user: req.user });
});

app.delete('/api/users/:email', authMiddleware, isAdminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        await userModel.delete(email);
        res.status(200).json({ message: `Usuario ${email} eliminado correctamente por el administrador` });
    } catch (error) {
        if (error.code === 'USER_NOT_FOUND') {
            return res.status(404).json({ message: error.message });
        }

        logger.error(`Error al eliminar el usuario: ${error.stack || error.message}`);
        return res.status(500).json({ message: 'No se pudo eliminar el usuario.' });
    }
});

app.get('/api/users', authMiddleware, isAdminMiddleware, async (req, res) => {
    try {
        const users = await userModel.getAll();
        res.status(200).json(users);
    } catch (error) {
        logger.error(`Error al listar usuarios: ${error.stack || error.message}`);
        res.status(500).json({ message: 'No se pudo obtener la lista de usuarios.' });
    }
});

app.post('/api/prueba/dominio', (req, res) => {
    const { email } = req.body || {};

    if (email === undefined || typeof email !== 'string') {
        return res.status(400).json({ error: 'El campo email es obligatorio y debe ser texto.' });
    }

    if (!email.includes('@')) {
        return res.status(400).json({ error: 'El email debe contener un carácter @' });
    }

    const isPermitido = verificarDominio(email);
    return res.status(200).json({ permitido: isPermitido });
});

app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'Ruta no encontrada' });
    }
    return res.status(404).send('No encontrado');
});

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    const isClientError = Number.isInteger(error.status)
        && error.status >= 400
        && error.status < 500;
    const status = error instanceof HttpError
        ? error.status
        : (isClientError ? error.status : 500);
    const message = error instanceof HttpError
        ? error.message
        : (isClientError ? 'La petición no es válida' : 'Error interno del servidor');
    logger.error(`${req.method} ${req.originalUrl}: ${error.stack || error.message}`);

    if (req.path.startsWith('/api/')) {
        return res.status(status).json({ message });
    }
    return res.status(status).send(message);
});

const start = async () => {
    await connectDB();
    return app.listen(PORT, () => {
        logger.info(`Servidor corriendo en el puerto ${PORT}`);
    });
};

if (require.main === module) {
    start().catch((error) => {
        logger.error(`No se pudo iniciar el servidor: ${error.stack || error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    app,
    start
};
