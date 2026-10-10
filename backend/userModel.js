const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'usuario' },
    status: { type: String, default: 'pendiente' },
    verificationToken: { type: String } 
});

const User = mongoose.model('User', userSchema);

const UserModel = {
    create: async (email, password, verificationToken) => {
        const existe = await User.findOne({ email });
        if (existe) {
            throw new Error('El email ya está registrado');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({ 
            email, 
            password: hashedPassword, 
            verificationToken 
        });
        
        await newUser.save(); 
        return newUser;
    },

    verifyUser: async (token) => { 
        const user = await User.findOne({ verificationToken: token });
        if (!user) throw new Error('Token inválido o cuenta ya verificada');
        
        user.status = 'activo';
        user.verificationToken = undefined; 
        await user.save();
        return user;
    },

    loginConGoogle: async (email) => {
        let user = await User.findOne({ email });
        
        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-10);
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(randomPassword, saltRounds);

            user = new User({ 
                email, 
                password: hashedPassword, 
                role: 'usuario', 
                status: 'activo'
            });
            await user.save();
        }
        return user;
    },

    getAll: async () => {
        return await User.find({});
    },

    isActive: async (email) => {
        const user = await User.findOne({ email });
        return user ? user.status === 'activo' : false;
    },

    delete: async (email) => {
        const result = await User.deleteOne({ email });
        if (result.deletedCount === 0) {
            throw new Error('Usuario no encontrado');
        }
        return true;
    },

    login: async (email, plainPassword) => {
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('Credenciales incorrectas');
        }

        if (user.status === 'pendiente') {
            throw new Error('Debes verificar tu correo antes de entrar. Revisa tu bandeja de entrada.');
        }

        const isMatch = await bcrypt.compare(plainPassword, user.password);
        if (!isMatch) {
            throw new Error('Credenciales incorrectas');
        }

        return user;
    },

    reset: async () => {
        await User.deleteMany({});
    }
};

module.exports = UserModel;