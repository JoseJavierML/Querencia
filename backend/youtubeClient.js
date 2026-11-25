const {
    YOUTUBE_API_URL,
    YOUTUBE_SEARCH_URL,
    YOUTUBE_MAX_CANDIDATES,
    YOUTUBE_MAX_TRACK_SECONDS,
    YOUTUBE_FULL_ALBUM_MARKERS
} = require('./archivoConstants');
const { isValidYouTubeVideoId } = require('./archivoUtils');

const normalizeForMatch = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Consulta de búsqueda de una canción. Solo usa artista y título: el nombre del
 * álbum sesga YouTube hacia el vídeo del disco completo o hacia el sencillo que
 * da título al álbum, y acaba asignando el mismo audio a varias canciones.
 */
const buildYouTubeQuery = ({ artist, title } = {}) => [artist, title]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');

/** Convierte una duración ISO 8601 de YouTube (`PT1H2M3S`) a segundos. */
const parseIsoDuration = (value) => {
    const match = typeof value === 'string'
        ? value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
        : null;
    if (!match || value === 'P' || value === 'PT') {
        return null;
    }
    const [, days, hours, minutes, seconds] = match.map((part) => Number(part) || 0);
    return (((days * 24) + hours) * 60 + minutes) * 60 + seconds;
};

/** Convierte una duración de reloj (`3:45`, `1:02:33`) a segundos. */
const parseClockDuration = (value) => {
    if (typeof value !== 'string' || !/^\d{1,2}(?::\d{2}){1,2}$/.test(value.trim())) {
        return null;
    }
    return value.trim().split(':').reduce((total, part) => total * 60 + Number(part), 0);
};

const isLikelyFullAlbum = ({ title, durationSeconds } = {}) => {
    if (Number.isFinite(durationSeconds) && durationSeconds > YOUTUBE_MAX_TRACK_SECONDS) {
        return true;
    }
    const normalizedTitle = normalizeForMatch(title);
    return YOUTUBE_FULL_ALBUM_MARKERS.some((marker) => normalizedTitle.includes(marker));
};

/**
 * Elige el vídeo de una canción entre varios candidatos ordenados por relevancia.
 * Descarta identificadores inválidos y vídeos de disco completo (por duración o
 * por título) y prefiere el primero cuyo título contiene el de la canción. Una
 * duración desconocida no descarta al candidato.
 */
const selectTrackVideo = (candidates, { title } = {}) => {
    const usable = (Array.isArray(candidates) ? candidates : [])
        .filter((candidate) => candidate && isValidYouTubeVideoId(candidate.videoId))
        .filter((candidate) => !isLikelyFullAlbum(candidate));

    const normalizedTitle = normalizeForMatch(title);
    const byTitle = normalizedTitle
        ? usable.find((candidate) => normalizeForMatch(candidate.title).includes(normalizedTitle))
        : null;
    const chosen = byTitle || usable[0];

    return chosen ? chosen.videoId : null;
};

/** Extrae los vídeos de la página pública de resultados de YouTube. */
const parseSearchHtml = (html) => {
    if (typeof html !== 'string' || html.length === 0) {
        return [];
    }

    const segments = html.split('"videoRenderer":{').slice(1);
    if (segments.length === 0) {
        const match = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/) ||
            html.match(/\/watch\?v=([A-Za-z0-9_-]{11})/);
        return match ? [{ videoId: match[1], title: '', durationSeconds: null }] : [];
    }

    return segments.map((segment) => {
        const id = segment.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
        const title = segment.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);
        const length = segment.match(/"lengthText":[\s\S]{0,400}?"simpleText":"(\d{1,2}(?::\d{2}){1,2})"/);
        let decodedTitle = title ? title[1] : '';
        try { if (decodedTitle) decodedTitle = JSON.parse(`"${decodedTitle}"`); } catch {}
        return {
            videoId: id ? id[1] : null,
            title: decodedTitle,
            durationSeconds: length ? parseClockDuration(length[1]) : null
        };
    });
};

const createYouTubeClient = ({
    fetchWithTimeout,
    requestJson,
    logger,
    youtubeApiKey,
    youtubeApiUrl = YOUTUBE_API_URL,
    youtubeSearchUrl = YOUTUBE_SEARCH_URL,
    scrapingEnabled = true
}) => {
    const youTubeKey = typeof youtubeApiKey === 'string' ? youtubeApiKey.trim() : '';
    const youTubeEndpoint = (typeof youtubeApiUrl === 'string' && youtubeApiUrl.trim()) || YOUTUBE_API_URL;
    const youTubeSearchEndpoint = (typeof youtubeSearchUrl === 'string' && youtubeSearchUrl.trim()) || YOUTUBE_SEARCH_URL;

    const buildYouTubeApiUrl = (query) => {
        const url = new URL(youTubeEndpoint);
        url.searchParams.set('part', 'snippet');
        url.searchParams.set('type', 'video');
        url.searchParams.set('videoCategoryId', '10');
        url.searchParams.set('maxResults', String(YOUTUBE_MAX_CANDIDATES));
        url.searchParams.set('q', query);
        url.searchParams.set('key', youTubeKey);
        return url.toString();
    };

    // El recurso `videos` vive junto a `search` (…/youtube/v3/videos).
    const buildYouTubeVideosUrl = (videoIds) => {
        const url = new URL('videos', youTubeEndpoint);
        url.searchParams.set('part', 'contentDetails');
        url.searchParams.set('id', videoIds.join(','));
        url.searchParams.set('key', youTubeKey);
        return url.toString();
    };

    const buildYouTubeSearchUrl = (query) => {
        const url = new URL(youTubeSearchEndpoint);
        url.searchParams.set('search_query', query);
        return url.toString();
    };

    const fetchDurations = async (videoIds) => {
        if (videoIds.length === 0) {
            return new Map();
        }
        try {
            const data = await requestJson(
                buildYouTubeVideosUrl(videoIds),
                { Accept: 'application/json' },
                'YouTube Data API'
            );
            const items = data && Array.isArray(data.items) ? data.items : [];
            return new Map(items
                .filter((item) => item && typeof item.id === 'string')
                .map((item) => [item.id, parseIsoDuration(item.contentDetails && item.contentDetails.duration)]));
        } catch (error) {
            if (typeof logger.debug === 'function') {
                logger.debug(`No se pudieron consultar las duraciones en YouTube: ${error.message}`);
            }
            return new Map();
        }
    };

    const resolveWithApi = async (query, track) => {
        const data = await requestJson(
            buildYouTubeApiUrl(query),
            { Accept: 'application/json' },
            'YouTube Data API'
        );
        const items = data && Array.isArray(data.items) ? data.items : [];
        const candidates = items.map((item) => ({
            videoId: item && item.id ? item.id.videoId : null,
            title: item && item.snippet ? item.snippet.title : ''
        }));
        const durations = await fetchDurations(candidates
            .map((candidate) => candidate.videoId)
            .filter(isValidYouTubeVideoId));

        return selectTrackVideo(
            candidates.map((candidate) => ({
                ...candidate,
                durationSeconds: durations.has(candidate.videoId) ? durations.get(candidate.videoId) : null
            })),
            track
        );
    };

    const resolveYouTubeVideoId = async ({ artist, title } = {}) => {
        const query = buildYouTubeQuery({ artist, title });
        if (!query) {
            return null;
        }

        if (youTubeKey) {
            try {
                const videoId = await resolveWithApi(query, { title });
                if (videoId) {
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
            const videoId = selectTrackVideo(parseSearchHtml(html), { title });

            if (isValidYouTubeVideoId(videoId)) {
                return videoId;
            }
        } catch (error) {
            logger.warn(`No se pudo resolver el audio mediante búsqueda en YouTube: ${error.message}`);
        }

        return null;
    };

    return {
        resolveYouTubeVideoId
    };
};

module.exports = {
    createYouTubeClient,
    buildYouTubeQuery,
    parseIsoDuration,
    parseClockDuration,
    isLikelyFullAlbum,
    selectTrackVideo,
    parseSearchHtml
};
