const express = require('express');
const { createVeloRouter } = require('./veloRouter');
const isAdminMiddleware = require('./adminMiddleware');
const {
    VeloValidationError,
    VeloTrackNotFoundError,
    VeloAlreadyReflectedError,
    VeloDuplicateDateError
} = require('./veloService');

const ADMIN_TOKEN = 'Bearer admin-token';
const USER_TOKEN = 'Bearer user-token';

const authMiddleware = (req, res, next) => {
    if (req.headers.authorization === ADMIN_TOKEN) {
        req.user = { email: 'admin@querencia.es', role: 'admin' };
        return next();
    }
    if (req.headers.authorization === USER_TOKEN) {
        req.user = { email: 'ana@uclm.es', role: 'usuario' };
        return next();
    }
    return res.status(401).json({ authenticated: false, message: 'Acceso denegado: No hay token' });
};

const startServer = (veloService) => new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/velo', createVeloRouter({
        veloService,
        authMiddleware,
        adminMiddleware: isAdminMiddleware
    }));
    const server = app.listen(0, () => resolve(server));
});

const stopServer = (server) => new Promise((resolve) => server.close(resolve));

let server;

afterEach(async () => {
    if (server) {
        await stopServer(server);
        server = null;
    }
});

const request = async (path, options = {}) => {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const body = await response.json();
    return { status: response.status, body };
};

const jsonHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: token } : {})
});

const createService = (overrides = {}) => ({
    getToday: jest.fn(),
    reflect: jest.fn(),
    createTrack: jest.fn(),
    listTracks: jest.fn(),
    updateTrack: jest.fn(),
    ...overrides
});

const createTrack = (overrides = {}) => ({
    _id: 'pista-1',
    releaseDate: new Date('2026-11-05T00:00:00.000Z'),
    audioUrl: 'https://example.com/pista.mp3',
    title: 'Una soleá sin nombre',
    artist: 'La Niña de los Peines',
    coverUrl: 'https://example.com/portada.jpg',
    reflections: [
        { _id: 'reflexion-1', userId: 'usuario-1', text: 'Lo que despertó el cante' },
        { _id: 'reflexion-2', userId: 'usuario-2', text: 'Una voz sin nombre' }
    ],
    ...overrides
});

describe('Rutas del Velo', () => {
    test('GET /today exige autenticación', async () => {
        const getToday = jest.fn();
        server = await startServer(createService({ getToday }));

        const { status } = await request('/api/velo/today');

        expect(status).toBe(401);
        expect(getToday).not.toHaveBeenCalled();
    });

    test('GET /today devuelve exclusivamente el audio cuando el velo sigue cerrado', async () => {
        const getToday = jest.fn().mockResolvedValue({
            track: createTrack(),
            hasReflected: false,
            viewerId: 'usuario-1'
        });
        server = await startServer(createService({ getToday }));

        const { status, body } = await request('/api/velo/today', {
            headers: jsonHeaders(USER_TOKEN)
        });

        expect(status).toBe(200);
        expect(body).toEqual({ audioUrl: 'https://example.com/pista.mp3' });
        expect(Object.keys(body)).toHaveLength(1);
        expect(getToday).toHaveBeenCalledWith({ email: 'ana@uclm.es' });
    });

    test('GET /today revela metadatos y reflexiones cuando el usuario ya participó', async () => {
        const getToday = jest.fn().mockResolvedValue({
            track: createTrack(),
            hasReflected: true,
            viewerId: 'usuario-1'
        });
        server = await startServer(createService({ getToday }));

        const { status, body } = await request('/api/velo/today', {
            headers: jsonHeaders(USER_TOKEN)
        });

        expect(status).toBe(200);
        expect(body).toMatchObject({
            _id: 'pista-1',
            title: 'Una soleá sin nombre',
            artist: 'La Niña de los Peines',
            coverUrl: 'https://example.com/portada.jpg',
            participated: true,
            reflectionCount: 2
        });
        expect(body.reflections[0]).toEqual({
            _id: 'reflexion-1',
            userId: 'usuario-1',
            text: 'Lo que despertó el cante',
            isMine: true
        });
        expect(body.reflections[1].isMine).toBe(false);
    });

    test('GET /today devuelve 404 si no hay pista programada', async () => {
        const getToday = jest.fn().mockRejectedValue(new VeloTrackNotFoundError());
        server = await startServer(createService({ getToday }));

        const { status, body } = await request('/api/velo/today', {
            headers: jsonHeaders(USER_TOKEN)
        });

        expect(status).toBe(404);
        expect(body.message).toBe('No hay una pista programada para hoy');
    });

    test('POST /today/reflect guarda el texto y devuelve la revelación completa', async () => {
        const reflect = jest.fn().mockResolvedValue({
            track: createTrack(),
            viewerId: 'usuario-1'
        });
        server = await startServer(createService({ reflect }));

        const { status, body } = await request('/api/velo/today/reflect', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ text: 'Lo que despertó el cante' })
        });

        expect(status).toBe(200);
        expect(reflect).toHaveBeenCalledWith({
            email: 'ana@uclm.es',
            text: 'Lo que despertó el cante'
        });
        expect(body.participated).toBe(true);
        expect(body.title).toBe('Una soleá sin nombre');
        expect(body.reflections).toHaveLength(2);
    });

    test('POST /today/reflect devuelve 400 si la reflexión no es válida', async () => {
        const reflect = jest.fn().mockRejectedValue(new VeloValidationError('La reflexión no puede estar vacía'));
        server = await startServer(createService({ reflect }));

        const { status, body } = await request('/api/velo/today/reflect', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ text: '   ' })
        });

        expect(status).toBe(400);
        expect(body).toEqual({ message: 'La reflexión no puede estar vacía' });
    });

    test('POST /today/reflect devuelve 409 si el usuario ya había participado', async () => {
        const reflect = jest.fn().mockRejectedValue(new VeloAlreadyReflectedError());
        server = await startServer(createService({ reflect }));

        const { status } = await request('/api/velo/today/reflect', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ text: 'Otra reflexión' })
        });

        expect(status).toBe(409);
    });

    test('POST /tracks exige administrador y crea la pista', async () => {
        const createdTrack = createTrack({ status: undefined });
        const createTrackMock = jest.fn().mockResolvedValue({ track: createdTrack, status: 'future' });
        server = await startServer(createService({ createTrack: createTrackMock }));

        const denied = await request('/api/velo/tracks', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({})
        });
        expect(denied.status).toBe(403);
        expect(createTrackMock).not.toHaveBeenCalled();

        const { status, body } = await request('/api/velo/tracks', {
            method: 'POST',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({
                releaseDate: '2026-11-06',
                audioUrl: 'https://example.com/pista.mp3',
                title: 'Una soleá sin nombre',
                artist: 'La Niña de los Peines',
                coverUrl: 'https://example.com/portada.jpg'
            })
        });

        expect(status).toBe(201);
        expect(createTrackMock).toHaveBeenCalledWith({
            releaseDate: '2026-11-06',
            audioUrl: 'https://example.com/pista.mp3',
            title: 'Una soleá sin nombre',
            artist: 'La Niña de los Peines',
            coverUrl: 'https://example.com/portada.jpg'
        });
        expect(body).toMatchObject({
            _id: 'pista-1',
            status: 'future',
            reflectionCount: 2
        });
    });

    test('POST /tracks devuelve 409 si la fecha ya está ocupada', async () => {
        const createTrack = jest.fn().mockRejectedValue(new VeloDuplicateDateError());
        server = await startServer(createService({ createTrack }));

        const { status } = await request('/api/velo/tracks', {
            method: 'POST',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({})
        });

        expect(status).toBe(409);
    });

    test('GET /tracks lista la cola solo para administradores', async () => {
        const listTracks = jest.fn().mockResolvedValue([
            createTrack({ status: 'today' }),
            createTrack({ _id: 'pista-2', status: 'future' })
        ]);
        server = await startServer(createService({ listTracks }));

        const denied = await request('/api/velo/tracks', {
            headers: jsonHeaders(USER_TOKEN)
        });
        expect(denied.status).toBe(403);

        const { status, body } = await request('/api/velo/tracks', {
            headers: jsonHeaders(ADMIN_TOKEN)
        });

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0]).toMatchObject({ _id: 'pista-1', status: 'today', reflectionCount: 2 });
        expect(body[1]).toMatchObject({ _id: 'pista-2', status: 'future' });
    });

    test('PUT /tracks/:id actualiza una pista existente', async () => {
        const updatedTrack = createTrack({ title: 'Título corregido', reflections: [] });
        const updateTrack = jest.fn().mockResolvedValue({ track: updatedTrack, status: 'today' });
        server = await startServer(createService({ updateTrack }));

        const { status, body } = await request('/api/velo/tracks/pista-1', {
            method: 'PUT',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({ title: 'Título corregido' })
        });

        expect(status).toBe(200);
        expect(updateTrack).toHaveBeenCalledWith({
            id: 'pista-1',
            releaseDate: undefined,
            audioUrl: undefined,
            title: 'Título corregido',
            artist: undefined,
            coverUrl: undefined
        });
        expect(body).toMatchObject({ _id: 'pista-1', title: 'Título corregido', status: 'today' });
    });

    test('PUT /tracks/:id devuelve 404 si la pista no existe', async () => {
        const updateTrack = jest.fn().mockRejectedValue(new VeloTrackNotFoundError('La pista no existe'));
        server = await startServer(createService({ updateTrack }));

        const { status, body } = await request('/api/velo/tracks/pista-1', {
            method: 'PUT',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({ title: 'Nuevo' })
        });

        expect(status).toBe(404);
        expect(body).toEqual({ message: 'La pista no existe' });
    });

    test('los endpoints administrativos exigen autenticación', async () => {
        server = await startServer(createService());

        expect((await request('/api/velo/tracks')).status).toBe(401);
        expect((await request('/api/velo/tracks', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({})
        })).status).toBe(401);
        expect((await request('/api/velo/tracks/pista-1', {
            method: 'PUT',
            headers: jsonHeaders(),
            body: JSON.stringify({})
        })).status).toBe(401);
    });
});
