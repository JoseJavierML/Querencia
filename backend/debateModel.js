const mongoose = require('mongoose');
const {
    REACTION_TYPES,
    MAX_TITLE_LENGTH,
    MAX_CONTENT_LENGTH
} = require('./debateConstants');

const reactionSchema = new mongoose.Schema(
    REACTION_TYPES.reduce((schema, reaction) => {
        schema[reaction] = {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            default: []
        };
        return schema;
    }, {}),
    { _id: false }
);

const debateSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_TITLE_LENGTH
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: MAX_CONTENT_LENGTH
        },
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        },
        reactions: {
            type: reactionSchema,
            default: () => ({})
        }
    },
    { versionKey: false }
);

const Debate = mongoose.models.Debate || mongoose.model('Debate', debateSchema);

const DebateRepository = {
    create: async ({ title, content, authorId }) => {
        const debate = new Debate({ title, content, authorId });
        await debate.save();
        return debate;
    },

    findAll: async () => {
        return Debate.find({})
            .sort({ createdAt: -1 })
            .populate('authorId', 'email')
            .lean();
    },

    toggleReaction: async (id, reaction, userId) => {
        if (!mongoose.isValidObjectId(id) || !REACTION_TYPES.includes(reaction)) {
            return null;
        }

        const reactionPath = `reactions.${reaction}`;

        const removed = await Debate.findOneAndUpdate(
            { _id: id, [reactionPath]: userId },
            { $pull: { [reactionPath]: userId } },
            { new: true }
        );

        if (removed) {
            return { debate: removed, reacted: false };
        }

        const added = await Debate.findOneAndUpdate(
            { _id: id },
            { $addToSet: { [reactionPath]: userId } },
            { new: true }
        );

        if (!added) {
            return null;
        }

        return { debate: added, reacted: true };
    }
};

module.exports = { Debate, DebateRepository };
