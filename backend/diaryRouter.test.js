const express = require('express');
const { createDiaryRouter } = require('./diaryRouter');
const { DiaryValidationError, DiaryUserNotFoundError } = require('./diaryService');

const AUTH_TOKEN = 'Bearer test-token';

const authMiddleware = (req, res, next) => {
    if (req.headers.authorization !== AUTH_TOKEN) {
        return res.status(401).json({ message: 'Acceso denegado: No hay token' });
    }
    req.user = { email: 'ana@uclm.es', role: 'usuario' };
    next();
};

const startServer = (diaryService) => new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/diario', createDiaryRouter({ diaryService, authMiddleware }));
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

const jsonHeaders = (withAuth = true) => ({
    'Content-Type': 'application/json',
    ...(withAuth ? { Authorization: AUTH_TOKEN } : {})
});

describe('Rutas del diario', () => {
    test('POST crea una entrada para el usuario autenticado', async () => {
        const createdAt = new Date('2026-10-30T10:00:00.000Z');
        const createEntry = jest.fn().mockResolvedValue({
            _id: 'entrada-1',
            text: 'Hoy escuché un disco',
            createdAt,
            userId: 'usuario-1'
        });
        server = await startServer({ createEntry, listEntries: jest.fn() });

        const { status, body } = await request('/api/diario', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ text: 'Hoy escuché un disco' })
        });

        expect(status).toBe(201);
        expect(body).toEqual({
            _id: 'entrada-1',
            text: 'Hoy escuché un disco',
            createdAt: '2026-10-30T10:00:00.000Z',
            userId: 'usuario-1'
        });
        expect(createEntry).toHaveBeenCalledWith({
            email: 'ana@uclm.es',
            text: 'Hoy escuché un disco'
        });
    });

    test('POST devuelve 400 si el texto no es válido', async () => {
        const createEntry = jest.fn().mockRejectedValue(
            new DiaryValidationError('El texto no puede estar vacío')
        );
        server = await startServer({ createEntry, listEntries: jest.fn() });

        const { status, body } = await request('/api/diario', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ text: '   ' })
        });

        expect(status).toBe(400);
        expect(body).toEqual({ message: 'El texto no puede estar vacío' });
    });

    test('POST devuelve 401 si el usuario de la sesión ya no existe', async () => {
        const createEntry = jest.fn().mockRejectedValue(new DiaryUserNotFoundError());
        server = await startServer({ createEntry, listEntries: jest.fn() });

        const { status, body } = await request('/api/diario', {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify({ text: 'hola' })
        });

        expect(status).toBe(401);
        expect(body.message).toBe('No existe un usuario asociado a la sesión');
    });

    test('POST exige autenticación y no llama al servicio sin token', async () => {
        const createEntry = jest.fn();
        server = await startServer({ createEntry, listEntries: jest.fn() });

        const { status } = await request('/api/diario', {
            method: 'POST',
            headers: jsonHeaders(false),
            body: JSON.stringify({ text: 'hola' })
        });

        expect(status).toBe(401);
        expect(createEntry).not.toHaveBeenCalled();
    });

    test('GET lista únicamente las entradas del usuario autenticado', async () => {
        const listEntries = jest.fn().mockResolvedValue([
            {
                _id: 'entrada-2',
                text: 'Segunda',
                createdAt: new Date('2026-10-30T11:00:00.000Z'),
                userId: 'usuario-1'
            },
            {
                _id: 'entrada-1',
                text: 'Primera',
                createdAt: new Date('2026-10-30T10:00:00.000Z'),
                userId: 'usuario-1'
            }
        ]);
        server = await startServer({ createEntry: jest.fn(), listEntries });

        const { status, body } = await request('/api/diario', {
            method: 'GET',
            headers: { Authorization: AUTH_TOKEN }
        });

        expect(status).toBe(200);
        expect(body).toHaveLength(2);
        expect(body[0]).toEqual({
            _id: 'entrada-2',
            text: 'Segunda',
            createdAt: '2026-10-30T11:00:00.000Z',
            userId: 'usuario-1'
        });
        expect(listEntries).toHaveBeenCalledWith({ email: 'ana@uclm.es' });
    });

    test('GET exige autenticación y no llama al servicio sin token', async () => {
        const listEntries = jest.fn();
        server = await startServer({ createEntry: jest.fn(), listEntries });

        const { status } = await request('/api/diario', { method: 'GET' });

        expect(status).toBe(401);
        expect(listEntries).not.toHaveBeenCalled();
    });

    test('GET devuelve un error genérico si falla el servicio', async () => {
        const listEntries = jest.fn().mockRejectedValue(new Error('fallo interno'));
        server = await startServer({ createEntry: jest.fn(), listEntries });

        const { status, body } = await request('/api/diario', {
            method: 'GET',
            headers: { Authorization: AUTH_TOKEN }
        });

        expect(status).toBe(500);
        expect(body).toEqual({ message: 'No se pudieron obtener las entradas del diario' });
    });
});
