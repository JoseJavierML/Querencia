const mongoose = require('mongoose');

const diaryEntrySchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
        },
        title: {
            type: String,
            trim: true,
            maxlength: 50,
            default: ''
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            immutable: true
        }
    },
    { versionKey: false }
);

const DiaryEntry = mongoose.models.DiaryEntry || mongoose.model('DiaryEntry', diaryEntrySchema);

const DiaryRepository = {
    create: async ({ text, title = '', userId }) => {
        const entry = new DiaryEntry({ text, title, userId });
        await entry.save();
        return entry;
    },

    findByUserId: async (userId) => {
        return DiaryEntry.find({ userId }).sort({ createdAt: -1 }).lean();
    },

    deleteByIdForUser: async (id, userId) => {
        if (!mongoose.isValidObjectId(id)) {
            return null;
        }
        return DiaryEntry.findOneAndDelete({ _id: id, userId });
    }
};

module.exports = { DiaryEntry, DiaryRepository };
