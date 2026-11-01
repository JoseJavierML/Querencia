const express = require('express');
const {
    DiaryValidationError,
    DiaryUserNotFoundError,
    DiaryEntryNotFoundError
} = require('./diaryService');

const toEntryResponse = (entry) => ({
    _id: entry._id,
    text: entry.text,
    title: entry.title || '',
    createdAt: entry.createdAt,
    userId: entry.userId
});

const createDiaryRouter = ({ diaryService, authMiddleware }) => {
    if (!diaryService) {
        throw new Error('diaryService es obligatorio');
    }
    if (typeof authMiddleware !== 'function') {
        throw new Error('authMiddleware es obligatorio');
    }

    const router = express.Router();

    router.post('/', authMiddleware, async (req, res) => {
        try {
            const entry = await diaryService.createEntry({
                email: req.user.email,
                text: req.body ? req.body.text : undefined,
                title: req.body ? req.body.title : undefined
            });
            return res.status(201).json(toEntryResponse(entry));
        } catch (error) {
            if (error instanceof DiaryValidationError) {
                return res.status(400).json({ message: error.message });
            }
            if (error instanceof DiaryUserNotFoundError) {
                return res.status(401).json({ message: error.message });
            }
            return res.status(500).json({ message: 'No se pudo guardar la entrada del diario' });
        }
    });

    router.get('/', authMiddleware, async (req, res) => {
        try {
            const entries = await diaryService.listEntries({ email: req.user.email });
            return res.status(200).json(entries.map(toEntryResponse));
        } catch (error) {
            if (error instanceof DiaryUserNotFoundError) {
                return res.status(401).json({ message: error.message });
            }
            return res.status(500).json({ message: 'No se pudieron obtener las entradas del diario' });
        }
    });

    router.delete('/:id', authMiddleware, async (req, res) => {
        try {
            await diaryService.deleteEntry({
                email: req.user.email,
                id: req.params.id
            });
            return res.status(200).json({ message: 'Eco eliminado correctamente' });
        } catch (error) {
            if (error instanceof DiaryEntryNotFoundError) {
                return res.status(404).json({ message: error.message });
            }
            if (error instanceof DiaryUserNotFoundError) {
                return res.status(401).json({ message: error.message });
            }
            return res.status(500).json({ message: 'No se pudo eliminar la entrada del diario' });
        }
    });

    return router;
};

module.exports = { createDiaryRouter };
