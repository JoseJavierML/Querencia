const { DAY_IN_MILLISECONDS } = require('./timeConstants');
const { ArchivoUpstreamError } = require('./archivoErrors');

const createArchivoCache = ({
    vinylRepository,
    now,
    cacheTtlMs,
    logger,
    resolveYouTubeVideoId,
    requestLastFm,
    normalizeExternalTrack,
    toVinylResponse
}) => {
    const getCacheDate = (vinyl) => (
        vinyl && vinyl.lastFmInfo && vinyl.lastFmInfo.fetchedAt
            ? vinyl.lastFmInfo.fetchedAt
            : vinyl && (vinyl.updatedAt || vinyl.createdAt)
    );

    const isFresh = (vinyl) => {
        if (cacheTtlMs <= 0) {
            return false;
        }

        const cacheDate = getCacheDate(vinyl);
        const timestamp = new Date(cacheDate).getTime();
        if (!Number.isFinite(timestamp)) {
            return false;
        }

        return now().getTime() - timestamp <= cacheTtlMs;
    };

    const touchSafely = async (id) => {
        try {
            await vinylRepository.touchById(id);
        } catch (error) {
            logger.warn(`No se pudo registrar el acceso al vinilo: ${error.message}`);
        }
    };

    const enrichCachedVinyl = async (cached) => {
        if (!cached || cached.youtubeVideoId) {
            return cached;
        }

        const lastAccess = new Date(
            cached.lastAccessedAt || cached.updatedAt || cached.createdAt
        ).getTime();
        if (Number.isFinite(lastAccess) && now().getTime() - lastAccess < DAY_IN_MILLISECONDS) {
            return cached;
        }

        const youtubeVideoId = await resolveYouTubeVideoId({
            artist: cached.artist,
            title: cached.title,
            album: cached.album
        });

        if (!youtubeVideoId) {
            return cached;
        }

        try {
            const updated = await vinylRepository.updateById(cached._id, { youtubeVideoId });
            return updated || cached;
        } catch (error) {
            logger.warn(`No se pudo enriquecer el vinilo con audio de YouTube: ${error.message}`);
            return cached;
        }
    };

    const refreshCachedVinyl = async (cached) => {
        try {
            const data = await requestLastFm('track.getInfo', {
                artist: cached.artist,
                track: cached.title
            });
            const normalized = normalizeExternalTrack(data && data.track, {
                artist: cached.artist,
                title: cached.title,
                album: cached.album,
                coverUrl: cached.coverUrl
            });

            if (!normalized) {
                throw new ArchivoUpstreamError('Last.fm no devolvió metadatos válidos para refrescar el vinilo');
            }

            const youtubeVideoId = cached.youtubeVideoId || await resolveYouTubeVideoId({
                artist: normalized.artist,
                title: normalized.title,
                album: normalized.album
            });

            const updated = await vinylRepository.updateById(cached._id, {
                ...normalized,
                catalogKey: cached.catalogKey,
                youtubeVideoId
            });

            if (!updated) {
                throw new ArchivoUpstreamError('No se pudo actualizar el vinilo cacheado');
            }

            return updated;
        } catch (error) {
            logger.warn(`Se conserva la copia cacheada de "${cached.artist} - ${cached.title}": ${error.message}`);
            return cached;
        }
    };

    const resolveCachedResult = async (cached) => {
        if (isFresh(cached)) {
            const enriched = cached.youtubeVideoId ? cached : await enrichCachedVinyl(cached);
            await touchSafely(cached._id);
            return {
                vinyl: toVinylResponse(enriched),
                cached: true,
                created: false,
                stale: false
            };
        }

        const refreshed = await refreshCachedVinyl(cached);
        await touchSafely(cached._id);
        return {
            vinyl: toVinylResponse(refreshed),
            cached: true,
            created: false,
            stale: refreshed === cached
        };
    };

    return {
        resolveCachedResult,
        touchSafely
    };
};

module.exports = {
    createArchivoCache
};
