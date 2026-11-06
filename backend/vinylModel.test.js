const mongoose = require('mongoose');
const { Vinyl, VinylRepository } = require('./vinylModel');
const {
    MAX_TITLE_LENGTH,
    MAX_ARTIST_LENGTH,
    MAX_GENRE_LENGTH,
    UNCLASSIFIED_GENRE
} = require('./archivoConstants');
const { buildCatalogKey } = require('./archivoUtils');

const createValidVinyl = (overrides = {}) => new Vinyl({
    title: 'La leyenda del tiempo',
    artist: 'Camarón de la Isla',
    album: 'La leyenda del tiempo',
    coverUrl: 'https://example.com/portada.jpg',
    genre: 'Flamenco',
    youtubeVideoId: 'abc123DEF45',
    ...overrides
});

describe('Esquema Vinyl', () => {
    test('acepta un vinilo válido y calcula su clave de catálogo', async () => {
        const vinyl = createValidVinyl({
            title: '  La leyenda del tiempo  ',
            artist: '  Camarón de la Isla  '
        });

        await expect(vinyl.validate()).resolves.toBeUndefined();
        expect(vinyl.title).toBe('La leyenda del tiempo');
        expect(vinyl.artist).toBe('Camarón de la Isla');
        expect(vinyl.catalogKey).toBe(buildCatalogKey('Camarón de la Isla', 'La leyenda del tiempo'));
        expect(vinyl.genre).toBe('Flamenco');
        expect(vinyl.createdAt).toBeInstanceOf(Date);
        expect(vinyl.lastFmInfo).toBeTruthy();
    });

    test('exige título, artista y clave de catálogo', async () => {
        const vinyl = new Vinyl({});

        await expect(vinyl.validate()).rejects.toMatchObject({
            errors: {
                title: expect.anything(),
                artist: expect.anything(),
                catalogKey: expect.anything()
            }
        });
    });

    test(`rechaza títulos de más de ${MAX_TITLE_LENGTH} caracteres`, async () => {
        const vinyl = createValidVinyl({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1) });

        await expect(vinyl.validate()).rejects.toMatchObject({
            errors: { title: expect.anything() }
        });
    });

    test(`rechaza artistas de más de ${MAX_ARTIST_LENGTH} caracteres`, async () => {
        const vinyl = createValidVinyl({ artist: 'a'.repeat(MAX_ARTIST_LENGTH + 1) });

        await expect(vinyl.validate()).rejects.toMatchObject({
            errors: { artist: expect.anything() }
        });
    });

    test(`rechaza géneros de más de ${MAX_GENRE_LENGTH} caracteres`, async () => {
        const vinyl = createValidVinyl({ genre: 'a'.repeat(MAX_GENRE_LENGTH + 1) });

        await expect(vinyl.validate()).rejects.toMatchObject({
            errors: { genre: expect.anything() }
        });
    });

    test('rechaza un identificador de YouTube que no tenga once caracteres válidos', async () => {
        const vinyl = createValidVinyl({ youtubeVideoId: 'video-invalido' });

        await expect(vinyl.validate()).rejects.toMatchObject({
            errors: { youtubeVideoId: expect.anything() }
        });
    });

    test('asigna el género sin clasificar cuando no se informa', async () => {
        const vinyl = createValidVinyl({ genre: undefined });

        await expect(vinyl.validate()).resolves.toBeUndefined();
        expect(vinyl.genre).toBe(UNCLASSIFIED_GENRE);
    });

    test('declara la unicidad del catálogo y la inmutabilidad de la fecha de creación', () => {
        expect(Vinyl.modelName).toBe('Vinyl');
        expect(Vinyl.schema.path('catalogKey').options.unique).toBe(true);
        expect(Vinyl.schema.path('createdAt').options.immutable).toBe(true);
        expect(Vinyl.schema.path('lastFmInfo.tags')).toBeTruthy();
    });
});

describe('Repositorio de vinilos', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('busca un vinilo por su clave de catálogo', async () => {
        const vinyl = { _id: 'vinilo-1', catalogKey: 'camaron::la-leyenda' };
        const lean = jest.fn().mockResolvedValue(vinyl);
        const findOne = jest.spyOn(Vinyl, 'findOne').mockReturnValue({ lean });

        const result = await VinylRepository.findByCatalogKey('  camaron::la-leyenda  ');

        expect(findOne).toHaveBeenCalledWith({ catalogKey: 'camaron::la-leyenda' });
        expect(result).toBe(vinyl);
    });

    test('devuelve null para una clave de catálogo vacía', async () => {
        const findOne = jest.spyOn(Vinyl, 'findOne');

        await expect(VinylRepository.findByCatalogKey('   ')).resolves.toBeNull();
        expect(findOne).not.toHaveBeenCalled();
    });

    test('no consulta la base para un identificador no válido', async () => {
        const findById = jest.spyOn(Vinyl, 'findById');

        await expect(VinylRepository.findById('no-valido')).resolves.toBeNull();
        expect(findById).not.toHaveBeenCalled();
    });

    test('lista los vinilos filtrados y ordenados por artista y título', async () => {
        const vinyls = [{ _id: 'vinilo-1' }];
        const lean = jest.fn().mockResolvedValue(vinyls);
        const sort = jest.fn().mockReturnValue({ lean });
        const find = jest.spyOn(Vinyl, 'find').mockReturnValue({ sort });

        const result = await VinylRepository.findAll({
            genre: '  Flamenco  ',
            artist: '  Camarón de la Isla  '
        });

        expect(find).toHaveBeenCalledWith({
            genre: 'Flamenco',
            artist: 'Camarón de la Isla'
        });
        expect(sort).toHaveBeenCalledWith({ artist: 1, title: 1 });
        expect(result).toBe(vinyls);
    });

    test('guarda con upsert atómico usando la clave de catálogo', async () => {
        const stored = { _id: 'vinilo-1', catalogKey: 'camaron::la-leyenda' };
        const lean = jest.fn().mockResolvedValue(stored);
        const findOneAndUpdate = jest.spyOn(Vinyl, 'findOneAndUpdate').mockReturnValue({ lean });

        const result = await VinylRepository.upsertByCatalogKey({
            catalogKey: '  camaron::la-leyenda  ',
            title: 'La leyenda del tiempo',
            artist: 'Camarón de la Isla'
        });

        expect(findOneAndUpdate).toHaveBeenCalledWith(
            { catalogKey: 'camaron::la-leyenda' },
            expect.objectContaining({
                $set: expect.objectContaining({
                    catalogKey: 'camaron::la-leyenda',
                    updatedAt: expect.any(Date)
                }),
                $setOnInsert: {
                    createdAt: expect.any(Date)
                }
            }),
            {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );
        expect(result).toBe(stored);
    });

    test('actualiza un vinilo validando el identificador', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const updated = { _id: id, youtubeVideoId: 'abc123DEF45' };
        const lean = jest.fn().mockResolvedValue(updated);
        const findByIdAndUpdate = jest.spyOn(Vinyl, 'findByIdAndUpdate').mockReturnValue({ lean });

        const result = await VinylRepository.updateById(id, { youtubeVideoId: 'abc123DEF45' });

        expect(findByIdAndUpdate).toHaveBeenCalledWith(
            id,
            {
                $set: {
                    youtubeVideoId: 'abc123DEF45',
                    updatedAt: expect.any(Date)
                }
            },
            { new: true, runValidators: true }
        );
        expect(result).toBe(updated);
    });

    test('actualiza la marca de último acceso', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const lean = jest.fn().mockResolvedValue({ _id: id });
        const findByIdAndUpdate = jest.spyOn(Vinyl, 'findByIdAndUpdate').mockReturnValue({ lean });

        await VinylRepository.touchById(id);

        expect(findByIdAndUpdate).toHaveBeenCalledWith(
            id,
            { $set: { lastAccessedAt: expect.any(Date) } },
            { new: true }
        );
    });
});
