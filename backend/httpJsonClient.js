const {
    ArchivoTimeoutError,
    ArchivoUpstreamError
} = require('./archivoErrors');

const createHttpJsonClient = ({ fetchImpl, timeoutMs }) => {
    const fetchWithTimeout = async (url, options = {}) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetchImpl(url, {
                ...options,
                signal: controller.signal
            });
        } catch (error) {
            if (error && (error.name === 'AbortError' || error.name === 'TimeoutError' || controller.signal.aborted)) {
                throw new ArchivoTimeoutError();
            }
            throw new ArchivoUpstreamError('No se pudo contactar con el servicio externo', { cause: error });
        } finally {
            clearTimeout(timer);
        }
    };

    const requestJson = async (url, headers, serviceName) => {
        const response = await fetchWithTimeout(url, { headers });

        if (!response || typeof response.ok !== 'boolean') {
            throw new ArchivoUpstreamError(`${serviceName} no devolvió una respuesta válida`);
        }
        if (!response.ok) {
            throw new ArchivoUpstreamError(`${serviceName} respondió con estado ${response.status}`);
        }

        try {
            return await response.json();
        } catch (error) {
            throw new ArchivoUpstreamError(`${serviceName} devolvió una respuesta JSON no válida`, { cause: error });
        }
    };

    return {
        fetchWithTimeout,
        requestJson
    };
};

module.exports = {
    createHttpJsonClient
};
