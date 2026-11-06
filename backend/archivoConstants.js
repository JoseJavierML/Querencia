const MAX_QUERY_LENGTH = 200;
const MAX_TITLE_LENGTH = 200;
const MAX_ARTIST_LENGTH = 200;
const MAX_ALBUM_LENGTH = 200;
const MAX_GENRE_LENGTH = 80;
const MAX_COVER_URL_LENGTH = 2048;
const MAX_SUMMARY_LENGTH = 4000;
const MAX_TAG_LENGTH = 80;
const MAX_TAGS = 16;
const MAX_LASTFM_ID_LENGTH = 128;
const MAX_LASTFM_URL_LENGTH = 2048;
const MAX_PUBLISHED_LENGTH = 64;
const MAX_CATALOG_KEY_LENGTH = 420;

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

const DEFAULT_CACHE_TTL_DAYS = 30;
const DEFAULT_HTTP_TIMEOUT_MS = 8000;
const DEFAULT_GROUPING = 'genero';

const UNCLASSIFIED_GENRE = 'Sin clasificar';

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_SEARCH_URL = 'https://www.youtube.com/results';
const LASTFM_PLACEHOLDER_IMAGE_HASH = '2a96cbd8b46e442fc41c2b86b821562f';

const GROUPING_ALIASES = Object.freeze({
    genero: 'genero',
    genre: 'genero',
    artista: 'artista',
    artist: 'artista'
});

const GENRE_DEFINITIONS = Object.freeze([
    Object.freeze({
        key: 'flamenco',
        label: 'Flamenco',
        aliases: Object.freeze([
            'flamenco',
            'flamenco fusion',
            'flamenco jazz',
            'nuevo flamenco',
            'copla',
            'copla flamenca',
            'bulerias',
            'buleria',
            'solea',
            'soleares',
            'seguiriyas',
            'seguiriya',
            'tangos flamencos',
            'fandangos',
            'alegrias',
            'sevillanas',
            'rumba flamenca',
            'cante jondo',
            'cante flamenco',
            'guitarra flamenca'
        ])
    }),
    Object.freeze({
        key: 'jazz',
        label: 'Jazz',
        aliases: Object.freeze([
            'jazz',
            'jazz vocal',
            'bebop',
            'swing',
            'cool jazz',
            'free jazz',
            'latin jazz',
            'jazz fusion',
            'smooth jazz',
            'acid jazz'
        ])
    }),
    Object.freeze({
        key: 'blues',
        label: 'Blues',
        aliases: Object.freeze([
            'blues',
            'delta blues',
            'chicago blues',
            'electric blues',
            'country blues'
        ])
    }),
    Object.freeze({
        key: 'rock',
        label: 'Rock',
        aliases: Object.freeze([
            'rock',
            'classic rock',
            'hard rock',
            'progressive rock',
            'indie rock',
            'alternative rock',
            'punk',
            'post punk',
            'grunge',
            'metal',
            'heavy metal',
            'rock and roll',
            'rockabilly',
            'psychedelic rock'
        ])
    }),
    Object.freeze({
        key: 'pop',
        label: 'Pop',
        aliases: Object.freeze([
            'pop',
            'pop rock',
            'synthpop',
            'indie pop',
            'dream pop',
            'art pop',
            'cancion de autor',
            'singer songwriter',
            'chanson',
            'cantautor'
        ])
    }),
    Object.freeze({
        key: 'clasica',
        label: 'Clásica',
        aliases: Object.freeze([
            'classical',
            'clasica',
            'opera',
            'baroque',
            'barroco',
            'romanticism',
            'romanticismo',
            'orchestra',
            'orquesta',
            'piano clasico',
            'chamber music',
            'musica de camara'
        ])
    }),
    Object.freeze({
        key: 'electronica',
        label: 'Electrónica',
        aliases: Object.freeze([
            'electronic',
            'electronica',
            'ambient',
            'techno',
            'house',
            'deep house',
            'trip hop',
            'downtempo',
            'idm',
            'electronica experimental',
            'synthwave'
        ])
    }),
    Object.freeze({
        key: 'world',
        label: 'Músicas del mundo',
        aliases: Object.freeze([
            'world',
            'world music',
            'latin',
            'latin music',
            'salsa',
            'bossa nova',
            'tango',
            'fado',
            'folk',
            'folk rock',
            'musica tradicional',
            'musica del mundo',
            'afrobeat',
            'reggae'
        ])
    }),
    Object.freeze({
        key: 'soul',
        label: 'Soul y funk',
        aliases: Object.freeze([
            'soul',
            'funk',
            'r&b',
            'rhythm and blues',
            'gospel',
            'neo soul',
            'motown'
        ])
    })
]);

const IGNORED_TAGS = Object.freeze([
    'seen live',
    'favorites',
    'favourite',
    'favorite',
    'spotify',
    'lastfm',
    'love',
    'awesome',
    'good',
    'great',
    'british',
    'american',
    'male vocalists',
    'female vocalists',
    'spanish',
    'espana',
    'spain'
]);

module.exports = {
    MAX_QUERY_LENGTH,
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_ALBUM_LENGTH,
    MAX_GENRE_LENGTH,
    MAX_COVER_URL_LENGTH,
    MAX_SUMMARY_LENGTH,
    MAX_TAG_LENGTH,
    MAX_TAGS,
    MAX_LASTFM_ID_LENGTH,
    MAX_LASTFM_URL_LENGTH,
    MAX_PUBLISHED_LENGTH,
    MAX_CATALOG_KEY_LENGTH,
    YOUTUBE_VIDEO_ID_PATTERN,
    OBJECT_ID_PATTERN,
    DEFAULT_CACHE_TTL_DAYS,
    DEFAULT_HTTP_TIMEOUT_MS,
    DEFAULT_GROUPING,
    UNCLASSIFIED_GENRE,
    LASTFM_API_URL,
    YOUTUBE_API_URL,
    YOUTUBE_SEARCH_URL,
    LASTFM_PLACEHOLDER_IMAGE_HASH,
    GROUPING_ALIASES,
    GENRE_DEFINITIONS,
    IGNORED_TAGS
};
