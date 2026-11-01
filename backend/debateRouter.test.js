const express = require('express');
const { createDebateRouter } = require('./debateRouter');
const isAdminMiddleware = require('./adminMiddleware');
const {
    DebateValidationError,
    DebateUserNotFoundError,
    DebateNotFoundError
} = require('./debateService');

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

const startServer = (debateService) => new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/debates', createDebateRouter({
        debateService,
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
    createDebate: jest.fn(),
    listDebates: jest.fn(),
    reactToDebate: jest.fn(),
    deleteDebate: jest.fn(),
    ...overrides
});

const createDebate = (overrides = {}) => ({
    _id: 'debate-1',
    title: 'La ruptura temporal en Omega',
    content: 'Un debate con alma.',
    coverImageUrl: 'https://example.com/portada.jpg',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    authorId: { email: 'admin@querencia.es' },
    reactions: {
        profundo: ['usuario-1', 'usuario-2'],
        melancolico: [],
        rompeEsquemas: ['usuario-1']
    },
    ...overrides
});

describe('Rutas del muro de debates', () => {
    test('POST crea un debate cuando el usuario es administrador', async () => {
        const debate = createDebate();
        const createDebateMock = jest.fn().mockResolvedValue(debate);
        server = await startServer(createService({ createDebate: createDebateMock }));

        const { status, body } = await request('/api/debates', {
            method: 'POST',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({
                title: 'La ruptura temporal en Omega',
                content: 'Un debate con alma.',
                coverImageUrl: 'https://example.com/portada.jpg',
                isAnonymous: false
            })
        });

        expect(status).toBe(201);
        expect(body).toMatchObject({
            _id: 'debate-1',
            title: 'La ruptura temporal en Omega',
            content: 'Un debate con alma.',
            coverImageUrl: 'https://example.com/portada.jpg',
            isAnonymous: false,
            createdAt: '2026-11-01T10:00:00.000Z',
            authorEmail: 'admin@querencia.es'
        });
        expect(body.reactions.profundo).toEqual({
            label: 'Profundo',
            count: 2,
            reactedByMe: false
        });
        expect(body.reactions.melancolico).toEqual({
            label: 'Melancólico',
            count: 0,
            reactedByMe: false
        });
        expect(body.reactions.rompeEsquemas).toEqual({
            label: 'Rompe esquemas',
            count: 1,
            reactedByMe: false
        });
        expect(body.reactions.intimo).toBeUndefined();
        expect(createDebateMock).toHaveBeenCalledWith({
            email: 'admin@querencia.es',
            title: 'La ruptura temporal en Omega',
            content: 'Un debate con alma.',
            coverImageUrl: 'https://example.com/portada.jpg',
            isAnonymous: false
        });
    });

    test('POST crea un debate anónimo sin exponer el correo del autor', async () => {
        const debate = createDebate({ isAnonymous: true, authorId: { email: 'admin@querencia.es' } });
        const createDebateMock = jest.fn().mockResolvedValue(debate);
        server = await startServer(createService({ createDebate: createDebateMock }));

        const { status, body } = await request('/api/debates', {
            method: 'POST',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({
                title: 'La ruptura temporal en Omega',
                content: 'Un debate con alma.',
                isAnonymous: true
            })
        });

        expect(status).toBe(201);
        expect(body).toMatchObject({
            _id: 'debate-1',
            isAnonymous: true,
            authorEmail: null
        });
        expect(createDebateMock).toHaveBeenCalledWith({
            email: 'admin@querencia.es',
            title: 'La ruptura temporal en Omega',
            content: 'Un debate con alma.',
            coverImageUrl: undefined,
            isAnonymous: true
        });
    });

    test('POST devuelve 403 si el usuario no es administrador', async () => {
        const createDebateMock = jest.fn();
        server = await startServer(createService({ createDebate: createDebateMock }));

        const { status } = await request('/api/debates', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ title: 'Título', content: 'Contenido' })
        });

        expect(status).toBe(403);
        expect(createDebateMock).not.toHaveBeenCalled();
    });

    test('POST exige autenticación y no llama al servicio sin token', async () => {
        const createDebateMock = jest.fn();
        server = await startServer(createService({ createDebate: createDebateMock }));

        const { status } = await request('/api/debates', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ title: 'Título', content: 'Contenido' })
        });

        expect(status).toBe(401);
        expect(createDebateMock).not.toHaveBeenCalled();
    });

    test('POST devuelve 400 si los datos no son válidos', async () => {
        const createDebateMock = jest.fn().mockRejectedValue(
            new DebateValidationError('El título no puede estar vacío')
        );
        server = await startServer(createService({ createDebate: createDebateMock }));

        const { status, body } = await request('/api/debates', {
            method: 'POST',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({ title: '   ', content: 'Contenido' })
        });

        expect(status).toBe(400);
        expect(body).toEqual({ message: 'El título no puede estar vacío' });
    });

    test('POST devuelve 500 ante un error inesperado', async () => {
        const createDebateMock = jest.fn().mockRejectedValue(new Error('fallo interno'));
        server = await startServer(createService({ createDebate: createDebateMock }));

        const { status, body } = await request('/api/debates', {
            method: 'POST',
            headers: jsonHeaders(ADMIN_TOKEN),
            body: JSON.stringify({ title: 'Título', content: 'Contenido' })
        });

        expect(status).toBe(500);
        expect(body).toEqual({ message: 'No se pudo crear el debate' });
    });

    test('GET permite leer el muro sin token y devuelve contadores', async () => {
        const debate = createDebate();
        const listDebates = jest.fn().mockResolvedValue({ debates: [debate], viewerId: null });
        server = await startServer(createService({ listDebates }));

        const { status, body } = await request('/api/debates', { method: 'GET' });

        expect(status).toBe(200);
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
            _id: 'debate-1',
            authorEmail: 'admin@querencia.es'
        });
        expect(body[0].reactions.profundo).toEqual({
            label: 'Profundo',
            count: 2,
            reactedByMe: false
        });
        expect(body[0].reactions.melancolico).toEqual({
            label: 'Melancólico',
            count: 0,
            reactedByMe: false
        });
        expect(body[0].reactions.rompeEsquemas).toEqual({
            label: 'Rompe esquemas',
            count: 1,
            reactedByMe: false
        });
        expect(body[0].reactions.intimo).toBeUndefined();
        expect(listDebates).toHaveBeenCalledWith({ email: undefined });
    });

    test('GET oculta el correo del autor en los debates anónimos', async () => {
        const debate = createDebate({
            isAnonymous: true,
            authorId: { email: 'admin@querencia.es' }
        });
        const listDebates = jest.fn().mockResolvedValue({ debates: [debate], viewerId: null });
        server = await startServer(createService({ listDebates }));

        const { status, body } = await request('/api/debates', { method: 'GET' });

        expect(status).toBe(200);
        expect(body[0]).toMatchObject({
            _id: 'debate-1',
            isAnonymous: true,
            authorEmail: null
        });
    });

    test('GET marca las reacciones del usuario autenticado', async () => {
        const debate = createDebate();
        const listDebates = jest.fn().mockResolvedValue({ debates: [debate], viewerId: 'usuario-1' });
        server = await startServer(createService({ listDebates }));

        const { status, body } = await request('/api/debates', {
            method: 'GET',
            headers: { Authorization: USER_TOKEN }
        });

        expect(status).toBe(200);
        expect(body[0].reactions.profundo.reactedByMe).toBe(true);
        expect(body[0].reactions.melancolico.reactedByMe).toBe(false);
        expect(body[0].reactions.rompeEsquemas.reactedByMe).toBe(true);
        expect(listDebates).toHaveBeenCalledWith({ email: 'ana@uclm.es' });
    });

    test('GET devuelve 401 si se envía un token no válido', async () => {
        const listDebates = jest.fn();
        server = await startServer(createService({ listDebates }));

        const { status } = await request('/api/debates', {
            method: 'GET',
            headers: { Authorization: 'Bearer token-invalido' }
        });

        expect(status).toBe(401);
        expect(listDebates).not.toHaveBeenCalled();
    });

    test('GET devuelve un error genérico si falla el servicio', async () => {
        const listDebates = jest.fn().mockRejectedValue(new Error('fallo interno'));
        server = await startServer(createService({ listDebates }));

        const { status, body } = await request('/api/debates', { method: 'GET' });

        expect(status).toBe(500);
        expect(body).toEqual({ message: 'No se pudieron obtener los debates' });
    });

    test('POST /:id/react alterna la reacción del usuario autenticado', async () => {
        const debate = createDebate();
        const reactToDebate = jest.fn().mockResolvedValue({
            debate,
            reacted: true,
            viewerId: 'usuario-1'
        });
        server = await startServer(createService({ reactToDebate }));

        const { status, body } = await request('/api/debates/debate-1/react', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ reaction: 'profundo' })
        });

        expect(status).toBe(200);
        expect(body).toEqual({
            _id: 'debate-1',
            reactions: {
                profundo: { label: 'Profundo', count: 2, reactedByMe: true },
                melancolico: { label: 'Melancólico', count: 0, reactedByMe: false },
                rompeEsquemas: { label: 'Rompe esquemas', count: 1, reactedByMe: true }
            }
        });
        expect(reactToDebate).toHaveBeenCalledWith({
            email: 'ana@uclm.es',
            id: 'debate-1',
            reaction: 'profundo'
        });
    });

    test('POST /:id/react exige autenticación', async () => {
        const reactToDebate = jest.fn();
        server = await startServer(createService({ reactToDebate }));

        const { status } = await request('/api/debates/debate-1/react', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ reaction: 'profundo' })
        });

        expect(status).toBe(401);
        expect(reactToDebate).not.toHaveBeenCalled();
    });

    test('POST /:id/react devuelve 400 si la reacción no es válida', async () => {
        const reactToDebate = jest.fn().mockRejectedValue(
            new DebateValidationError('La reacción no es válida')
        );
        server = await startServer(createService({ reactToDebate }));

        const { status, body } = await request('/api/debates/debate-1/react', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ reaction: 'reaccion-inventada' })
        });

        expect(status).toBe(400);
        expect(body).toEqual({ message: 'La reacción no es válida' });
    });

    test('POST /:id/react devuelve 404 si el debate no existe', async () => {
        const reactToDebate = jest.fn().mockRejectedValue(new DebateNotFoundError());
        server = await startServer(createService({ reactToDebate }));

        const { status, body } = await request('/api/debates/debate-inexistente/react', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ reaction: 'profundo' })
        });

        expect(status).toBe(404);
        expect(body).toEqual({ message: 'Debate no encontrado' });
    });

    test('POST /:id/react devuelve 401 si el usuario del token ya no existe', async () => {
        const reactToDebate = jest.fn().mockRejectedValue(new DebateUserNotFoundError());
        server = await startServer(createService({ reactToDebate }));

        const { status } = await request('/api/debates/debate-1/react', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ reaction: 'profundo' })
        });

        expect(status).toBe(401);
    });

    test('POST /:id/react devuelve 500 ante un error inesperado', async () => {
        const reactToDebate = jest.fn().mockRejectedValue(new Error('fallo interno'));
        server = await startServer(createService({ reactToDebate }));

        const { status, body } = await request('/api/debates/debate-1/react', {
            method: 'POST',
            headers: jsonHeaders(USER_TOKEN),
            body: JSON.stringify({ reaction: 'profundo' })
        });

        expect(status).toBe(500);
        expect(body).toEqual({ message: 'No se pudo registrar la reacción' });
    });

    test('DELETE elimina un debate cuando el usuario es administrador', async () => {
        const deleteDebate = jest.fn().mockResolvedValue({ _id: 'debate-1' });
        server = await startServer(createService({ deleteDebate }));

        const { status, body } = await request('/api/debates/debate-1', {
            method: 'DELETE',
            headers: jsonHeaders(ADMIN_TOKEN)
        });

        expect(status).toBe(200);
        expect(body).toEqual({ deleted: true, _id: 'debate-1' });
        expect(deleteDebate).toHaveBeenCalledWith({ id: 'debate-1' });
    });

    test('DELETE devuelve 403 si el usuario no es administrador', async () => {
        const deleteDebate = jest.fn();
        server = await startServer(createService({ deleteDebate }));

        const { status } = await request('/api/debates/debate-1', {
            method: 'DELETE',
            headers: jsonHeaders(USER_TOKEN)
        });

        expect(status).toBe(403);
        expect(deleteDebate).not.toHaveBeenCalled();
    });

    test('DELETE exige autenticación', async () => {
        const deleteDebate = jest.fn();
        server = await startServer(createService({ deleteDebate }));

        const { status } = await request('/api/debates/debate-1', {
            method: 'DELETE',
            headers: jsonHeaders()
        });

        expect(status).toBe(401);
        expect(deleteDebate).not.toHaveBeenCalled();
    });

    test('DELETE devuelve 404 si el debate no existe', async () => {
        const deleteDebate = jest.fn().mockRejectedValue(new DebateNotFoundError());
        server = await startServer(createService({ deleteDebate }));

        const { status, body } = await request('/api/debates/debate-inexistente', {
            method: 'DELETE',
            headers: jsonHeaders(ADMIN_TOKEN)
        });

        expect(status).toBe(404);
        expect(body).toEqual({ message: 'Debate no encontrado' });
    });

    test('DELETE devuelve 500 ante un error inesperado', async () => {
        const deleteDebate = jest.fn().mockRejectedValue(new Error('fallo interno'));
        server = await startServer(createService({ deleteDebate }));

        const { status, body } = await request('/api/debates/debate-1', {
            method: 'DELETE',
            headers: jsonHeaders(ADMIN_TOKEN)
        });

        expect(status).toBe(500);
        expect(body).toEqual({ message: 'No se pudo eliminar el debate' });
    });
});
