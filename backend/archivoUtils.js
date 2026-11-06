const {
    MAX_COVER_URL_LENGTH,
    MAX_TAG_LENGTH,
    MAX_TAGS,
    OBJECT_ID_PATTERN,
    LASTFM_PLACEHOLDER_IMAGE_HASH,
    GENRE_DEFINITIONS,
    IGNORED_TAGS,
    UNCLASSIFIED_GENRE
} = require('./archivoConstants');

const asArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }
    if (value === undefined || value === null || value === '') {
        return [];
    }
    return [value];
};

const normalizeForComparison = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
};

const slugify = (value) => {
    const normalized = normalizeForComparison(value)
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 180);

    return normalized || 'sin-clasificar';
};

const buildCatalogKey = (artist, title) => {
    const normalizedArtist = slugify(artist);
    const normalizedTitle = slugify(title);

    if (normalizedArtist === 'sin-clasificar' || normalizedTitle === 'sin-clasificar') {
        return '';
    }

    return `${normalizedArtist}::${normalizedTitle}`;
};

const decodeHtmlEntities = (value) => value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');

const stripHtml = (value) => {
    if (typeof value !== 'string') {
        return '';
    }

    const withoutTags = value.replace(/<[^>]*>/g, ' ');
    return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
};

const sanitizeUrl = (value, maxLength = MAX_COVER_URL_LENGTH) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
        return null;
    }

    try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
    } catch (error) {
        return null;
    }

    return normalized;
};

const normalizeTags = (tags, { maxTags = MAX_TAGS, maxTagLength = MAX_TAG_LENGTH } = {}) => {
    const result = [];
    const seen = new Set();

    for (const rawTag of asArray(tags)) {
        const value = typeof rawTag === 'string'
            ? rawTag
            : rawTag && typeof rawTag.name === 'string'
                ? rawTag.name
                : '';

        const normalized = value.trim().replace(/\s+/g, ' ').slice(0, maxTagLength);
        if (!normalized) {
            continue;
        }

        const key = normalizeForComparison(normalized);
        if (!key || seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(normalized);
        if (result.length >= maxTags) {
            break;
        }
    }

    return result;
};

const toDisplayTag = (value) => value
    .split(' ')
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(' ');

const normalizeGenreFromTags = (tags) => {
    const normalizedTags = normalizeTags(tags);
    if (normalizedTags.length === 0) {
        return UNCLASSIFIED_GENRE;
    }

    const ignored = new Set(IGNORED_TAGS.map(normalizeForComparison));
    const usefulTags = normalizedTags.filter((tag) => !ignored.has(normalizeForComparison(tag)));
    if (usefulTags.length === 0) {
        return UNCLASSIFIED_GENRE;
    }

    const comparableTags = usefulTags.map(normalizeForComparison);
    let bestMatch = null;

    for (const definition of GENRE_DEFINITIONS) {
        for (const alias of definition.aliases) {
            const normalizedAlias = normalizeForComparison(alias);
            if (!normalizedAlias) {
                continue;
            }

            const exact = comparableTags.includes(normalizedAlias);
            const partial = comparableTags.some((tag) => tag.includes(normalizedAlias));

            if (!exact && !partial) {
                continue;
            }

            const candidate = {
                label: definition.label,
                exact,
                length: normalizedAlias.length
            };

            if (
                !bestMatch ||
                (candidate.exact && !bestMatch.exact) ||
                (candidate.exact === bestMatch.exact && candidate.length > bestMatch.length)
            ) {
                bestMatch = candidate;
            }
        }
    }

    if (bestMatch) {
        return bestMatch.label;
    }

    return toDisplayTag(usefulTags[0]);
};

const pickImage = (images) => {
    if (!Array.isArray(images)) {
        return null;
    }

    const preferredSizes = ['extralarge', 'large', 'medium', 'small'];
    const ordered = [];

    for (const size of preferredSizes) {
        const image = images.find((entry) => (
            entry && entry.size === size && typeof entry['#text'] === 'string' && entry['#text'].trim()
        ));
        if (image && !image['#text'].includes(LASTFM_PLACEHOLDER_IMAGE_HASH)) {
            ordered.push(image['#text']);
        }
    }

    for (const image of images) {
        if (image && typeof image === 'string' && !image.includes(LASTFM_PLACEHOLDER_IMAGE_HASH)) {
            ordered.push(image);
            continue;
        }
        if (
            image &&
            typeof image === 'object' &&
            typeof image['#text'] === 'string' &&
            image['#text'].trim() &&
            !image['#text'].includes(LASTFM_PLACEHOLDER_IMAGE_HASH)
        ) {
            ordered.push(image['#text']);
        }
    }

    for (const candidate of ordered) {
        const sanitized = sanitizeUrl(candidate);
        if (sanitized) {
            return sanitized;
        }
    }

    return null;
};

const parseNonNegativeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
};

const isValidYouTubeVideoId = (value) => (
    typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value.trim())
);

const extractYouTubeVideoId = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (isValidYouTubeVideoId(normalized)) {
        return normalized;
    }

    try {
        const url = new URL(normalized);
        if (url.hostname === 'youtu.be') {
            const candidate = url.pathname.split('/').filter(Boolean)[0];
            return isValidYouTubeVideoId(candidate) ? candidate : null;
        }

        const candidate = url.searchParams.get('v');
        if (isValidYouTubeVideoId(candidate)) {
            return candidate;
        }

        const embedMatch = url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
        return embedMatch ? embedMatch[1] : null;
    } catch (error) {
        return null;
    }
};

const isValidObjectId = (value) => (
    typeof value === 'string' && OBJECT_ID_PATTERN.test(value.trim())
);

module.exports = {
    asArray,
    normalizeForComparison,
    slugify,
    buildCatalogKey,
    stripHtml,
    sanitizeUrl,
    normalizeTags,
    normalizeGenreFromTags,
    pickImage,
    parseNonNegativeNumber,
    isValidYouTubeVideoId,
    extractYouTubeVideoId,
    isValidObjectId
};
