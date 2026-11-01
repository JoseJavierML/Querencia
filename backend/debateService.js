const {
    REACTION_TYPES,
    MAX_TITLE_LENGTH,
    MAX_CONTENT_LENGTH,
    MAX_COVER_URL_LENGTH
} = require('./debateConstants');

class DebateValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DebateValidationError';
    }
}

class DebateUserNotFoundError extends Error {
    constructor(message = 'No existe un usuario asociado a la sesión') {
        super(message);
        this.name = 'DebateUserNotFoundError';
    }
}

class DebateNotFoundError extends Error {
    constructor(message = 'Debate no encontrado') {
        super(message);
        this.name = 'DebateNotFoundError';
    }
}

const normalizeTitle = (title) => {
    if (typeof title !== 'string') {
        throw new DebateValidationError('El título es obligatorio');
    }

    const normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
        throw new DebateValidationError('El título no puede estar vacío');
    }
    if (normalizedTitle.length > MAX_TITLE_LENGTH) {
        throw new DebateValidationError(`El título no puede superar los ${MAX_TITLE_LENGTH} caracteres`);
    }

    return normalizedTitle;
};

const normalizeContent = (content) => {
    if (typeof content !== 'string') {
        throw new DebateValidationError('El contenido es obligatorio');
    }

    const normalizedContent = content.trim();
    if (normalizedContent.length === 0) {
        throw new DebateValidationError('El contenido no puede estar vacío');
    }
    if (normalizedContent.length > MAX_CONTENT_LENGTH) {
        throw new DebateValidationError(`El contenido no puede superar los ${MAX_CONTENT_LENGTH} caracteres`);
    }

    return normalizedContent;
};

const normalizeCoverImageUrl = (coverImageUrl) => {
    if (coverImageUrl === undefined || coverImageUrl === null) {
        return null;
    }
    if (typeof coverImageUrl !== 'string') {
        throw new DebateValidationError('La URL de la portada no es válida');
    }

    const normalizedUrl = coverImageUrl.trim();
    if (normalizedUrl.length === 0) {
        return null;
    }
    if (normalizedUrl.length > MAX_COVER_URL_LENGTH) {
        throw new DebateValidationError(
            `La URL de la portada no puede superar los ${MAX_COVER_URL_LENGTH} caracteres`
        );
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(normalizedUrl);
    } catch (error) {
        throw new DebateValidationError('La URL de la portada no es válida');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new DebateValidationError('La URL de la portada debe empezar por http o https');
    }

    return normalizedUrl;
};

const createDebateService = ({ debateRepository, userRepository }) => {
    if (!debateRepository) {
        throw new Error('debateRepository es obligatorio');
    }
    if (!userRepository) {
        throw new Error('userRepository es obligatorio');
    }

    const resolveUserId = async (email) => {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new DebateUserNotFoundError();
        }
        return user._id;
    };

    const createDebate = async ({ email, title, content, coverImageUrl } = {}) => {
        const normalizedTitle = normalizeTitle(title);
        const normalizedContent = normalizeContent(content);
        const normalizedCoverImageUrl = normalizeCoverImageUrl(coverImageUrl);
        const authorId = await resolveUserId(email);

        return debateRepository.create({
            title: normalizedTitle,
            content: normalizedContent,
            coverImageUrl: normalizedCoverImageUrl,
            authorId
        });
    };

    const listDebates = async ({ email } = {}) => {
        let viewerId = null;

        if (email) {
            viewerId = await resolveUserId(email);
        }

        const debates = await debateRepository.findAll();
        return { debates, viewerId };
    };

    const reactToDebate = async ({ email, id, reaction } = {}) => {
        if (!REACTION_TYPES.includes(reaction)) {
            throw new DebateValidationError('La reacción no es válida');
        }

        const userId = await resolveUserId(email);
        const result = await debateRepository.toggleReaction(id, reaction, userId);

        if (!result) {
            throw new DebateNotFoundError();
        }

        return {
            debate: result.debate,
            reacted: result.reacted,
            viewerId: userId
        };
    };

    const deleteDebate = async ({ id } = {}) => {
        const deletedDebate = await debateRepository.deleteById(id);

        if (!deletedDebate) {
            throw new DebateNotFoundError();
        }

        return deletedDebate;
    };

    return {
        createDebate,
        listDebates,
        reactToDebate,
        deleteDebate
    };
};

module.exports = {
    createDebateService,
    DebateValidationError,
    DebateUserNotFoundError,
    DebateNotFoundError
};
