const {
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_AUDIO_URL_LENGTH,
    MAX_COVER_URL_LENGTH,
    MAX_REFLECTION_LENGTH,
    VELO_TIME_ZONE
} = require('./veloConstants');
const { isValidObjectId } = require('./archivoUtils');
const { toVinylSummary } = require('./vinylResponse');

class VeloValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'VeloValidationError';
    }
}

class VeloUserNotFoundError extends Error {
    constructor(message = 'No existe un usuario asociado a la sesión') {
        super(message);
        this.name = 'VeloUserNotFoundError';
    }
}

class VeloTrackNotFoundError extends Error {
    constructor(message = 'No hay una pista programada para hoy') {
        super(message);
        this.name = 'VeloTrackNotFoundError';
    }
}

class VeloAlreadyReflectedError extends Error {
    constructor(message = 'Ya has enviado tu reflexión para la pista de hoy') {
        super(message);
        this.name = 'VeloAlreadyReflectedError';
    }
}

class VeloDuplicateDateError extends Error {
    constructor(message = 'Ya existe una pista programada para esa fecha') {
        super(message);
        this.name = 'VeloDuplicateDateError';
    }
}

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const getDateKeyInTimeZone = (date, timeZone) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        throw new VeloValidationError('La fecha de publicación no es válida');
    }

    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year').value;
    const month = parts.find((part) => part.type === 'month').value;
    const day = parts.find((part) => part.type === 'day').value;

    return `${year}-${month}-${day}`;
};

const toUtcMidnight = (dateKey) => {
    const match = DATE_KEY_PATTERN.exec(dateKey);
    if (!match) {
        throw new VeloValidationError('La fecha de publicación no es válida');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new VeloValidationError('La fecha de publicación no es válida');
    }

    return date;
};

const normalizeReleaseDate = (releaseDate, timeZone) => {
    if (releaseDate instanceof Date) {
        if (Number.isNaN(releaseDate.getTime())) {
            throw new VeloValidationError('La fecha de publicación no es válida');
        }
        return toUtcMidnight(getDateKeyInTimeZone(releaseDate, timeZone));
    }

    if (typeof releaseDate !== 'string') {
        throw new VeloValidationError('La fecha de publicación es obligatoria');
    }

    const normalized = releaseDate.trim();
    if (normalized.length === 0) {
        throw new VeloValidationError('La fecha de publicación es obligatoria');
    }

    if (DATE_KEY_PATTERN.test(normalized)) {
        return toUtcMidnight(normalized);
    }

    const parsedDate = new Date(normalized);
    if (Number.isNaN(parsedDate.getTime())) {
        throw new VeloValidationError('La fecha de publicación no es válida');
    }

    return toUtcMidnight(getDateKeyInTimeZone(parsedDate, timeZone));
};

const normalizeText = (value, { field, maxLength }) => {
    if (typeof value !== 'string') {
        throw new VeloValidationError(`${field} es obligatorio`);
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new VeloValidationError(`${field} no puede estar vacío`);
    }
    if (normalized.length > maxLength) {
        throw new VeloValidationError(`${field} no puede superar los ${maxLength} caracteres`);
    }

    return normalized;
};

const normalizeUrl = (value, { field, maxLength, required }) => {
    if (value === undefined || value === null) {
        if (required) {
            throw new VeloValidationError(`${field} es obligatorio`);
        }
        return null;
    }
    if (typeof value !== 'string') {
        throw new VeloValidationError(`${field} no es válido`);
    }

    const normalized = value.trim();
    if (normalized.length === 0) {
        if (required) {
            throw new VeloValidationError(`${field} es obligatorio`);
        }
        return null;
    }
    if (normalized.length > maxLength) {
        throw new VeloValidationError(`${field} no puede superar los ${maxLength} caracteres`);
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(normalized);
    } catch (error) {
        throw new VeloValidationError(`${field} no es válido`);
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new VeloValidationError(`${field} debe empezar por http o https`);
    }

    return normalized;
};

const normalizeTitle = (title) => normalizeText(title, {
    field: 'El título',
    maxLength: MAX_TITLE_LENGTH
});

const normalizeArtist = (artist) => normalizeText(artist, {
    field: 'El artista',
    maxLength: MAX_ARTIST_LENGTH
});

const normalizeAudioUrl = (audioUrl) => normalizeUrl(audioUrl, {
    field: 'La URL del audio',
    maxLength: MAX_AUDIO_URL_LENGTH,
    required: true
});

const normalizeCoverUrl = (coverUrl) => normalizeUrl(coverUrl, {
    field: 'La URL de la portada',
    maxLength: MAX_COVER_URL_LENGTH,
    required: false
});

const normalizeReflection = (text) => normalizeText(text, {
    field: 'La reflexión',
    maxLength: MAX_REFLECTION_LENGTH
});

const normalizeVinylId = async (vinylId, vinylRepository) => {
    if (vinylId === undefined || vinylId === null || vinylId === '') {
        return null;
    }
    if (typeof vinylId !== 'string' || !isValidObjectId(vinylId)) {
        throw new VeloValidationError('El vinilo seleccionado no es válido');
    }

    const normalizedVinylId = vinylId.trim();
    if (vinylRepository) {
        const vinyl = await vinylRepository.findById(normalizedVinylId);
        if (!vinyl) {
            throw new VeloValidationError('El vinilo seleccionado no existe en El Archivo');
        }
    }

    return normalizedVinylId;
};

const createVeloService = ({
    veloRepository,
    userRepository,
    vinylRepository,
    now = () => new Date(),
    timeZone = VELO_TIME_ZONE
} = {}) => {
    if (!veloRepository) {
        throw new Error('veloRepository es obligatorio');
    }
    if (!userRepository) {
        throw new Error('userRepository es obligatorio');
    }

    const getTodayStart = () => toUtcMidnight(getDateKeyInTimeZone(now(), timeZone));

    const normalizeDateAgainstToday = (releaseDate, todayStart) => {
        const normalizedDate = normalizeReleaseDate(releaseDate, timeZone);
        if (normalizedDate.getTime() < todayStart.getTime()) {
            throw new VeloValidationError('La fecha de publicación no puede ser anterior a hoy');
        }
        return normalizedDate;
    };

    const getTrackStatus = (releaseDate, todayStart) => {
        const trackDate = new Date(releaseDate);
        if (Number.isNaN(trackDate.getTime())) {
            throw new VeloValidationError('La fecha de la pista no es válida');
        }

        const trackStart = toUtcMidnight(getDateKeyInTimeZone(trackDate, timeZone));
        if (trackStart.getTime() === todayStart.getTime()) {
            return 'today';
        }
        return trackStart.getTime() < todayStart.getTime() ? 'past' : 'future';
    };

    const resolveUserId = async (email) => {
        const user = await userRepository.findByEmail(email);
        if (!user) {
            throw new VeloUserNotFoundError();
        }
        return user._id;
    };

    const getToday = async ({ email } = {}) => {
        const viewerId = await resolveUserId(email);
        const todayStart = getTodayStart();
        const track = await veloRepository.findByReleaseDate(todayStart);

        if (!track) {
            throw new VeloTrackNotFoundError();
        }

        const hasReflected = (track.reflections || []).some(
            (reflection) => String(reflection.userId) === String(viewerId)
        );

        return { track, hasReflected, viewerId };
    };

    const reflect = async ({ email, text } = {}) => {
        const normalizedText = normalizeReflection(text);
        const viewerId = await resolveUserId(email);
        const todayStart = getTodayStart();
        const track = await veloRepository.findByReleaseDate(todayStart);

        if (!track) {
            throw new VeloTrackNotFoundError();
        }

        const alreadyReflected = (track.reflections || []).some(
            (reflection) => String(reflection.userId) === String(viewerId)
        );
        if (alreadyReflected) {
            throw new VeloAlreadyReflectedError();
        }

        const result = await veloRepository.addReflection(track._id, viewerId, normalizedText);
        if (!result || (!result.track && !result.alreadyReflected)) {
            throw new VeloTrackNotFoundError();
        }
        if (result.alreadyReflected) {
            throw new VeloAlreadyReflectedError();
        }

        return { track: result.track, viewerId };
    };

    const createTrack = async ({
        releaseDate,
        audioUrl,
        title,
        artist,
        coverUrl,
        vinylId
    } = {}) => {
        const todayStart = getTodayStart();
        const normalizedReleaseDate = normalizeDateAgainstToday(releaseDate, todayStart);
        const normalizedTitle = normalizeTitle(title);
        const normalizedArtist = normalizeArtist(artist);
        const normalizedAudioUrl = normalizeAudioUrl(audioUrl);
        const normalizedCoverUrl = normalizeCoverUrl(coverUrl);
        const normalizedVinylId = await normalizeVinylId(vinylId, vinylRepository);

        const existingTrack = await veloRepository.findByReleaseDate(normalizedReleaseDate);
        if (existingTrack) {
            throw new VeloDuplicateDateError();
        }

        let track;
        try {
            track = await veloRepository.create({
                releaseDate: normalizedReleaseDate,
                audioUrl: normalizedAudioUrl,
                title: normalizedTitle,
                artist: normalizedArtist,
                coverUrl: normalizedCoverUrl,
                ...(normalizedVinylId ? { vinylId: normalizedVinylId } : {})
            });
        } catch (error) {
            if (error && error.code === 11000) {
                throw new VeloDuplicateDateError();
            }
            throw error;
        }

        if (normalizedVinylId && vinylRepository && track) {
            const vinyl = await vinylRepository.findById(normalizedVinylId);
            if (vinyl) {
                const plainTrack = typeof track.toObject === 'function'
                    ? track.toObject()
                    : track;
                track = { ...plainTrack, vinyl };
            }
        }

        return {
            track,
            status: getTrackStatus(normalizedReleaseDate, todayStart)
        };
    };

    const listTracks = async () => {
        const tracks = await veloRepository.findAll();
        const todayStart = getTodayStart();

        return tracks.map((track) => ({
            ...track,
            status: getTrackStatus(track.releaseDate, todayStart)
        }));
    };

    const updateTrack = async ({
        id,
        releaseDate,
        audioUrl,
        title,
        artist,
        coverUrl,
        vinylId
    } = {}) => {
        const track = await veloRepository.findById(id);
        if (!track) {
            throw new VeloTrackNotFoundError('La pista no existe');
        }

        const todayStart = getTodayStart();
        const currentDate = new Date(track.releaseDate);
        if (currentDate.getTime() < todayStart.getTime()) {
            throw new VeloValidationError('No se puede editar una pista pasada');
        }

        const hasVinylUpdate = vinylId !== undefined;
        const normalizedVinylId = hasVinylUpdate
            ? await normalizeVinylId(vinylId, vinylRepository)
            : null;
        const nextReleaseDate = releaseDate === undefined
            ? currentDate
            : normalizeDateAgainstToday(releaseDate, todayStart);
        const nextTitle = title === undefined ? normalizeTitle(track.title) : normalizeTitle(title);
        const nextArtist = artist === undefined ? normalizeArtist(track.artist) : normalizeArtist(artist);
        const nextAudioUrl = audioUrl === undefined ? normalizeAudioUrl(track.audioUrl) : normalizeAudioUrl(audioUrl);
        const nextCoverUrl = coverUrl === undefined ? (track.coverUrl || null) : normalizeCoverUrl(coverUrl);

        const existingTrack = await veloRepository.findByReleaseDate(nextReleaseDate);
        if (existingTrack && String(existingTrack._id) !== String(track._id)) {
            throw new VeloDuplicateDateError();
        }

        let updatedTrack;
        try {
            updatedTrack = await veloRepository.updateById(id, {
                releaseDate: nextReleaseDate,
                audioUrl: nextAudioUrl,
                title: nextTitle,
                artist: nextArtist,
                coverUrl: nextCoverUrl,
                ...(hasVinylUpdate ? { vinylId: normalizedVinylId } : {})
            });
        } catch (error) {
            if (error && error.code === 11000) {
                throw new VeloDuplicateDateError();
            }
            throw error;
        }

        if (!updatedTrack) {
            throw new VeloTrackNotFoundError('La pista no existe');
        }

        let vinyl = null;
        if (hasVinylUpdate && normalizedVinylId && vinylRepository) {
            vinyl = await vinylRepository.findById(normalizedVinylId);
        } else if (!hasVinylUpdate && track.vinylId && typeof track.vinylId === 'object') {
            vinyl = track.vinylId;
        }

        if (vinyl) {
            const plainTrack = typeof updatedTrack.toObject === 'function'
                ? updatedTrack.toObject()
                : updatedTrack;
            updatedTrack = { ...plainTrack, vinyl: toVinylSummary(vinyl) };
        }

        return {
            track: updatedTrack,
            status: getTrackStatus(nextReleaseDate, todayStart)
        };
    };

    const reorderTracks = async ({ trackIds } = {}) => {
        if (!Array.isArray(trackIds) || trackIds.length === 0) {
            throw new VeloValidationError('El orden de las pistas es obligatorio');
        }

        const normalizedIds = trackIds.map((id) => String(id));
        if (normalizedIds.some((id) => id.length === 0)) {
            throw new VeloValidationError('El orden de las pistas contiene un identificador no válido');
        }
        if (new Set(normalizedIds).size !== normalizedIds.length) {
            throw new VeloValidationError('El orden de las pistas contiene identificadores duplicados');
        }

        const todayStart = getTodayStart();
        const allTracks = await veloRepository.findAll();
        const futureTracks = allTracks
            .filter((track) => getTrackStatus(track.releaseDate, todayStart) === 'future')
            .sort((left, right) => new Date(left.releaseDate).getTime() - new Date(right.releaseDate).getTime());

        if (futureTracks.length === 0) {
            throw new VeloValidationError('No hay pistas futuras que reordenar');
        }
        if (normalizedIds.length !== futureTracks.length) {
            throw new VeloValidationError('El orden debe incluir todas las pistas futuras');
        }

        const futureById = new Map(futureTracks.map((track) => [String(track._id), track]));
        const orderedTracks = normalizedIds.map((id) => {
            const track = futureById.get(id);
            if (!track) {
                throw new VeloValidationError('El orden incluye una pista que no es futura o no existe');
            }
            return track;
        });

        const unchanged = orderedTracks.every(
            (track, index) => String(track._id) === String(futureTracks[index]._id)
        );
        if (unchanged) {
            return listTracks();
        }

        const targetDates = futureTracks.map((track) => new Date(track.releaseDate));
        const originalDates = orderedTracks.map((track) => new Date(track.releaseDate));
        const dayInMilliseconds = 24 * 60 * 60 * 1000;

        // La fecha es única: se pasa primero por un rango temporal libre para
        // poder intercambiar dos fechas sin chocar con el índice único.
        try {
            for (let index = 0; index < orderedTracks.length; index += 1) {
                await veloRepository.updateById(orderedTracks[index]._id, {
                    releaseDate: new Date(Date.UTC(1970, 0, 1) + (index * dayInMilliseconds))
                });
            }
            for (let index = 0; index < orderedTracks.length; index += 1) {
                await veloRepository.updateById(orderedTracks[index]._id, {
                    releaseDate: targetDates[index]
                });
            }
        } catch (error) {
            try {
                for (let index = 0; index < orderedTracks.length; index += 1) {
                    await veloRepository.updateById(orderedTracks[index]._id, {
                        releaseDate: new Date(Date.UTC(1971, 0, 1) + (index * dayInMilliseconds))
                    });
                }
                for (let index = 0; index < orderedTracks.length; index += 1) {
                    await veloRepository.updateById(orderedTracks[index]._id, {
                        releaseDate: originalDates[index]
                    });
                }
            } catch (rollbackError) {
                // La restauración es best effort; se propaga el error original.
            }
            throw error;
        }

        return listTracks();
    };

    return {
        getToday,
        reflect,
        createTrack,
        listTracks,
        updateTrack,
        reorderTracks
    };
};

module.exports = {
    createVeloService,
    VeloValidationError,
    VeloUserNotFoundError,
    VeloTrackNotFoundError,
    VeloAlreadyReflectedError,
    VeloDuplicateDateError,
    getDateKeyInTimeZone,
    normalizeReleaseDate
};
