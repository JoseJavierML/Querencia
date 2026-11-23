const {
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_ALBUM_LENGTH,
    MAX_COVER_URL_LENGTH,
    MAX_LASTFM_ID_LENGTH,
    MAX_LASTFM_URL_LENGTH,
    MAX_PUBLISHED_LENGTH,
    MAX_SUMMARY_LENGTH,
    MAX_TAGS,
    MAX_TAG_LENGTH,
    LASTFM_API_URL
} = require('./archivoConstants');
const {
    asArray,
    normalizeForComparison,
    normalizeGenreFromTags,
    normalizeTags,
    parseNonNegativeNumber,
    pickImage,
    sanitizeUrl,
    stripHtml
} = require('./archivoUtils');
const {
    ArchivoNotFoundError,
    ArchivoUpstreamError,
    ArchivoConfigurationError
} = require('./archivoErrors');

const toSafeText = (value, maxLength) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
};

const createLastFmClient = ({
    requestJson,
    logger,
    now,
    lastFmApiKey,
    lastFmApiUrl = LASTFM_API_URL
}) => {
    const lastFmKey = typeof lastFmApiKey === 'string' ? lastFmApiKey.trim() : '';
    const lastFmEndpoint = (typeof lastFmApiUrl === 'string' && lastFmApiUrl.trim()) || LASTFM_API_URL;

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

    return {
        findCandidate,
        normalizeExternalTrack,
        requestLastFm
    };
};

module.exports = {
    createLastFmClient
};
