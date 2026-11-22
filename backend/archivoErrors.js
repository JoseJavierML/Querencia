class ArchivoValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ArchivoValidationError';
    }
}

class ArchivoNotFoundError extends Error {
    constructor(message = 'No se encontró el disco solicitado') {
        super(message);
        this.name = 'ArchivoNotFoundError';
    }
}

class ArchivoUpstreamError extends Error {
    constructor(message = 'No se pudo consultar un servicio externo', options = {}) {
        super(message, options);
        this.name = 'ArchivoUpstreamError';
    }
}

class ArchivoTimeoutError extends ArchivoUpstreamError {
    constructor(message = 'El servicio externo tardó demasiado en responder') {
        super(message);
        this.name = 'ArchivoTimeoutError';
    }
}

class ArchivoConfigurationError extends Error {
    constructor(message = 'El servicio externo no está configurado') {
        super(message);
        this.name = 'ArchivoConfigurationError';
    }
}

module.exports = {
    ArchivoValidationError,
    ArchivoNotFoundError,
    ArchivoUpstreamError,
    ArchivoTimeoutError,
    ArchivoConfigurationError
};
