const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;
const USER_PUBLIC_FIELDS = 'email role status createdAt';

const createCodedError = (message, code) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

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
            throw createCodedError('El email ya está registrado', 'EMAIL_ALREADY_REGISTERED');
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = new User({ 
            email, 
            password: hashedPassword, 
            verificationToken 
        });

        try {
            await newUser.save();
        } catch (error) {
            if (error && error.code === 11000) {
                throw createCodedError('El email ya está registrado', 'EMAIL_ALREADY_REGISTERED');
            }
            throw error;
        }
        return newUser;
    },

    verifyUser: async (token) => { 
        const user = await User.findOne({ verificationToken: token });
        if (!user) {
            throw createCodedError('Token inválido o cuenta ya verificada', 'INVALID_VERIFICATION_TOKEN');
        }
        
        user.status = 'activo';
        user.verificationToken = undefined; 
        await user.save();
        return user;
    },

    loginConGoogle: async (email) => {
        let user = await User.findOne({ email });
        
        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-10);
            const hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);

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

    findByEmail: async (email) => {
        return await User.findOne({ email });
    },

    getAll: async () => {
        return await User.find({}, USER_PUBLIC_FIELDS);
    },

    isActive: async (email) => {
        const user = await User.findOne({ email });
        return user ? user.status === 'activo' : false;
    },

    delete: async (email) => {
        const result = await User.deleteOne({ email });
        if (result.deletedCount === 0) {
            throw createCodedError('Usuario no encontrado', 'USER_NOT_FOUND');
        }
        return true;
    },

    login: async (email, plainPassword) => {
        const user = await User.findOne({ email });
        if (!user) {
            throw createCodedError('Credenciales incorrectas', 'INVALID_CREDENTIALS');
        }

        if (user.status === 'pendiente') {
            throw createCodedError(
                'Debes verificar tu correo antes de entrar. Revisa tu bandeja de entrada.',
                'EMAIL_NOT_VERIFIED'
            );
        }

        const isMatch = await bcrypt.compare(plainPassword, user.password);
        if (!isMatch) {
            throw createCodedError('Credenciales incorrectas', 'INVALID_CREDENTIALS');
        }

        return user;
    },

    reset: async () => {
        await User.deleteMany({});
    }
};

module.exports = UserModel;