const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'usuario' },
    status: { type: String, default: 'pendiente' }
});

const User = mongoose.model('User', userSchema);

const UserModel = {
    create: async (email, password, role = 'usuario', status = 'pendiente') => {
        const existe = await User.findOne({ email });
        if (existe) {
            throw new Error('El email ya está registrado');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = new User({ 
            email, 
            password: hashedPassword, 
            role, 
            status 
        });
        
        await newUser.save(); 
        return newUser;
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