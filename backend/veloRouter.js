const express = require('express');
const {
    VeloValidationError,
    VeloUserNotFoundError,
    VeloTrackNotFoundError,
    VeloAlreadyReflectedError,
    VeloDuplicateDateError
} = require('./veloService');
const { resolveVinylSummary } = require('./vinylResponse');

const toReflectionResponse = (reflection, viewerId) => ({
    _id: reflection._id,
    userId: reflection.userId,
    text: reflection.text,
    isMine: String(reflection.userId) === String(viewerId)
});

const withVinyl = (base, track) => {
    const vinyl = resolveVinylSummary(track);
    return vinyl
        ? { ...base, vinylId: vinyl._id, vinyl }
        : base;
};

const toRevealedTrackResponse = (track, viewerId) => {
    const reflections = Array.isArray(track.reflections) ? track.reflections : [];

    return withVinyl({
        _id: track._id,
        releaseDate: track.releaseDate,
        audioUrl: track.audioUrl,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl || null,
        participated: true,
        reflectionCount: reflections.length,
        reflections: reflections.map((reflection) => toReflectionResponse(reflection, viewerId))
    }, track);
};

const toAdminTrackResponse = (track, status = track.status) => {
    const reflections = Array.isArray(track.reflections) ? track.reflections : [];

    return withVinyl({
        _id: track._id,
        releaseDate: track.releaseDate,
        audioUrl: track.audioUrl,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl || null,
        reflectionCount: reflections.length,
        status
    }, track);
};

const respondWithError = (res, error, fallbackMessage) => {
    if (error instanceof VeloValidationError) {
        return res.status(400).json({ message: error.message });
    }
    if (error instanceof VeloUserNotFoundError) {
        return res.status(401).json({ message: error.message });
    }
    if (error instanceof VeloTrackNotFoundError) {
        return res.status(404).json({ message: error.message });
    }
    if (error instanceof VeloAlreadyReflectedError) {
        return res.status(409).json({ message: error.message });
    }
    if (error instanceof VeloDuplicateDateError) {
        return res.status(409).json({ message: error.message });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const createVeloRouter = ({ veloService, authMiddleware, adminMiddleware }) => {
    if (!veloService) {
        throw new Error('veloService es obligatorio');
    }
    if (typeof authMiddleware !== 'function') {
        throw new Error('authMiddleware es obligatorio');
    }
    if (typeof adminMiddleware !== 'function') {
        throw new Error('adminMiddleware es obligatorio');
    }

    const router = express.Router();

    router.get('/today', authMiddleware, async (req, res) => {
        try {
            const { track, hasReflected, viewerId } = await veloService.getToday({
                email: req.user.email
            });

            if (!hasReflected) {
                return res.status(200).json({ audioUrl: track.audioUrl });
            }

            return res.status(200).json(toRevealedTrackResponse(track, viewerId));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo obtener la pista del día');
        }
    });

    router.post('/today/reflect', authMiddleware, async (req, res) => {
        try {
            const { track, viewerId } = await veloService.reflect({
                email: req.user.email,
                text: req.body ? req.body.text : undefined
            });

            return res.status(200).json(toRevealedTrackResponse(track, viewerId));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo guardar la reflexión');
        }
    });

    router.post('/tracks', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const body = req.body || {};
            const { track, status } = await veloService.createTrack({
                releaseDate: body.releaseDate,
                audioUrl: body.audioUrl,
                title: body.title,
                artist: body.artist,
                coverUrl: body.coverUrl,
                ...(body.vinylId !== undefined ? { vinylId: body.vinylId } : {})
            });

            return res.status(201).json(toAdminTrackResponse(track, status));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo programar la pista');
        }
    });

    router.get('/tracks', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const tracks = await veloService.listTracks();
            return res.status(200).json(tracks.map((track) => toAdminTrackResponse(track)));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo obtener la cola del Velo');
        }
    });

    router.patch('/tracks/order', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const tracks = await veloService.reorderTracks({
                trackIds: req.body ? req.body.trackIds : undefined
            });

            return res.status(200).json(tracks.map((track) => toAdminTrackResponse(track)));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo reordenar la cola del Velo');
        }
    });

    router.put('/tracks/:id', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const body = req.body || {};
            const { track, status } = await veloService.updateTrack({
                id: req.params.id,
                releaseDate: body.releaseDate,
                audioUrl: body.audioUrl,
                title: body.title,
                artist: body.artist,
                coverUrl: body.coverUrl,
                ...(body.vinylId !== undefined ? { vinylId: body.vinylId } : {})
            });

            return res.status(200).json(toAdminTrackResponse(track, status));
        } catch (error) {
            return respondWithError(res, error, 'No se pudo actualizar la pista');
        }
    });

    return router;
};

module.exports = { createVeloRouter };
