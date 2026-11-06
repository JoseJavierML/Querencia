const mongoose = require('mongoose');
const {
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
    UNCLASSIFIED_GENRE
} = require('./archivoConstants');
const { buildCatalogKey } = require('./archivoUtils');

const lastFmInfoSchema = new mongoose.Schema(
    {
        mbid: {
            type: String,
            trim: true,
            maxlength: MAX_LASTFM_ID_LENGTH,
            default: null
        },
        url: {
            type: String,
            trim: true,
            maxlength: MAX_LASTFM_URL_LENGTH,
            default: null
        },
        listeners: {
            type: Number,
            min: 0,
            default: 0
        },
        playcount: {
            type: Number,
            min: 0,
            default: 0
        },
        duration: {
            type: Number,
            min: 0,
            default: null
        },
        published: {
            type: String,
            trim: true,
            maxlength: MAX_PUBLISHED_LENGTH,
            default: null
        },
        summary: {
            type: String,
            trim: true,
            maxlength: MAX_SUMMARY_LENGTH,
            default: ''
        },
        tags: {
            type: [String],
            default: [],
            validate: {
                validator: (tags) => (
                    Array.isArray(tags) &&
                    tags.length <= MAX_TAGS &&
                    tags.every((tag) => typeof tag === 'string' && tag.trim().length <= MAX_TAG_LENGTH)
                ),
                message: `Las etiquetas no pueden superar las ${MAX_TAGS} entradas de ${MAX_TAG_LENGTH} caracteres`
            }
        },
        album: {
            type: String,
            trim: true,
            maxlength: MAX_ALBUM_LENGTH,
            default: null
        },
        fetchedAt: {
            type: Date,
            default: null
        }
    },
    { _id: false }
);

const vinylSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_TITLE_LENGTH
        },
        artist: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_ARTIST_LENGTH
        },
        album: {
            type: String,
            trim: true,
            maxlength: MAX_ALBUM_LENGTH,
            default: null
        },
        coverUrl: {
            type: String,
            trim: true,
            maxlength: MAX_COVER_URL_LENGTH,
            default: null
        },
        genre: {
            type: String,
            trim: true,
            maxlength: MAX_GENRE_LENGTH,
            default: UNCLASSIFIED_GENRE
        },
        youtubeVideoId: {
            type: String,
            trim: true,
            default: null,
            validate: {
                validator: (value) => (
                    value === null ||
                    value === undefined ||
                    YOUTUBE_VIDEO_ID_PATTERN.test(value)
                ),
                message: 'El identificador de YouTube no tiene un formato válido'
            }
        },
        lastFmInfo: {
            type: lastFmInfoSchema,
            default: () => ({})
        },
        catalogKey: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: MAX_CATALOG_KEY_LENGTH
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        },
        updatedAt: {
            type: Date,
            default: Date.now
        },
        lastAccessedAt: {
            type: Date,
            default: null
        }
    },
    { versionKey: false }
);

vinylSchema.pre('validate', function preValidateVinyl() {
    if (this.artist && this.title) {
        this.catalogKey = buildCatalogKey(this.artist, this.title);
    }

    if (typeof this.genre !== 'string' || this.genre.trim().length === 0) {
        this.genre = UNCLASSIFIED_GENRE;
    }
});

vinylSchema.index({ genre: 1, artist: 1, title: 1 });

const Vinyl = mongoose.models.Vinyl || mongoose.model('Vinyl', vinylSchema);

const VinylRepository = {
    findByCatalogKey: async (catalogKey) => {
        if (typeof catalogKey !== 'string' || catalogKey.trim().length === 0) {
            return null;
        }

        return Vinyl.findOne({ catalogKey: catalogKey.trim() }).lean();
    },

    findById: async (id) => {
        if (!mongoose.isValidObjectId(id)) {
            return null;
        }

        return Vinyl.findById(id).lean();
    },

    findAll: async ({ genre, artist } = {}) => {
        const filter = {};

        if (typeof genre === 'string' && genre.trim().length > 0) {
            filter.genre = genre.trim();
        }
        if (typeof artist === 'string' && artist.trim().length > 0) {
            filter.artist = artist.trim();
        }

        return Vinyl.find(filter)
            .sort({ artist: 1, title: 1 })
            .lean();
    },

    create: async (data) => {
        const vinyl = new Vinyl(data);
        await vinyl.save();
        return vinyl;
    },

    upsertByCatalogKey: async (data) => {
        if (!data || typeof data.catalogKey !== 'string' || data.catalogKey.trim().length === 0) {
            throw new Error('catalogKey es obligatorio para guardar un vinilo');
        }

        const now = new Date();
        const payload = {
            ...data,
            catalogKey: data.catalogKey.trim(),
            updatedAt: now
        };
        delete payload.createdAt;

        return Vinyl.findOneAndUpdate(
            { catalogKey: payload.catalogKey },
            {
                $set: payload,
                $setOnInsert: { createdAt: now }
            },
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        ).lean();
    },

    updateById: async (id, updates) => {
        if (!mongoose.isValidObjectId(id)) {
            return null;
        }

        return Vinyl.findByIdAndUpdate(
            id,
            {
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: true }
        ).lean();
    },

    touchById: async (id) => {
        if (!mongoose.isValidObjectId(id)) {
            return null;
        }

        return Vinyl.findByIdAndUpdate(
            id,
            { $set: { lastAccessedAt: new Date() } },
            { new: true }
        ).lean();
    }
};

module.exports = { Vinyl, VinylRepository };
