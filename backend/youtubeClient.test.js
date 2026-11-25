const {
    createYouTubeClient,
    buildYouTubeQuery,
    parseIsoDuration,
    parseClockDuration,
    isLikelyFullAlbum,
    selectTrackVideo,
    parseSearchHtml
} = require('./youtubeClient');

const TRACK = {
    artist: 'La Plazuela',
    title: 'El Lao de la Pena',
    album: 'RONEO FUNK CLUB'
};

// Identificadores de once caracteres válidos para el patrón de YouTube.
const ALBUM_VIDEO = 'albumVideo1';
const OTHER_SONG = 'otraCancion';
const TRACK_VIDEO = 'laoDeLaPena';

const createLogger = () => ({ warn: jest.fn(), debug: jest.fn() });

const createApiClient = ({ searchItems, durations = {}, logger = createLogger() }) => {
    const requestJson = jest.fn(async (url) => {
        const parsed = new URL(url);
        if (parsed.pathname.endsWith('/search')) {
            return { items: searchItems };
        }
        if (parsed.pathname.endsWith('/videos')) {
            return {
                items: parsed.searchParams.get('id').split(',')
                    .filter((id) => durations[id])
                    .map((id) => ({ id, contentDetails: { duration: durations[id] } }))
            };
        }
        throw new Error(`URL no esperada: ${url}`);
    });
    const client = createYouTubeClient({
        fetchWithTimeout: jest.fn(),
        requestJson,
        logger,
        youtubeApiKey: 'clave-youtube',
        scrapingEnabled: false
    });
    return { client, requestJson, logger };
};

const searchItem = (videoId, title) => ({ id: { videoId }, snippet: { title } });

describe('buildYouTubeQuery', () => {
    test('usa solo artista y título, sin el nombre del álbum ni coletillas', () => {
        const query = buildYouTubeQuery(TRACK);

        expect(query).toBe('La Plazuela El Lao de la Pena');
        expect(query).not.toMatch(/roneo|funk club/i);
        expect(query).not.toMatch(/official audio/i);
    });

    test('ignora valores vacíos o que no son texto', () => {
        expect(buildYouTubeQuery({ artist: '  Israel Fernández ', title: 'Despierta', album: null })).toBe('Israel Fernández Despierta');
        expect(buildYouTubeQuery({ artist: '', title: undefined })).toBe('');
        expect(buildYouTubeQuery()).toBe('');
    });
});

describe('duraciones', () => {
    test('convierte duraciones ISO 8601 de la Data API', () => {
        expect(parseIsoDuration('PT3M45S')).toBe(225);
        expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
        expect(parseIsoDuration('PT45S')).toBe(45);
        expect(parseIsoDuration('P1DT1M')).toBe(86460);
        expect(parseIsoDuration('PT')).toBeNull();
        expect(parseIsoDuration('3:45')).toBeNull();
        expect(parseIsoDuration(undefined)).toBeNull();
    });

    test('convierte duraciones de reloj de la página de resultados', () => {
        expect(parseClockDuration('3:45')).toBe(225);
        expect(parseClockDuration('1:02:33')).toBe(3753);
        expect(parseClockDuration('en directo')).toBeNull();
    });
});

describe('isLikelyFullAlbum', () => {
    test('marca como disco completo los vídeos de más de quince minutos', () => {
        expect(isLikelyFullAlbum({ title: 'La Plazuela - Roneo Funk Club', durationSeconds: 38 * 60 })).toBe(true);
        expect(isLikelyFullAlbum({ title: 'La Plazuela - Realejo Beach', durationSeconds: 15 * 60 })).toBe(false);
    });

    test('marca como disco completo los títulos típicos aunque no se conozca la duración', () => {
        expect(isLikelyFullAlbum({ title: 'Israel Fernández - Pura Sangre (ÁLBUM COMPLETO)' })).toBe(true);
        expect(isLikelyFullAlbum({ title: 'La Plazuela - Roneo Funk Club [Full Album]' })).toBe(true);
        expect(isLikelyFullAlbum({ title: 'Israel Fernández - Despierta (Bulería)', durationSeconds: null })).toBe(false);
    });
});

describe('selectTrackVideo', () => {
    test('descarta el disco completo y prefiere el vídeo cuyo título es la canción', () => {
        const videoId = selectTrackVideo([
            { videoId: ALBUM_VIDEO, title: 'La Plazuela - Roneo Funk Club', durationSeconds: 2280 },
            { videoId: OTHER_SONG, title: 'La Plazuela - Realejo Beach (video oficial)', durationSeconds: 210 },
            { videoId: TRACK_VIDEO, title: 'La Plazuela - El Lao De La Pena (Live Session)', durationSeconds: 240 }
        ], TRACK);

        expect(videoId).toBe(TRACK_VIDEO);
    });

    test('si ningún título coincide, usa el primer vídeo corto con identificador válido', () => {
        expect(selectTrackVideo([
            { videoId: 'no-valido', title: 'Otro', durationSeconds: 200 },
            { videoId: ALBUM_VIDEO, title: 'Disco', durationSeconds: 3000 },
            { videoId: OTHER_SONG, title: 'Otra canción', durationSeconds: 200 }
        ], TRACK)).toBe(OTHER_SONG);
    });

    test('devuelve null si solo hay discos completos', () => {
        expect(selectTrackVideo([
            { videoId: ALBUM_VIDEO, title: 'El Lao de la Pena y más (full album)', durationSeconds: null }
        ], TRACK)).toBeNull();
        expect(selectTrackVideo(null, TRACK)).toBeNull();
    });
});

describe('parseSearchHtml', () => {
    test('extrae identificador, título y duración de cada resultado', () => {
        const html = [
            '<script>var ytInitialData = {"contents":[',
            `{"videoRenderer":{"videoId":"${ALBUM_VIDEO}","title":{"runs":[{"text":"Roneo Funk Club"}]},`,
            '"lengthText":{"accessibility":{"accessibilityData":{"label":"38 minutos"}},"simpleText":"38:02"}}},',
            `{"videoRenderer":{"videoId":"${TRACK_VIDEO}","title":{"runs":[{"text":"El Lao De La Pena"}]},`,
            '"lengthText":{"accessibility":{"accessibilityData":{"label":"4 minutos"}},"simpleText":"4:01"}}}',
            ']}</script>'
        ].join('');

        expect(parseSearchHtml(html)).toEqual([
            { videoId: ALBUM_VIDEO, title: 'Roneo Funk Club', durationSeconds: 2282 },
            { videoId: TRACK_VIDEO, title: 'El Lao De La Pena', durationSeconds: 241 }
        ]);
    });

    test('mantiene la extracción simple cuando la página no trae resultados estructurados', () => {
        expect(parseSearchHtml('<html>"videoId":"abc123DEF45"</html>')).toEqual([
            { videoId: 'abc123DEF45', title: '', durationSeconds: null }
        ]);
        expect(parseSearchHtml('')).toEqual([]);
    });
});

describe('createYouTubeClient con YouTube Data API', () => {
    test('busca sin álbum, consulta las duraciones y no elige el vídeo del disco completo', async () => {
        const { client, requestJson } = createApiClient({
            searchItems: [
                searchItem(ALBUM_VIDEO, 'La Plazuela - RONEO FUNK CLUB'),
                searchItem(TRACK_VIDEO, 'La Plazuela - El Lao De La Pena (Live Session)')
            ],
            durations: { [ALBUM_VIDEO]: 'PT38M2S', [TRACK_VIDEO]: 'PT4M1S' }
        });

        const videoId = await client.resolveYouTubeVideoId(TRACK);

        expect(videoId).toBe(TRACK_VIDEO);
        const searchUrl = new URL(requestJson.mock.calls[0][0]);
        expect(searchUrl.searchParams.get('q')).toBe('La Plazuela El Lao de la Pena');
        expect(searchUrl.searchParams.get('q')).not.toMatch(/roneo/i);
        expect(Number(searchUrl.searchParams.get('maxResults'))).toBeGreaterThan(1);

        const videosUrl = new URL(requestJson.mock.calls[1][0]);
        expect(videosUrl.pathname).toBe('/youtube/v3/videos');
        expect(videosUrl.searchParams.get('part')).toBe('contentDetails');
        expect(videosUrl.searchParams.get('id')).toBe(`${ALBUM_VIDEO},${TRACK_VIDEO}`);
    });

    test('descarta un vídeo largo aunque su título coincida con la canción', async () => {
        const { client } = createApiClient({
            searchItems: [
                searchItem(ALBUM_VIDEO, 'La Plazuela - El Lao de la Pena y otras (concierto)'),
                searchItem(OTHER_SONG, 'La Plazuela en directo')
            ],
            durations: { [ALBUM_VIDEO]: 'PT1H5M', [OTHER_SONG]: 'PT3M30S' }
        });

        await expect(client.resolveYouTubeVideoId(TRACK)).resolves.toBe(OTHER_SONG);
    });

    test('devuelve null si todos los candidatos son discos completos', async () => {
        const { client, logger } = createApiClient({
            searchItems: [searchItem(ALBUM_VIDEO, 'La Plazuela - Roneo Funk Club')],
            durations: { [ALBUM_VIDEO]: 'PT38M' }
        });

        await expect(client.resolveYouTubeVideoId(TRACK)).resolves.toBeNull();
        expect(logger.debug).toHaveBeenCalledWith('YouTube Data API no devolvió un vídeo utilizable');
    });

    test('si falla la consulta de duraciones, sigue filtrando por título', async () => {
        const logger = createLogger();
        const requestJson = jest.fn(async (url) => {
            if (new URL(url).pathname.endsWith('/videos')) {
                throw new Error('cuota agotada');
            }
            return {
                items: [
                    searchItem(ALBUM_VIDEO, 'La Plazuela - Roneo Funk Club (Álbum Completo)'),
                    searchItem(TRACK_VIDEO, 'La Plazuela - El Lao De La Pena')
                ]
            };
        });
        const client = createYouTubeClient({
            fetchWithTimeout: jest.fn(),
            requestJson,
            logger,
            youtubeApiKey: 'clave-youtube',
            scrapingEnabled: false
        });

        await expect(client.resolveYouTubeVideoId(TRACK)).resolves.toBe(TRACK_VIDEO);
        expect(logger.warn).not.toHaveBeenCalled();
    });
});

describe('createYouTubeClient con búsqueda de respaldo', () => {
    test('el scraping usa la misma consulta sin álbum y salta el disco completo', async () => {
        const html = [
            `{"videoRenderer":{"videoId":"${ALBUM_VIDEO}","title":{"runs":[{"text":"Roneo Funk Club"}]},`,
            '"lengthText":{"simpleText":"38:02"}}},',
            `{"videoRenderer":{"videoId":"${TRACK_VIDEO}","title":{"runs":[{"text":"El Lao De La Pena"}]},`,
            '"lengthText":{"simpleText":"4:01"}}}'
        ].join('');
        const fetchWithTimeout = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(html)
        });
        const client = createYouTubeClient({
            fetchWithTimeout,
            requestJson: jest.fn(),
            logger: createLogger(),
            youtubeApiKey: '',
            scrapingEnabled: true
        });

        await expect(client.resolveYouTubeVideoId(TRACK)).resolves.toBe(TRACK_VIDEO);
        const scrapingUrl = new URL(fetchWithTimeout.mock.calls[0][0]);
        expect(scrapingUrl.searchParams.get('search_query')).toBe('La Plazuela El Lao de la Pena');
    });

    test('no consulta YouTube si no hay artista ni título', async () => {
        const fetchWithTimeout = jest.fn();
        const requestJson = jest.fn();
        const client = createYouTubeClient({
            fetchWithTimeout,
            requestJson,
            logger: createLogger(),
            youtubeApiKey: 'clave-youtube'
        });

        await expect(client.resolveYouTubeVideoId({ album: 'RONEO FUNK CLUB' })).resolves.toBeNull();
        expect(requestJson).not.toHaveBeenCalled();
        expect(fetchWithTimeout).not.toHaveBeenCalled();
    });
});
