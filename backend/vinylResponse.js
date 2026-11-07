const { UNCLASSIFIED_GENRE } = require('./archivoConstants');

const VINYL_POPULATE_FIELDS = 'title artist album coverUrl genre youtubeVideoId';

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

const resolveVinylSummary = (source = {}) => {
    const candidate = source && typeof source === 'object'
        ? source.vinyl || source.vinylId
        : null;

    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
    }
    if (!candidate.title && !candidate.artist) {
        return null;
    }

    return toVinylSummary(candidate);
};

module.exports = {
    VINYL_POPULATE_FIELDS,
    toVinylSummary,
    resolveVinylSummary
};
