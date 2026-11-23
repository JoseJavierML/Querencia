const { OBJECT_ID_PATTERN } = require('./archivoConstants');

const isValidObjectId = (value) => (
    typeof value === 'string' && OBJECT_ID_PATTERN.test(value.trim())
);

const normalizeVinylId = async (vinylId, vinylRepository, ValidationError = Error) => {
    if (vinylId === undefined || vinylId === null || vinylId === '') {
        return null;
    }
    if (typeof vinylId !== 'string' || !isValidObjectId(vinylId)) {
        throw new ValidationError('El vinilo seleccionado no es válido');
    }

    const normalizedVinylId = vinylId.trim();
    if (vinylRepository) {
        const vinyl = await vinylRepository.findById(normalizedVinylId);
        if (!vinyl) {
            throw new ValidationError('El vinilo seleccionado no existe en El Archivo');
        }
    }

    return normalizedVinylId;
};

const resolveUserId = async (email, userRepository, UserNotFoundError = Error) => {
    const user = await userRepository.findByEmail(email);
    if (!user) {
        throw new UserNotFoundError();
    }
    return user._id;
};

const normalizeHttpUrl = (value, {
    field,
    maxLength,
    required = false,
    ValidationError = Error
}) => {
    if (value === undefined || value === null) {
        if (required) {
            throw new ValidationError(`${field} es obligatorio`);
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new ValidationError(`${field} no es válido`);
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
        if (required) {
            throw new ValidationError(`${field} es obligatorio`);
        }
        return null;
    }
    if (normalized.length > maxLength) {
        throw new ValidationError(`${field} no puede superar los ${maxLength} caracteres`);
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(normalized);
    } catch (error) {
        throw new ValidationError(`${field} no es válido`);
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new ValidationError(`${field} debe empezar por http o https`);
    }

    return normalized;
};

module.exports = {
    isValidObjectId,
    normalizeVinylId,
    resolveUserId,
    normalizeHttpUrl
};
