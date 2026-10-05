const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🟢 Conexión a la base de datos establecida con éxito');
    } catch (error) {
        console.error('🔴 Error al conectar a la base de datos:', error.message);
        process.exit(1); 
    }
};

module.exports = connectDB;