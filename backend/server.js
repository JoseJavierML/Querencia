require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userModel = require('./userModel');
const { authMiddleware, generateToken, deleteToken } = require('./authMiddleware');
const isAdminMiddleware = require('./adminMiddleware');
const connectDB = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors());
app.use(express.json());

app.post('/api/registro', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'El correo y la contraseña son obligatorios' });
        }

        const nuevoUsuario = await userModel.create(email, password);
        
        res.status(201).json({ 
            message: 'Usuario registrado con éxito', 
            user: { email: nuevoUsuario.email, role: nuevoUsuario.role } 
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
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

app.get('/api/session', authMiddleware, (req, res) => {
    res.status(200).json({
        authenticated: true,
        user: req.user
    });
});

app.post('/api/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        deleteToken(token);
    }
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
});


app.get('/api/admin/dashboard', authMiddleware, isAdminMiddleware, (req, res) => {
    res.status(200).json({ message: 'Bienvenido al panel de administración', user: req.user });
});

app.delete('/api/users/:email', authMiddleware, isAdminMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        await userModel.deleteUser(email);
        res.status(200).json({ message: `Usuario ${email} eliminado correctamente por el administrador` });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.get('/api/users', authMiddleware, isAdminMiddleware, async (req, res) => {
    try {
        const users = await userModel.getUsers();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de Querencia corriendo en http://localhost:${PORT}`);
});