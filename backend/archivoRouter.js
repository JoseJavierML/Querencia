const express = require('express');
const {
    ArchivoValidationError,
    ArchivoNotFoundError,
    ArchivoUpstreamError,
    ArchivoTimeoutError,
    ArchivoConfigurationError
} = require('./archivoService');

const respondWithError = (res, error, fallbackMessage) => {
    if (error instanceof ArchivoValidationError) {
        return res.status(400).json({ message: error.message });
    }
    if (error instanceof ArchivoNotFoundError) {
        return res.status(404).json({ message: error.message });
    }
    if (error instanceof ArchivoConfigurationError) {
        return res.status(503).json({ message: error.message });
    }
    if (error instanceof ArchivoTimeoutError) {
        return res.status(504).json({ message: error.message });
    }
    if (error instanceof ArchivoUpstreamError) {
        return res.status(502).json({ message: error.message });
    }
    if (error && error.code === 11000) {
        return res.status(409).json({ message: 'El disco ya existe en el archivo' });
    }

    return res.status(500).json({ message: fallbackMessage });
};

const createArchivoRouter = ({ archivoService, authMiddleware }) => {
    if (!archivoService) {
        throw new Error('archivoService es obligatorio');
    }
    if (typeof authMiddleware !== 'function') {
        throw new Error('authMiddleware es obligatorio');
    }

    const router = express.Router();

    router.use(authMiddleware);

    router.get('/cajones', async (req, res) => {
        try {
            const result = await archivoService.getDrawers({
                groupBy: req.query ? req.query.agrupar : undefined,
                genre: req.query ? req.query.genero : undefined,
                artist: req.query ? req.query.artista : undefined
            });

            return res.status(200).json(result);
        } catch (error) {
            return respondWithError(res, error, 'No se pudieron obtener los cajones del archivo');
        }
    });

    router.get('/disco/:id', async (req, res) => {
        try {
            const vinyl = await archivoService.getVinylById(req.params.id);
            return res.status(200).json(vinyl);
        } catch (error) {
            return respondWithError(res, error, 'No se pudo obtener el disco');
        }
    });

    router.post('/buscar', async (req, res) => {
        try {
            const body = req.body || {};
            const result = await archivoService.searchVinyl({
                query: body.query,
                artist: body.artist,
                title: body.title
            });

            return res.status(result.created ? 201 : 200).json({
                disco: result.vinyl,
                cached: result.cached,
                created: result.created,
                stale: result.stale
            });
        } catch (error) {
            return respondWithError(res, error, 'No se pudo buscar el disco');
        }
    });

    return router;
};

module.exports = { createArchivoRouter };
