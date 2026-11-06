const {
    createVeloService,
    VeloValidationError,
    VeloUserNotFoundError,
    VeloTrackNotFoundError,
    VeloAlreadyReflectedError,
    VeloDuplicateDateError,
    getDateKeyInTimeZone
} = require('./veloService');

const TODAY = new Date(Date.UTC(2026, 10, 5));
const NOW = new Date('2026-11-05T10:00:00.000Z');

const createTrack = (overrides = {}) => ({
    _id: 'pista-1',
    releaseDate: TODAY,
    audioUrl: 'https://example.com/pista.mp3',
    title: 'Una soleá sin nombre',
    artist: 'La Niña de los Peines',
    coverUrl: 'https://example.com/portada.jpg',
    reflections: [],
    ...overrides
});

const createFakes = () => ({
    veloRepository: {
        findByReleaseDate: jest.fn(),
        findById: jest.fn(),
        findAll: jest.fn(),
        create: jest.fn(),
        updateById: jest.fn(),
        addReflection: jest.fn()
    },
    userRepository: {
        findByEmail: jest.fn()
    }
});

const createService = (fakes) => createVeloService({
    veloRepository: fakes.veloRepository,
    userRepository: fakes.userRepository,
    now: () => NOW
});

describe('Servicio del Velo', () => {
    let fakes;
    let veloRepository;
    let userRepository;
    let service;

    beforeEach(() => {
        fakes = createFakes();
        veloRepository = fakes.veloRepository;
        userRepository = fakes.userRepository;
        service = createService(fakes);
    });

    describe('pista del día', () => {
        test('devuelve la pista sin participación y marca el estado ciego', async () => {
            const track = createTrack();
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(track);

            const result = await service.getToday({ email: 'ana@uclm.es' });

            expect(userRepository.findByEmail).toHaveBeenCalledWith('ana@uclm.es');
            expect(veloRepository.findByReleaseDate).toHaveBeenCalledWith(TODAY);
            expect(result).toEqual({
                track,
                hasReflected: false,
                viewerId: 'usuario-1'
            });
        });

        test('marca la participación cuando el usuario ya está en las reflexiones', async () => {
            const track = createTrack({
                reflections: [{ userId: 'usuario-1', text: 'Mi reflexión' }]
            });
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(track);

            const result = await service.getToday({ email: 'ana@uclm.es' });

            expect(result.hasReflected).toBe(true);
        });

        test('lanza un error de pista cuando no hay programación para hoy', async () => {
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(null);

            await expect(service.getToday({ email: 'ana@uclm.es' }))
                .rejects.toBeInstanceOf(VeloTrackNotFoundError);
        });

        test('lanza un error de usuario cuando la sesión no tiene usuario persistido', async () => {
            userRepository.findByEmail.mockResolvedValue(null);

            await expect(service.getToday({ email: 'ana@uclm.es' }))
                .rejects.toBeInstanceOf(VeloUserNotFoundError);
            expect(veloRepository.findByReleaseDate).not.toHaveBeenCalled();
        });
    });

    describe('reflexión a ciegas', () => {
        test('recorta el texto y registra la reflexión del usuario', async () => {
            const updatedTrack = createTrack({
                reflections: [{ userId: 'usuario-1', text: 'Lo que despertó el cante' }]
            });
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(createTrack());
            veloRepository.addReflection.mockResolvedValue({
                track: updatedTrack,
                alreadyReflected: false
            });

            const result = await service.reflect({
                email: 'ana@uclm.es',
                text: '  Lo que despertó el cante  '
            });

            expect(veloRepository.addReflection).toHaveBeenCalledWith(
                'pista-1',
                'usuario-1',
                'Lo que despertó el cante'
            );
            expect(result).toEqual({ track: updatedTrack, viewerId: 'usuario-1' });
        });

        test('rechaza un segundo envío sin tocar el repositorio', async () => {
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(createTrack({
                reflections: [{ userId: 'usuario-1', text: 'Ya escribí' }]
            }));

            await expect(service.reflect({
                email: 'ana@uclm.es',
                text: 'Otra reflexión'
            })).rejects.toBeInstanceOf(VeloAlreadyReflectedError);
            expect(veloRepository.addReflection).not.toHaveBeenCalled();
        });

        test('detecta una participación concurrente al guardar', async () => {
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(createTrack());
            veloRepository.addReflection.mockResolvedValue({
                track: null,
                alreadyReflected: true
            });

            await expect(service.reflect({
                email: 'ana@uclm.es',
                text: 'Una reflexión'
            })).rejects.toBeInstanceOf(VeloAlreadyReflectedError);
        });

        test('rechaza una reflexión vacía antes de resolver al usuario', async () => {
            await expect(service.reflect({
                email: 'ana@uclm.es',
                text: '   '
            })).rejects.toBeInstanceOf(VeloValidationError);
            expect(userRepository.findByEmail).not.toHaveBeenCalled();
        });

        test('lanza un error de pista cuando no hay pista hoy', async () => {
            userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
            veloRepository.findByReleaseDate.mockResolvedValue(null);

            await expect(service.reflect({
                email: 'ana@uclm.es',
                text: 'Una reflexión'
            })).rejects.toBeInstanceOf(VeloTrackNotFoundError);
        });
    });

    describe('administración de la cola', () => {
        test('crea una pista futura normalizando la fecha a medianoche UTC', async () => {
            const createdTrack = createTrack({
                _id: 'pista-2',
                releaseDate: new Date(Date.UTC(2026, 10, 6))
            });
            veloRepository.findByReleaseDate.mockResolvedValue(null);
            veloRepository.create.mockResolvedValue(createdTrack);

            const result = await service.createTrack({
                releaseDate: '2026-11-06',
                audioUrl: '  https://example.com/pista.mp3  ',
                title: '  Una soleá sin nombre  ',
                artist: '  La Niña de los Peines  ',
                coverUrl: '  '
            });

            expect(veloRepository.create).toHaveBeenCalledWith({
                releaseDate: new Date(Date.UTC(2026, 10, 6)),
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Una soleá sin nombre',
                artist: 'La Niña de los Peines',
                coverUrl: null
            });
            expect(result).toEqual({ track: createdTrack, status: 'future' });
        });

        test('permite programar la pista de hoy', async () => {
            const createdTrack = createTrack();
            veloRepository.findByReleaseDate.mockResolvedValue(null);
            veloRepository.create.mockResolvedValue(createdTrack);

            const result = await service.createTrack({
                releaseDate: '2026-11-05',
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Pista de hoy',
                artist: 'Artista'
            });

            expect(result.status).toBe('today');
        });

        test('rechaza una fecha pasada', async () => {
            await expect(service.createTrack({
                releaseDate: '2026-11-04',
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Pista',
                artist: 'Artista'
            })).rejects.toBeInstanceOf(VeloValidationError);
            expect(veloRepository.create).not.toHaveBeenCalled();
        });

        test('rechaza una fecha duplicada', async () => {
            veloRepository.findByReleaseDate.mockResolvedValue(createTrack());

            await expect(service.createTrack({
                releaseDate: '2026-11-06',
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Pista',
                artist: 'Artista'
            })).rejects.toBeInstanceOf(VeloDuplicateDateError);
            expect(veloRepository.create).not.toHaveBeenCalled();
        });

        test('traduce la violación del índice único a fecha duplicada', async () => {
            veloRepository.findByReleaseDate.mockResolvedValue(null);
            veloRepository.create.mockRejectedValue({ code: 11000 });

            await expect(service.createTrack({
                releaseDate: '2026-11-06',
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Pista',
                artist: 'Artista'
            })).rejects.toBeInstanceOf(VeloDuplicateDateError);
        });

        test('rechaza una URL de audio que no sea http o https', async () => {
            await expect(service.createTrack({
                releaseDate: '2026-11-06',
                audioUrl: 'ftp://example.com/pista.mp3',
                title: 'Pista',
                artist: 'Artista'
            })).rejects.toBeInstanceOf(VeloValidationError);
        });

        test('lista la cola con los estados pasado, hoy y futuro', async () => {
            veloRepository.findAll.mockResolvedValue([
                createTrack({ _id: 'pasada', releaseDate: new Date(Date.UTC(2026, 10, 4)) }),
                createTrack({ _id: 'hoy', releaseDate: TODAY }),
                createTrack({ _id: 'futura', releaseDate: new Date(Date.UTC(2026, 10, 6)) })
            ]);

            const result = await service.listTracks();

            expect(result.map((track) => track.status)).toEqual(['past', 'today', 'future']);
            expect(result[1]._id).toBe('hoy');
        });

        test('edita una pista de hoy o futura', async () => {
            const currentTrack = createTrack();
            const updatedTrack = createTrack({ title: 'Título corregido' });
            veloRepository.findById.mockResolvedValue(currentTrack);
            veloRepository.findByReleaseDate.mockResolvedValue(currentTrack);
            veloRepository.updateById.mockResolvedValue(updatedTrack);

            const result = await service.updateTrack({
                id: 'pista-1',
                title: '  Título corregido  ',
                coverUrl: ''
            });

            expect(veloRepository.updateById).toHaveBeenCalledWith('pista-1', {
                releaseDate: TODAY,
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Título corregido',
                artist: 'La Niña de los Peines',
                coverUrl: null
            });
            expect(result.status).toBe('today');
        });

        test('rechaza editar una pista pasada', async () => {
            veloRepository.findById.mockResolvedValue(createTrack({
                releaseDate: new Date(Date.UTC(2026, 10, 4))
            }));

            await expect(service.updateTrack({ id: 'pista-1', title: 'Nuevo' }))
                .rejects.toBeInstanceOf(VeloValidationError);
            expect(veloRepository.updateById).not.toHaveBeenCalled();
        });

        test('rechaza mover una pista a una fecha ya ocupada por otra', async () => {
            veloRepository.findById.mockResolvedValue(createTrack());
            veloRepository.findByReleaseDate.mockResolvedValue(createTrack({ _id: 'otra-pista' }));

            await expect(service.updateTrack({
                id: 'pista-1',
                releaseDate: '2026-11-06'
            })).rejects.toBeInstanceOf(VeloDuplicateDateError);
            expect(veloRepository.updateById).not.toHaveBeenCalled();
        });

        test('lanza un error cuando la pista que se quiere editar no existe', async () => {
            veloRepository.findById.mockResolvedValue(null);

            await expect(service.updateTrack({ id: 'pista-1', title: 'Nuevo' }))
                .rejects.toBeInstanceOf(VeloTrackNotFoundError);
        });

        test('reordena las pistas futuras intercambiando sus fechas con un paso temporal', async () => {
            const firstDate = new Date(Date.UTC(2026, 10, 6));
            const secondDate = new Date(Date.UTC(2026, 10, 8));
            const today = createTrack({ _id: 'hoy', releaseDate: TODAY, reflections: [] });
            const first = createTrack({ _id: 'futura-1', releaseDate: firstDate, reflections: [] });
            const second = createTrack({ _id: 'futura-2', releaseDate: secondDate, reflections: [] });

            veloRepository.findAll
                .mockResolvedValueOnce([today, first, second])
                .mockResolvedValueOnce([
                    today,
                    { ...second, releaseDate: firstDate },
                    { ...first, releaseDate: secondDate }
                ]);
            veloRepository.updateById.mockResolvedValue(null);

            const result = await service.reorderTracks({ trackIds: ['futura-2', 'futura-1'] });

            expect(veloRepository.updateById).toHaveBeenNthCalledWith(1, 'futura-2', {
                releaseDate: new Date(Date.UTC(1970, 0, 1))
            });
            expect(veloRepository.updateById).toHaveBeenNthCalledWith(2, 'futura-1', {
                releaseDate: new Date(Date.UTC(1970, 0, 2))
            });
            expect(veloRepository.updateById).toHaveBeenNthCalledWith(3, 'futura-2', {
                releaseDate: firstDate
            });
            expect(veloRepository.updateById).toHaveBeenNthCalledWith(4, 'futura-1', {
                releaseDate: secondDate
            });
            expect(result[1]).toMatchObject({ _id: 'futura-2', status: 'future' });
            expect(result[2]).toMatchObject({ _id: 'futura-1', status: 'future' });
        });

        test('rechaza un orden que no incluye exactamente las pistas futuras', async () => {
            veloRepository.findAll.mockResolvedValue([
                createTrack({ _id: 'hoy', releaseDate: TODAY }),
                createTrack({ _id: 'futura-1', releaseDate: new Date(Date.UTC(2026, 10, 6)) }),
                createTrack({ _id: 'futura-2', releaseDate: new Date(Date.UTC(2026, 10, 8)) })
            ]);

            await expect(service.reorderTracks({ trackIds: ['hoy', 'futura-1'] }))
                .rejects.toBeInstanceOf(VeloValidationError);
            expect(veloRepository.updateById).not.toHaveBeenCalled();
        });

        test('no toca la base si el orden recibido ya es el actual', async () => {
            const first = createTrack({ _id: 'futura-1', releaseDate: new Date(Date.UTC(2026, 10, 6)) });
            const second = createTrack({ _id: 'futura-2', releaseDate: new Date(Date.UTC(2026, 10, 8)) });
            veloRepository.findAll.mockResolvedValue([first, second]);

            const result = await service.reorderTracks({ trackIds: ['futura-1', 'futura-2'] });

            expect(veloRepository.updateById).not.toHaveBeenCalled();
            expect(result.map((track) => track._id)).toEqual(['futura-1', 'futura-2']);
        });
    });
});

describe('Clave diaria del Velo', () => {
    test('calcula el día en Europe/Madrid aunque en UTC aún sea el día anterior', () => {
        const lateUtc = new Date('2026-11-05T23:30:00.000Z');

        expect(getDateKeyInTimeZone(lateUtc, 'Europe/Madrid')).toBe('2026-11-06');
    });
});
