const mongoose = require('mongoose');
const { VeloTrack, VeloRepository } = require('./veloTrackModel');
const {
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_AUDIO_URL_LENGTH,
    MAX_COVER_URL_LENGTH,
    MAX_REFLECTION_LENGTH
} = require('./veloConstants');

const releaseDate = () => new Date(Date.UTC(2026, 10, 5));
const userId = () => new mongoose.Types.ObjectId();

const createValidTrack = (overrides = {}) => new VeloTrack({
    releaseDate: releaseDate(),
    audioUrl: 'https://example.com/pista.mp3',
    title: 'Una soleá sin nombre',
    artist: 'La Niña de los Peines',
    ...overrides
});

describe('Esquema VeloTrack', () => {
    test('acepta una pista válida y recorta sus campos de texto', async () => {
        const track = createValidTrack({
            audioUrl: '  https://example.com/pista.mp3  ',
            title: '  Una soleá sin nombre  ',
            artist: '  La Niña de los Peines  '
        });

        await expect(track.validate()).resolves.toBeUndefined();
        expect(track.audioUrl).toBe('https://example.com/pista.mp3');
        expect(track.title).toBe('Una soleá sin nombre');
        expect(track.artist).toBe('La Niña de los Peines');
        expect(track.coverUrl).toBeNull();
        expect(track.reflections).toEqual([]);
        expect(track.createdAt).toBeInstanceOf(Date);
    });

    test('exige fecha, audio, título y artista', async () => {
        const track = new VeloTrack({});

        await expect(track.validate()).rejects.toMatchObject({
            errors: {
                releaseDate: expect.anything(),
                audioUrl: expect.anything(),
                title: expect.anything(),
                artist: expect.anything()
            }
        });
    });

    test(`rechaza títulos de más de ${MAX_TITLE_LENGTH} caracteres`, async () => {
        const track = createValidTrack({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1) });

        await expect(track.validate()).rejects.toMatchObject({
            errors: { title: expect.anything() }
        });
    });

    test(`rechaza artistas de más de ${MAX_ARTIST_LENGTH} caracteres`, async () => {
        const track = createValidTrack({ artist: 'a'.repeat(MAX_ARTIST_LENGTH + 1) });

        await expect(track.validate()).rejects.toMatchObject({
            errors: { artist: expect.anything() }
        });
    });

    test(`rechaza URLs de audio de más de ${MAX_AUDIO_URL_LENGTH} caracteres`, async () => {
        const track = createValidTrack({
            audioUrl: `https://example.com/${'a'.repeat(MAX_AUDIO_URL_LENGTH)}`
        });

        await expect(track.validate()).rejects.toMatchObject({
            errors: { audioUrl: expect.anything() }
        });
    });

    test(`rechaza portadas de más de ${MAX_COVER_URL_LENGTH} caracteres`, async () => {
        const track = createValidTrack({
            coverUrl: `https://example.com/${'a'.repeat(MAX_COVER_URL_LENGTH)}`
        });

        await expect(track.validate()).rejects.toMatchObject({
            errors: { coverUrl: expect.anything() }
        });
    });

    test('acepta una reflexión con usuario y texto', async () => {
        const track = createValidTrack({
            reflections: [{ userId: userId(), text: '  Lo que despertó el cante  ' }]
        });

        await expect(track.validate()).resolves.toBeUndefined();
        expect(track.reflections).toHaveLength(1);
        expect(track.reflections[0].text).toBe('Lo que despertó el cante');
        expect(track.reflections[0].createdAt).toBeInstanceOf(Date);
    });

    test('exige usuario y texto en cada reflexión', async () => {
        const track = createValidTrack({
            reflections: [{ text: 'Sin autor' }]
        });

        await expect(track.validate()).rejects.toMatchObject({
            errors: { 'reflections.0.userId': expect.anything() }
        });
    });

    test(`rechaza reflexiones de más de ${MAX_REFLECTION_LENGTH} caracteres`, async () => {
        const track = createValidTrack({
            reflections: [{
                userId: userId(),
                text: 'a'.repeat(MAX_REFLECTION_LENGTH + 1)
            }]
        });

        await expect(track.validate()).rejects.toMatchObject({
            errors: { 'reflections.0.text': expect.anything() }
        });
    });

    test('declara una única pista por fecha y referencias al usuario', () => {
        expect(VeloTrack.modelName).toBe('VeloTrack');
        expect(VeloTrack.schema.path('releaseDate').options.unique).toBe(true);
        expect(VeloTrack.schema.path('reflections.userId').options.ref).toBe('User');
        expect(VeloTrack.schema.path('createdAt').options.immutable).toBe(true);
    });
});

describe('Repositorio del Velo', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('crea la pista con los datos recibidos', async () => {
        const save = jest.spyOn(VeloTrack.prototype, 'save').mockResolvedValue(undefined);

        const track = await VeloRepository.create({
            releaseDate: releaseDate(),
            audioUrl: 'https://example.com/pista.mp3',
            title: '  Una soleá sin nombre  ',
            artist: '  La Niña de los Peines  ',
            coverUrl: 'https://example.com/portada.jpg'
        });

        expect(track.title).toBe('Una soleá sin nombre');
        expect(track.artist).toBe('La Niña de los Peines');
        expect(track.coverUrl).toBe('https://example.com/portada.jpg');
        expect(save).toHaveBeenCalled();
    });

    test('busca la pista por el rango del día normalizado', async () => {
        const track = { _id: 'pista-1' };
        const lean = jest.fn().mockResolvedValue(track);
        const findOne = jest.spyOn(VeloTrack, 'findOne').mockReturnValue({ lean });

        const result = await VeloRepository.findByReleaseDate(releaseDate());

        expect(findOne).toHaveBeenCalledWith({
            releaseDate: {
                $gte: releaseDate(),
                $lt: new Date(Date.UTC(2026, 10, 6))
            }
        });
        expect(result).toBe(track);
    });

    test('devuelve null para una fecha inválida', async () => {
        const findOne = jest.spyOn(VeloTrack, 'findOne');

        await expect(VeloRepository.findByReleaseDate('fecha')).resolves.toBeNull();
        expect(findOne).not.toHaveBeenCalled();
    });

    test('lista todas las pistas de la más antigua a la más reciente', async () => {
        const tracks = [{ _id: 'pista-1' }];
        const lean = jest.fn().mockResolvedValue(tracks);
        const sort = jest.fn().mockReturnValue({ lean });
        const find = jest.spyOn(VeloTrack, 'find').mockReturnValue({ sort });

        const result = await VeloRepository.findAll();

        expect(find).toHaveBeenCalledWith({});
        expect(sort).toHaveBeenCalledWith({ releaseDate: 1 });
        expect(result).toBe(tracks);
    });

    test('actualiza una pista validando el identificador', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const updated = { _id: id, title: 'Nuevo título' };
        const lean = jest.fn().mockResolvedValue(updated);
        const findByIdAndUpdate = jest.spyOn(VeloTrack, 'findByIdAndUpdate').mockReturnValue({ lean });

        const result = await VeloRepository.updateById(id, { title: 'Nuevo título' });

        expect(findByIdAndUpdate).toHaveBeenCalledWith(
            id,
            { title: 'Nuevo título' },
            { new: true, runValidators: true }
        );
        expect(result).toBe(updated);
    });

    test('no consulta la base para un identificador no válido', async () => {
        const findByIdAndUpdate = jest.spyOn(VeloTrack, 'findByIdAndUpdate');

        await expect(VeloRepository.updateById('no-valido', {})).resolves.toBeNull();
        expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    test('añade una reflexión de forma atómica si el usuario no ha participado', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const authorId = userId();
        const updated = { _id: id, reflections: [{ userId: authorId, text: 'Una reflexión' }] };
        const lean = jest.fn().mockResolvedValue(updated);
        const findOneAndUpdate = jest.spyOn(VeloTrack, 'findOneAndUpdate').mockReturnValue({ lean });

        const result = await VeloRepository.addReflection(id, authorId, 'Una reflexión');

        expect(findOneAndUpdate).toHaveBeenCalledWith(
            { _id: id, 'reflections.userId': { $ne: authorId } },
            { $push: { reflections: { userId: authorId, text: 'Una reflexión' } } },
            { new: true }
        );
        expect(result).toEqual({ track: updated, alreadyReflected: false });
    });

    test('detecta que el usuario ya había reflexionado', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const authorId = userId();
        const lean = jest.fn().mockResolvedValue(null);
        jest.spyOn(VeloTrack, 'findOneAndUpdate').mockReturnValue({ lean });
        jest.spyOn(VeloTrack, 'exists').mockResolvedValue({ _id: id });

        const result = await VeloRepository.addReflection(id, authorId, 'Una reflexión');

        expect(result).toEqual({ track: null, alreadyReflected: true });
    });
});
