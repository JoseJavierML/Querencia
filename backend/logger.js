const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
    ),
    transports: [
        // Salida 1: Consola
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message }) => {
                    return `[${timestamp}] ${level}: ${message}`;
                })
            )
        }),
        // Salida 2: Archivo con todo el historial
        new transports.File({ filename: 'logs/app.log' }),
        // Salida 3: Archivo solo para errores
        new transports.File({ filename: 'logs/error.log', level: 'error' })
    ]
});

module.exports = logger;