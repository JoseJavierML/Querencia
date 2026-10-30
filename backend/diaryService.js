const DEFAULT_MAX_TEXT_LENGTH = 5000;

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

    const createEntry = async ({ email, text } = {}) => {
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

        const userId = await resolveUserId(email);
        return diaryRepository.create({ text: normalizedText, userId });
    };

    const listEntries = async ({ email } = {}) => {
        const userId = await resolveUserId(email);
        return diaryRepository.findByUserId(userId);
    };

    return { createEntry, listEntries };
};

module.exports = {
    createDiaryService,
    DiaryValidationError,
    DiaryUserNotFoundError,
    DEFAULT_MAX_TEXT_LENGTH
};
