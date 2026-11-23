const { parseNonNegativeNumber } = require('./archivoUtils');
const { toVinylSummary } = require('./vinylResponse');

const toVinylResponse = (vinyl = {}) => {
    const lastFmInfo = vinyl.lastFmInfo || {};
    const tags = Array.isArray(lastFmInfo.tags)
        ? lastFmInfo.tags.filter((tag) => typeof tag === 'string')
        : [];

    return {
        ...toVinylSummary(vinyl),
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

module.exports = {
    toVinylResponse
};
