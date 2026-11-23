const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info('Conexión a la base de datos establecida con éxito');
    } catch (error) {
        logger.error(`Error al conectar a la base de datos: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;
