require('dotenv').config();
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
const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use(morgan('dev', {
    stream: { write: message => logger.info(message.trim()) }
}));

app.use(passport.initialize());

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

app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/index.html', session: false }),
    (req, res) => {
        const token = generateToken({ email: req.user.email, role: req.user.role });
        
        res.send(`
            <script>
                localStorage.setItem('querencia_token', '${token}');
                localStorage.setItem('querencia_user', JSON.stringify({ email: '${req.user.email}', role: '${req.user.role}' }));
                window.location.href = '/diario.html';
            </script>
        `);
    }
);

app.post('/api/registro', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'El correo y la contraseña son obligatorios' });
        }

        const verificationToken = crypto.randomBytes(20).toString('hex');
        const nuevoUsuario = await userModel.create(email, password, verificationToken);

        sendVerificationEmail(email, verificationToken);

        res.status(201).json({ 
            message: 'Usuario registrado. Revisa tu correo para verificar la cuenta.', 
            user: { email: nuevoUsuario.email, role: nuevoUsuario.role } 
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
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
        res.status(400).send(`<h2 style="color:red; text-align:center; margin-top:50px;">Error: ${error.message}</h2>`);
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios' });
        }

        const usuario = await userModel.login(email, password);
        const token = generateToken({ email: usuario.email, role: usuario.role });

        res.status(200).json({ 
            message: 'Inicio de sesión correcto', 
            token: token,
            user: { email: usuario.email, role: usuario.role } 
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
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
        res.status(400).json({ message: error.message });
    }
});

app.get('/api/users', authMiddleware, isAdminMiddleware, async (req, res) => {
    try {
        const users = await userModel.getAll(); 
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.listen(PORT, () => {
    logger.info(`Servidor corriendo en el puerto ${PORT}`);
});