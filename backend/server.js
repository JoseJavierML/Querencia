const express = require('express');
const cors = require('cors');
const userModel = require('./userModel');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const activeSessions = new Map();

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
        
        const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        activeSessions.set(token, { email: usuario.email, role: usuario.role });

        res.status(200).json({ 
            message: 'Inicio de sesión correcto', 
            token: token,
            user: { email: usuario.email, role: usuario.role } 
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

app.get('/api/session', (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ authenticated: false, message: 'No se proporcionó token de sesión' });
    }

    const token = authHeader.split(' ')[1];
    const session = activeSessions.get(token);

    if (!session) {
        return res.status(401).json({ authenticated: false, message: 'Sesión inválida o expirada' });
    }

    res.status(200).json({
        authenticated: true,
        user: session
    });
});


app.post('/api/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        activeSessions.delete(token);
    }
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de Querencia corriendo en http://localhost:${PORT}`);
});