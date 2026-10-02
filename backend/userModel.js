const bcrypt = require('bcrypt');

let users = [];

const UserModel = {
    create: async (email, password, role = 'usuario', status = 'pendiente') => {
        const existe = users.find(u => u.email === email);
        if (existe) {
            throw new Error('El email ya está registrado');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = { 
            email, 
            password: hashedPassword, 
            role, 
            status 
        };
        users.push(newUser);
        return newUser;
    },

    getAll: () => users,

    isActive: (email) => {
        const user = users.find(u => u.email === email);
        return user ? user.status === 'activo' : false;
    },

    delete: (email) => {
        const index = users.findIndex(u => u.email === email);
        if (index === -1) {
            throw new Error('Usuario no encontrado');
        }
        users.splice(index, 1);
        return true;
    },

    login: async (email, plainPassword) => {
        const user = users.find(u => u.email === email);
        if (!user) {
            throw new Error('Credenciales incorrectas');
        }

        const isMatch = await bcrypt.compare(plainPassword, user.password);
        if (!isMatch) {
            throw new Error('Credenciales incorrectas');
        }

        return user;
    },

    reset: () => { users = []; }
};

module.exports = UserModel;