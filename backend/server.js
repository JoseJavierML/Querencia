const express = require('express');
const cors = require('cors');
const userModel = require('./userModel');

const app = express();
const PORT = process.env.PORT || 3000;

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
        
        res.status(200).json({ 
            message: 'Inicio de sesión correcto', 
            user: { email: usuario.email, role: usuario.role } 
        });
    } catch (error) {
        res.status(401).json({ message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de Querencia corriendo en http://localhost:${PORT}`);
});