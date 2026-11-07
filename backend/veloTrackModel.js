const mongoose = require('mongoose');
const {
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_AUDIO_URL_LENGTH,
    MAX_COVER_URL_LENGTH,
    MAX_REFLECTION_LENGTH
} = require('./veloConstants');
const { VINYL_POPULATE_FIELDS } = require('./vinylResponse');

const veloReflectionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_REFLECTION_LENGTH
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        }
    },
    { versionKey: false }
);

const veloTrackSchema = new mongoose.Schema(
    {
        releaseDate: {
            type: Date,
            required: true,
            unique: true
        },
        audioUrl: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_AUDIO_URL_LENGTH
        },
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
        coverUrl: {
            type: String,
            trim: true,
            maxlength: MAX_COVER_URL_LENGTH,
            default: null
        },
        vinylId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vinyl',
            default: null,
            index: true
        },
        reflections: {
            type: [veloReflectionSchema],
            default: []
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        }
    },
    { versionKey: false }
);

const VeloTrack = mongoose.models.VeloTrack || mongoose.model('VeloTrack', veloTrackSchema);

const VeloRepository = {
    create: async ({ releaseDate, audioUrl, title, artist, coverUrl = null, vinylId = null }) => {
        const track = new VeloTrack({ releaseDate, audioUrl, title, artist, coverUrl, vinylId });
        await track.save();
        return track;
    },

    findByReleaseDate: async (releaseDate) => {
        if (!(releaseDate instanceof Date) || Number.isNaN(releaseDate.getTime())) {
            return null;
        }

        const start = new Date(releaseDate);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);

        return VeloTrack.findOne({
            releaseDate: { $gte: start, $lt: end }
        })
            .populate('vinylId', VINYL_POPULATE_FIELDS)
            .lean();
    },

    findById: async (id) => {
        if (!mongoose.isValidObjectId(id)) {
            return null;
        }

        return VeloTrack.findById(id)
            .populate('vinylId', VINYL_POPULATE_FIELDS)
            .lean();
    },

    findAll: async () => {
        return VeloTrack.find({})
            .sort({ releaseDate: 1 })
            .populate('vinylId', VINYL_POPULATE_FIELDS)
            .lean();
    },

    updateById: async (id, updates) => {
        if (!mongoose.isValidObjectId(id)) {
            return null;
        }

        return VeloTrack.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true
        }).lean();
    },

    addReflection: async (id, userId, text) => {
        if (!mongoose.isValidObjectId(id)) {
            return { track: null, alreadyReflected: false };
        }

        const updatedTrack = await VeloTrack.findOneAndUpdate(
            { _id: id, 'reflections.userId': { $ne: userId } },
            { $push: { reflections: { userId, text } } },
            { new: true }
        )
            .populate('vinylId', VINYL_POPULATE_FIELDS)
            .lean();

        if (updatedTrack) {
            return { track: updatedTrack, alreadyReflected: false };
        }

        const trackExists = await VeloTrack.exists({ _id: id });
        return { track: null, alreadyReflected: Boolean(trackExists) };
    }
};

module.exports = { VeloTrack, VeloRepository };
