const {
    MAX_QUERY_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_ALBUM_LENGTH,
    MAX_GENRE_LENGTH,
    MAX_COVER_URL_LENGTH,
    MAX_LASTFM_ID_LENGTH,
    MAX_LASTFM_URL_LENGTH,
    MAX_PUBLISHED_LENGTH,
    MAX_SUMMARY_LENGTH,
    MAX_TAGS,
    MAX_TAG_LENGTH,
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
    asArray,
    buildCatalogKey,
    normalizeForComparison,
    normalizeGenreFromTags,
    normalizeTags,
    parseNonNegativeNumber,
    pickImage,
    sanitizeUrl,
    slugify,
    stripHtml,
    isValidYouTubeVideoId,
    isValidObjectId
} = require('./archivoUtils');
const defaultLogger = require('./logger');

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

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

const toSafeText = (value, maxLength) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
};

const toVinylResponse = (vinyl = {}) => {
    const lastFmInfo = vinyl.lastFmInfo || {};
    const tags = Array.isArray(lastFmInfo.tags) ? lastFmInfo.tags.filter((tag) => typeof tag === 'string') : [];

    return {
        _id: vinyl._id ? String(vinyl._id) : null,
        title: vinyl.title || '',
        artist: vinyl.artist || '',
        album: vinyl.album || null,
        coverUrl: vinyl.coverUrl || null,
        genre: vinyl.genre || UNCLASSIFIED_GENRE,
        youtubeVideoId: vinyl.youtubeVideoId || null,
        playable: Boolean(vinyl.youtubeVideoId),
        catalogKey: vinyl.catalogKey || null,
        lastFmInfo: {
            mbid: lastFmInfo.mbid || null,
            url: lastFmInfo.url || null,
            listeners: parseNonNegativeNumber(lastFmInfo.listeners, 0),
            playcount: parseNonNegativeNumber(lastFmInfo.playcount, 0),
            duration: lastFmInfo.duration === null || lastFmInfo.duration === undefined
                ? null
                : parseNonNegativeNumber(lastFmInfo.duration, null),
            published: lastFmInfo.published || null,
            summary: lastFmInfo.summary || '',
            tags,
            album: lastFmInfo.album || null,
            fetchedAt: lastFmInfo.fetchedAt || null
        },
        createdAt: vinyl.createdAt || null,
        updatedAt: vinyl.updatedAt || null,
        lastAccessedAt: vinyl.lastAccessedAt || null
    };
};

const toVinylSummary = (vinyl = {}) => ({
    _id: vinyl._id ? String(vinyl._id) : null,
    title: vinyl.title || '',
    artist: vinyl.artist || '',
    album: vinyl.album || null,
    coverUrl: vinyl.coverUrl || null,
    genre: vinyl.genre || UNCLASSIFIED_GENRE,
    youtubeVideoId: vinyl.youtubeVideoId || null,
    playable: Boolean(vinyl.youtubeVideoId)
});

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

    const lastFmKey = typeof lastFmApiKey === 'string' ? lastFmApiKey.trim() : '';
    const youTubeKey = typeof youtubeApiKey === 'string' ? youtubeApiKey.trim() : '';
    const lastFmEndpoint = (typeof lastFmApiUrl === 'string' && lastFmApiUrl.trim()) || LASTFM_API_URL;
    const youTubeEndpoint = (typeof youtubeApiUrl === 'string' && youtubeApiUrl.trim()) || YOUTUBE_API_URL;
    const youTubeSearchEndpoint = (typeof youtubeSearchUrl === 'string' && youtubeSearchUrl.trim()) || YOUTUBE_SEARCH_URL;
    const cacheTtlMs = readNumber(cacheTtlDays, DEFAULT_CACHE_TTL_DAYS, { allowZero: true }) * DAY_IN_MILLISECONDS;
    const timeoutMs = readNumber(httpTimeoutMs, DEFAULT_HTTP_TIMEOUT_MS);
    const scrapingEnabled = readBoolean(youtubeScrapingEnabled, true);

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

    const buildLastFmUrl = (method, params = {}) => {
        if (!lastFmKey) {
            throw new ArchivoConfigurationError('LASTFM_API_KEY no está configurada');
        }

        const url = new URL(lastFmEndpoint);
        url.searchParams.set('method', method);
        url.searchParams.set('api_key', lastFmKey);
        url.searchParams.set('format', 'json');

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        }

        return url.toString();
    };

    const requestLastFm = async (method, params = {}) => {
        const data = await requestJson(
            buildLastFmUrl(method, params),
            {
                Accept: 'application/json',
                'User-Agent': 'Querencia/1.0'
            },
            'Last.fm'
        );

        if (data && data.error) {
            const code = Number(data.error);
            if (code === 6) {
                throw new ArchivoNotFoundError('No se encontró la pista en Last.fm');
            }
            if (code === 10 || code === 26) {
                throw new ArchivoConfigurationError('Last.fm rechazó la clave de API');
            }
            throw new ArchivoUpstreamError(`Last.fm: ${data.message || 'error desconocido'}`);
        }

        return data;
    };

    const normalizeExternalTrack = (track, fallback = {}) => {
        if (!track || typeof track !== 'object') {
            return null;
        }

        const artistValue = track.artist && typeof track.artist === 'object'
            ? track.artist.name
            : track.artist;
        const artist = toSafeText(artistValue || fallback.artist, MAX_ARTIST_LENGTH);
        const title = toSafeText(track.name || fallback.title, MAX_TITLE_LENGTH);
        if (!artist || !title) {
            return null;
        }

        const album = toSafeText(track.album && track.album.title ? track.album.title : fallback.album, MAX_ALBUM_LENGTH) || null;
        const tagSource = track.toptags && track.toptags.tag
            ? track.toptags.tag
            : track.tags || fallback.tags || [];
        const tags = normalizeTags(asArray(tagSource).map((tag) => (
            typeof tag === 'string' ? tag : tag && tag.name
        )), { maxTags: MAX_TAGS, maxTagLength: MAX_TAG_LENGTH });
        const images = asArray(
            (track.album && track.album.image) ||
            track.image ||
            fallback.images ||
            []
        );
        const wiki = track.wiki || {};
        const summary = toSafeText(
            stripHtml(wiki.summary || fallback.summary || ''),
            MAX_SUMMARY_LENGTH
        );
        const duration = parseNonNegativeNumber(
            track.duration === undefined ? fallback.duration : track.duration,
            null
        );

        return {
            title,
            artist,
            album,
            coverUrl: pickImage(images) || sanitizeUrl(fallback.coverUrl, MAX_COVER_URL_LENGTH),
            genre: normalizeGenreFromTags(tags),
            lastFmInfo: {
                mbid: toSafeText(track.mbid || fallback.mbid, MAX_LASTFM_ID_LENGTH) || null,
                url: sanitizeUrl(track.url || fallback.url, MAX_LASTFM_URL_LENGTH),
                listeners: parseNonNegativeNumber(
                    track.listeners === undefined ? fallback.listeners : track.listeners,
                    0
                ),
                playcount: parseNonNegativeNumber(
                    track.playcount === undefined ? fallback.playcount : track.playcount,
                    0
                ),
                duration: duration !== null && duration > 0 ? duration : null,
                published: toSafeText(wiki.published || fallback.published, MAX_PUBLISHED_LENGTH) || null,
                summary,
                tags,
                album,
                fetchedAt: now()
            }
        };
    };

    const pickBestCandidate = (candidates, { artist, title }) => {
        const targetArtist = normalizeForComparison(artist);
        const targetTitle = normalizeForComparison(title);
        let best = null;

        candidates.forEach((candidate) => {
            let score = 0;
            if (targetTitle && normalizeForComparison(candidate.title) === targetTitle) {
                score += 2;
            }
            if (targetArtist && normalizeForComparison(candidate.artist) === targetArtist) {
                score += 2;
            }
            if (!best || score > best.score) {
                best = { candidate, score };
            }
        });

        return best ? best.candidate : null;
    };

    const findCandidate = async ({ query, artist, title }) => {
        let searchCandidate = null;
        let searchError = null;
        const searchTrack = title || query;

        if (searchTrack) {
            try {
                const data = await requestLastFm('track.search', {
                    track: searchTrack,
                    ...(artist ? { artist } : {}),
                    limit: 5
                });
                const rawTracks = asArray(data && data.results && data.results.trackmatches
                    ? data.results.trackmatches.track
                    : []);
                const candidates = rawTracks
                    .map((track) => normalizeExternalTrack(track))
                    .filter(Boolean);

                if (candidates.length > 0) {
                    searchCandidate = pickBestCandidate(candidates, { artist, title });
                }
            } catch (error) {
                if (!artist || !title) {
                    throw error;
                }
                searchError = error;
            }
        }

        const infoArtist = artist || (searchCandidate ? searchCandidate.artist : '');
        const infoTitle = title || (searchCandidate ? searchCandidate.title : '');

        if (infoArtist && infoTitle) {
            try {
                const data = await requestLastFm('track.getInfo', {
                    artist: infoArtist,
                    track: infoTitle
                });
                const infoCandidate = normalizeExternalTrack(data && data.track, {
                    artist: infoArtist,
                    title: infoTitle,
                    album: searchCandidate ? searchCandidate.album : null,
                    coverUrl: searchCandidate ? searchCandidate.coverUrl : null
                });

                if (infoCandidate) {
                    return infoCandidate;
                }
            } catch (error) {
                if (searchCandidate) {
                    logger.warn(`Last.fm no devolvió la ficha completa de "${infoArtist} - ${infoTitle}"; se usan los datos de búsqueda`);
                    return searchCandidate;
                }

                if (searchError) {
                    throw searchError;
                }
                throw error;
            }
        }

        if (searchCandidate) {
            return searchCandidate;
        }
        if (searchError) {
            throw searchError;
        }

        throw new ArchivoNotFoundError('No se encontró ningún vinilo para esa búsqueda');
    };

    const buildYouTubeApiUrl = (query) => {
        const url = new URL(youTubeEndpoint);
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('type', 'video');
        url.searchParams.set('videoCategoryId', '10');
        url.searchParams.set('maxResults', '1');
        url.searchParams.set('q', query);
        url.searchParams.set('key', youTubeKey);
        return url.toString();
    };

    const buildYouTubeSearchUrl = (query) => {
        const url = new URL(youTubeSearchEndpoint);
        url.searchParams.set('search_query', query);
        return url.toString();
    };

    const resolveYouTubeVideoId = async ({ artist, title, album }) => {
        const query = [artist, title, album, 'official audio']
            .filter(Boolean)
            .join(' ');

        if (youTubeKey) {
            try {
                const data = await requestJson(
                    buildYouTubeApiUrl(query),
                    { Accept: 'application/json' },
                    'YouTube Data API'
                );
                const videoId = data && data.items && data.items[0] && data.items[0].id
                    ? data.items[0].id.videoId
                    : null;
                if (isValidYouTubeVideoId(videoId)) {
                    return videoId;
                }
                if (typeof logger.debug === 'function') {
                    logger.debug('YouTube Data API no devolvió un vídeo utilizable');
                }
            } catch (error) {
                logger.warn(`No se pudo resolver el audio con YouTube Data API: ${error.message}`);
            }
        }

        if (!scrapingEnabled) {
            return null;
        }

        try {
            const response = await fetchWithTimeout(buildYouTubeSearchUrl(query), {
                headers: {
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                }
            });

            if (!response || !response.ok) {
                return null;
            }

            const html = typeof response.text === 'function' ? await response.text() : '';
            const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/) ||
                html.match(/\/watch\?v=([A-Za-z0-9_-]{11})/);
            const videoId = match ? match[1] : null;

            if (isValidYouTubeVideoId(videoId)) {
                return videoId;
            }
        } catch (error) {
            logger.warn(`No se pudo resolver el audio mediante búsqueda en YouTube: ${error.message}`);
        }

        return null;
    };

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
