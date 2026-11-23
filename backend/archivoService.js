const {
    MAX_QUERY_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_GENRE_LENGTH,
    DEFAULT_CACHE_TTL_DAYS,
    DEFAULT_HTTP_TIMEOUT_MS,
    DEFAULT_GROUPING,
    UNCLASSIFIED_GENRE,
    LASTFM_API_URL,
    YOUTUBE_API_URL,
    YOUTUBE_SEARCH_URL,
    GROUPING_ALIASES
} = require('./archivoConstants');
const {
    buildCatalogKey,
    normalizeForComparison,
    slugify
} = require('./archivoUtils');
const defaultLogger = require('./logger');
const { toVinylSummary } = require('./vinylResponse');
const { isValidObjectId } = require('./validation');
const { DAY_IN_MILLISECONDS } = require('./timeConstants');
const {
    ArchivoValidationError,
    ArchivoNotFoundError,
    ArchivoUpstreamError,
    ArchivoTimeoutError,
    ArchivoConfigurationError
} = require('./archivoErrors');
const { createHttpJsonClient } = require('./httpJsonClient');
const { createLastFmClient } = require('./lastfmClient');
const { createYouTubeClient } = require('./youtubeClient');
const { createArchivoCache } = require('./archivoCache');
const { toVinylResponse } = require('./vinylMapper');

const readNumber = (value, fallback, { allowZero = false } = {}) => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
        return fallback;
    }
    return parsed;
};

const readBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no'].includes(normalized)) {
        return false;
    }
    return fallback;
};

const normalizeOptionalText = (value, field, maxLength) => {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value !== 'string') {
        throw new ArchivoValidationError(`${field} no es válido`);
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) {
        return '';
    }
    if (normalized.length > maxLength) {
        throw new ArchivoValidationError(`${field} no puede superar los ${maxLength} caracteres`);
    }

    return normalized;
};

const normalizeGrouping = (value) => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        return DEFAULT_GROUPING;
    }
    if (typeof value !== 'string') {
        throw new ArchivoValidationError('La agrupación debe ser "genero" o "artista"');
    }

    const normalized = normalizeForComparison(value);
    const grouping = GROUPING_ALIASES[normalized];
    if (!grouping) {
        throw new ArchivoValidationError('La agrupación debe ser "genero" o "artista"');
    }

    return grouping;
};

const createArchivoService = ({
    vinylRepository,
    fetchImpl = globalThis.fetch,
    logger = defaultLogger,
    now = () => new Date(),
    lastFmApiKey = process.env.LASTFM_API_KEY,
    lastFmApiUrl = process.env.LASTFM_API_URL || LASTFM_API_URL,
    youtubeApiKey = process.env.YOUTUBE_API_KEY,
    youtubeApiUrl = process.env.YOUTUBE_API_URL || YOUTUBE_API_URL,
    youtubeSearchUrl = process.env.YOUTUBE_SEARCH_URL || YOUTUBE_SEARCH_URL,
    youtubeScrapingEnabled = process.env.YOUTUBE_SCRAPING_ENABLED,
    cacheTtlDays = process.env.ARCHIVO_CACHE_TTL_DAYS,
    httpTimeoutMs = process.env.ARCHIVO_HTTP_TIMEOUT_MS
} = {}) => {
    if (!vinylRepository) {
        throw new Error('vinylRepository es obligatorio');
    }
    if (typeof fetchImpl !== 'function') {
        throw new Error('fetchImpl es obligatorio');
    }
    if (!logger || typeof logger.warn !== 'function') {
        throw new Error('logger es obligatorio');
    }
    if (typeof now !== 'function') {
        throw new Error('now es obligatorio');
    }

    const cacheTtlMs = readNumber(cacheTtlDays, DEFAULT_CACHE_TTL_DAYS, { allowZero: true }) * DAY_IN_MILLISECONDS;
    const timeoutMs = readNumber(httpTimeoutMs, DEFAULT_HTTP_TIMEOUT_MS);
    const scrapingEnabled = readBoolean(youtubeScrapingEnabled, true);

    const { fetchWithTimeout, requestJson } = createHttpJsonClient({ fetchImpl, timeoutMs });
    const { findCandidate, normalizeExternalTrack, requestLastFm } = createLastFmClient({
        requestJson,
        logger,
        now,
        lastFmApiKey,
        lastFmApiUrl
    });
    const { resolveYouTubeVideoId } = createYouTubeClient({
        fetchWithTimeout,
        requestJson,
        logger,
        youtubeApiKey,
        youtubeApiUrl,
        youtubeSearchUrl,
        scrapingEnabled
    });
    const { resolveCachedResult, touchSafely } = createArchivoCache({
        vinylRepository,
        now,
        cacheTtlMs,
        logger,
        resolveYouTubeVideoId,
        requestLastFm,
        normalizeExternalTrack,
        toVinylResponse
    });

    const searchVinyl = async ({ query, artist, title } = {}) => {
        const normalizedQuery = normalizeOptionalText(query, 'La búsqueda', MAX_QUERY_LENGTH);
        const normalizedArtist = normalizeOptionalText(artist, 'El artista', MAX_ARTIST_LENGTH);
        const normalizedTitle = normalizeOptionalText(title, 'El título', MAX_TITLE_LENGTH);

        if (!normalizedQuery && (!normalizedArtist || !normalizedTitle)) {
            throw new ArchivoValidationError('Indica una búsqueda o un artista y un título');
        }
        if (Boolean(normalizedArtist) !== Boolean(normalizedTitle)) {
            throw new ArchivoValidationError('El artista y el título deben indicarse juntos');
        }

        let catalogKey = normalizedArtist && normalizedTitle
            ? buildCatalogKey(normalizedArtist, normalizedTitle)
            : '';
        let cached = catalogKey
            ? await vinylRepository.findByCatalogKey(catalogKey)
            : null;

        if (cached) {
            return resolveCachedResult(cached);
        }

        const candidate = await findCandidate({
            query: normalizedQuery,
            artist: normalizedArtist,
            title: normalizedTitle
        });
        const candidateKey = buildCatalogKey(candidate.artist, candidate.title);

        if (!candidateKey) {
            throw new ArchivoUpstreamError('Last.fm devolvió un vinilo sin artista o título utilizables');
        }

        if (candidateKey !== catalogKey) {
            cached = await vinylRepository.findByCatalogKey(candidateKey);
            if (cached) {
                return resolveCachedResult(cached);
            }
        }

        const youtubeVideoId = await resolveYouTubeVideoId({
            artist: candidate.artist,
            title: candidate.title,
            album: candidate.album
        });

        const data = {
            ...candidate,
            catalogKey: candidateKey,
            youtubeVideoId
        };

        let saved;
        try {
            saved = await vinylRepository.upsertByCatalogKey(data);
        } catch (error) {
            if (error && error.code === 11000) {
                const existing = await vinylRepository.findByCatalogKey(candidateKey);
                if (existing) {
                    return resolveCachedResult(existing);
                }
            }
            throw error;
        }

        if (!saved) {
            throw new ArchivoUpstreamError('No se pudo guardar el vinilo en el archivo');
        }

        return {
            vinyl: toVinylResponse(saved),
            cached: false,
            created: true,
            stale: false
        };
    };

    const getVinylById = async (id) => {
        if (!isValidObjectId(id)) {
            throw new ArchivoValidationError('El identificador del disco no es válido');
        }

        const vinyl = await vinylRepository.findById(id.trim());
        if (!vinyl) {
            throw new ArchivoNotFoundError('El disco no existe en el archivo');
        }

        await touchSafely(id.trim());
        return toVinylResponse(vinyl);
    };

    const getDrawers = async ({ groupBy, genre, artist } = {}) => {
        const grouping = normalizeGrouping(groupBy);
        const normalizedGenre = normalizeOptionalText(genre, 'El género', MAX_GENRE_LENGTH);
        const normalizedArtist = normalizeOptionalText(artist, 'El artista', MAX_ARTIST_LENGTH);
        const vinyls = await vinylRepository.findAll({
            genre: normalizedGenre,
            artist: normalizedArtist
        });

        const groups = new Map();

        for (const vinyl of vinyls) {
            const label = grouping === 'artista'
                ? (vinyl.artist || 'Artista desconocido')
                : (vinyl.genre || UNCLASSIFIED_GENRE);
            const key = slugify(label);

            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    label,
                    vinyls: []
                });
            }

            groups.get(key).vinyls.push(vinyl);
        }

        const cajones = Array.from(groups.values())
            .map((group) => ({
                clave: group.key,
                etiqueta: group.label,
                total: group.vinyls.length,
                vinilos: group.vinyls
                    .slice()
                    .sort((left, right) => (
                        `${left.artist || ''} ${left.title || ''}`
                            .localeCompare(`${right.artist || ''} ${right.title || ''}`, 'es', { sensitivity: 'base' })
                    ))
                    .map(toVinylSummary)
            }))
            .sort((left, right) => left.etiqueta.localeCompare(right.etiqueta, 'es', { sensitivity: 'base' }));

        return {
            agrupacion: grouping,
            total: vinyls.length,
            cajones
        };
    };

    return {
        searchVinyl,
        getVinylById,
        getDrawers
    };
};

module.exports = {
    createArchivoService,
    ArchivoValidationError,
    ArchivoNotFoundError,
    ArchivoUpstreamError,
    ArchivoTimeoutError,
    ArchivoConfigurationError
};
