const express = require('express');
const { createArchivoRouter } = require('./archivoRouter');
const {
    ArchivoValidationError,
    ArchivoNotFoundError,
    ArchivoUpstreamError,
    ArchivoTimeoutError,
    ArchivoConfigurationError
} = require('./archivoService');

const USER_TOKEN = 'Bearer user-token';

const authMiddleware = (req, res, next) => {
    if (req.headers.authorization === USER_TOKEN) {
        req.user = { email: 'ana@uclm.es', role: 'usuario' };
        return next();
    }

    return res.status(401).json({
        authenticated: false,
        message: 'Acceso denegado: No hay token'
    });
};

const startServer = (archivoService) => new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/archivo', createArchivoRouter({
        archivoService,
        authMiddleware
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
    getDrawers: jest.fn().mockResolvedValue({
        agrupacion: 'genero',
        total: 0,
        cajones: []
    }),
    getVinylById: jest.fn(),
    searchVinyl: jest.fn(),
    ...overrides
});

const createVinyl = (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    title: 'La leyenda del tiempo',
    artist: 'Camarón de la Isla',
    album: 'La leyenda del tiempo',
    coverUrl: 'https://example.com/cover.jpg',
    genre: 'Flamenco',
    youtubeVideoId: 'abc123DEF45',
    playable: true,
    catalogKey: 'camaron-de-la-isla::la-leyenda-del-tiempo',
    lastFmInfo: {
        tags: ['flamenco'],
        summary: 'Una escucha fundamental'
    },
    ...overrides
});

describe('Rutas de El Archivo', () => {
    test('los tres endpoints exigen autenticación', async () => {
        const service = createService();
        server = await startServer(service);

        expect((await request('/api/archivo/cajones')).status).toBe(401);
        expect((await request('/api/archivo/disco/507f1f77bcf86cd799439011')).status).toBe(401);
        expect((await request('/api/archivo/buscar', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ query: 'La leyenda del tiempo' })
        })).status).toBe(401);

        expect(service.getDrawers).not.toHaveBeenCalled();
        expect(service.getVinylById).not.toHaveBeenCalled();
        expect(service.searchVinyl).not.toHaveBeenCalled();
    });

    test('GET /cajones devuelve los cajones y traduce los parámetros de agrupación', async () => {
        const drawers = {
            agrupacion: 'artista',
            total: 1,
            cajones: [
                {
                    clave: 'camaron-de-la-isla',
                    etiqueta: 'Camarón de la Isla',
                    total: 1,
                    vinilos: [createVinyl()]
                }
            ]
        };
        const getDrawers = jest.fn().mockResolvedValue(drawers);
        server = await startServer(createService({ getDrawers }));

        const { status, body } = await request(
            '/api/archivo/cajones?agrupar=artista&genero=Flamenco&artista=Camar%C3%B3n%20de%20la%20Isla',
            { headers: jsonHeaders(USER_TOKEN) }
        );

        expect(status).toBe(200);
        expect(body).toEqual(drawers);
        expect(getDrawers).toHaveBeenCalledWith({
            groupBy: 'artista',
            genre: 'Flamenco',
            artist: 'Camarón de la Isla'
        });
    });

    test('GET /disco/:id devuelve el detalle completo', async () => {
        const vinyl = createVinyl();
        const getVinylById = jest.fn().mockResolvedValue(vinyl);
        server = await startServer(createService({ getVinylById }));

        const { status, body } = await request('/api/archivo/disco/507f1f77bcf86cd799439011', {
            headers: jsonHeaders(USER_TOKEN)
        });

        expect(status).toBe(200);
        expect(body).toMatchObject({
            _id: '507f1f77bcf86cd799439011',
            title: 'La leyenda del tiempo',
            youtubeVideoId: 'abc123DEF45',
            playable: true
        });
        expect(getVinylById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    test('POST /buscar responde 201 cuando crea un disco nuevo', async () => {
        const searchVinyl = jest.fn().mockResolvedValue({
            vinyl: createVinyl(),
            cached: false,
            created: true,
            stale: false
        });
        server = await startServer(createService({ searchVinyl }));

        const { status, body } = await request('/api/archivo/buscar', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({
                artist: 'Camarón de la Isla',
                title: 'La leyenda del tiempo'
            })
        });

        expect(status).toBe(201);
        expect(body).toMatchObject({
            cached: false,
            created: true,
            stale: false,
            disco: {
                title: 'La leyenda del tiempo',
                playable: true
            }
        });
        expect(searchVinyl).toHaveBeenCalledWith({
            query: undefined,
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });
    });

    test('POST /buscar responde 200 cuando reutiliza la caché', async () => {
        const searchVinyl = jest.fn().mockResolvedValue({
            vinyl: createVinyl(),
            cached: true,
            created: false,
            stale: false
        });
        server = await startServer(createService({ searchVinyl }));

        const { status, body } = await request('/api/archivo/buscar', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ query: 'La leyenda del tiempo' })
        });

        expect(status).toBe(200);
        expect(body.cached).toBe(true);
        expect(body.created).toBe(false);
    });

    test('traduce los errores de dominio a códigos HTTP', async () => {
        const getVinylById = jest.fn()
            .mockRejectedValueOnce(new ArchivoValidationError('El identificador del disco no es válido'))
            .mockRejectedValueOnce(new ArchivoNotFoundError('El disco no existe en el archivo'));
        server = await startServer(createService({ getVinylById }));

        const invalid = await request('/api/archivo/disco/no-valido', {
            headers: jsonHeaders(USER_TOKEN)
        });
        expect(invalid.status).toBe(400);

        const missing = await request('/api/archivo/disco/507f1f77bcf86cd799439099', {
            headers: jsonHeaders(USER_TOKEN)
        });
        expect(missing.status).toBe(404);
    });

    test.each([
        [new ArchivoConfigurationError('LASTFM_API_KEY no está configurada'), 503],
        [new ArchivoTimeoutError(), 504],
        [new ArchivoUpstreamError(), 502]
    ])('traduce los fallos externos a su código HTTP', async (error, expectedStatus) => {
        const searchVinyl = jest.fn().mockRejectedValue(error);
        server = await startServer(createService({ searchVinyl }));

        const { status } = await request('/api/archivo/buscar', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ query: 'La leyenda del tiempo' })
        });

        expect(status).toBe(expectedStatus);
    });

    test('devuelve 400 cuando la búsqueda no es válida', async () => {
        const searchVinyl = jest.fn().mockRejectedValue(
            new ArchivoValidationError('Indica una búsqueda o un artista y un título')
        );
        server = await startServer(createService({ searchVinyl }));

        const { status, body } = await request('/api/archivo/buscar', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({})
        });

        expect(status).toBe(400);
        expect(body).toEqual({
            message: 'Indica una búsqueda o un artista y un título'
        });
    });
});
