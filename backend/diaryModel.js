const mongoose = require('mongoose');

const diaryEntrySchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
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
    create: async ({ text, userId }) => {
        const entry = new DiaryEntry({ text, userId });
        await entry.save();
        return entry;
    },

    findByUserId: async (userId) => {
        return DiaryEntry.find({ userId }).sort({ createdAt: -1 }).lean();
    }
};

module.exports = { DiaryEntry, DiaryRepository };
