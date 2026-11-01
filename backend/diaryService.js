const DEFAULT_MAX_TEXT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 50;

class DiaryValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DiaryValidationError';
    }
}

class DiaryUserNotFoundError extends Error {
    constructor(message = 'No existe un usuario asociado a la sesión') {
        super(message);
        this.name = 'DiaryUserNotFoundError';
    }
}

class DiaryEntryNotFoundError extends Error {
    constructor(message = 'Entrada del diario no encontrada') {
        super(message);
        this.name = 'DiaryEntryNotFoundError';
    }
}

const createDiaryService = ({
    diaryRepository,
    userRepository,
    maxTextLength = DEFAULT_MAX_TEXT_LENGTH
}) => {
    if (!diaryRepository) {
        throw new Error('diaryRepository es obligatorio');
    }
    if (!userRepository) {
        throw new Error('userRepository es obligatorio');
    }

    const parsedLimit = Number(maxTextLength);
    const textLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, DEFAULT_MAX_TEXT_LENGTH)
        : DEFAULT_MAX_TEXT_LENGTH;

    const resolveUserId = async (email) => {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new DiaryUserNotFoundError();
        }
        return user._id;
    };

    const createEntry = async ({ email, text, title } = {}) => {
        if (typeof text !== 'string') {
            throw new DiaryValidationError('El texto es obligatorio');
        }

        const normalizedText = text.trim();
        if (normalizedText.length === 0) {
            throw new DiaryValidationError('El texto no puede estar vacío');
        }
        if (normalizedText.length > textLimit) {
            throw new DiaryValidationError(`El texto no puede superar los ${textLimit} caracteres`);
        }

        if (title !== undefined && title !== null && typeof title !== 'string') {
            throw new DiaryValidationError('El título debe ser texto');
        }
        const normalizedTitle = typeof title === 'string' ? title.trim() : '';
        if (normalizedTitle.length > MAX_TITLE_LENGTH) {
            throw new DiaryValidationError(`El título no puede superar los ${MAX_TITLE_LENGTH} caracteres`);
        }

        const userId = await resolveUserId(email);
        return diaryRepository.create({
            text: normalizedText,
            title: normalizedTitle,
            userId
        });
    };

    const listEntries = async ({ email } = {}) => {
        const userId = await resolveUserId(email);
        return diaryRepository.findByUserId(userId);
    };

    const deleteEntry = async ({ email, id } = {}) => {
        const userId = await resolveUserId(email);
        const deletedEntry = await diaryRepository.deleteByIdForUser(id, userId);
        if (!deletedEntry) {
            throw new DiaryEntryNotFoundError();
        }
        return deletedEntry;
    };

    return { createEntry, listEntries, deleteEntry };
};

module.exports = {
    createDiaryService,
    DiaryValidationError,
    DiaryUserNotFoundError,
    DiaryEntryNotFoundError,
    DEFAULT_MAX_TEXT_LENGTH,
    MAX_TITLE_LENGTH
};
