const {
    YOUTUBE_API_URL,
    YOUTUBE_SEARCH_URL
} = require('./archivoConstants');
const { isValidYouTubeVideoId } = require('./archivoUtils');

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

    return {
        resolveYouTubeVideoId
    };
};

module.exports = {
    createYouTubeClient
};
