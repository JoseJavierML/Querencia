const {
    createDebateService,
    DebateValidationError,
    DebateUserNotFoundError,
    DebateNotFoundError
} = require('./debateService');
const {
    MAX_TITLE_LENGTH,
    MAX_CONTENT_LENGTH
} = require('./debateConstants');

const createFakes = () => ({
    debateRepository: {
        create: jest.fn(),
        findAll: jest.fn(),
        toggleReaction: jest.fn()
    },
    userRepository: {
        findByEmail: jest.fn()
    }
});

describe('Servicio de debates', () => {
    let debateRepository;
    let userRepository;
    let service;

    beforeEach(() => {
        const fakes = createFakes();
        debateRepository = fakes.debateRepository;
        userRepository = fakes.userRepository;
        service = createDebateService({ debateRepository, userRepository });
    });

    test('crea un debate recortando título y contenido y usando el ObjectId del autor', async () => {
        const authorId = 'usuario-1';
        const debate = { _id: 'debate-1', title: 'Título', content: 'Contenido', authorId };
        userRepository.findByEmail.mockResolvedValue({ _id: authorId });
        debateRepository.create.mockResolvedValue(debate);

        const result = await service.createDebate({
            email: 'admin@querencia.es',
            title: '  Título  ',
            content: '  Contenido  '
        });

        expect(userRepository.findByEmail).toHaveBeenCalledWith('admin@querencia.es');
        expect(debateRepository.create).toHaveBeenCalledWith({
            title: 'Título',
            content: 'Contenido',
            authorId
        });
        expect(result).toBe(debate);
    });

    test('rechaza un título ausente o que no sea texto', async () => {
        await expect(service.createDebate({ email: 'admin@querencia.es', content: 'Contenido' }))
            .rejects.toBeInstanceOf(DebateValidationError);
        await expect(service.createDebate({ email: 'admin@querencia.es', title: 42, content: 'Contenido' }))
            .rejects.toBeInstanceOf(DebateValidationError);

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test('rechaza un título vacío o formado solo por espacios', async () => {
        await expect(service.createDebate({
            email: 'admin@querencia.es',
            title: '   ',
            content: 'Contenido'
        })).rejects.toThrow('El título no puede estar vacío');

        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test(`rechaza un título de más de ${MAX_TITLE_LENGTH} caracteres`, async () => {
        await expect(service.createDebate({
            email: 'admin@querencia.es',
            title: 'a'.repeat(MAX_TITLE_LENGTH + 1),
            content: 'Contenido'
        })).rejects.toThrow(`no puede superar los ${MAX_TITLE_LENGTH} caracteres`);

        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test('rechaza un contenido ausente o que no sea texto', async () => {
        await expect(service.createDebate({ email: 'admin@querencia.es', title: 'Título' }))
            .rejects.toBeInstanceOf(DebateValidationError);
        await expect(service.createDebate({ email: 'admin@querencia.es', title: 'Título', content: 42 }))
            .rejects.toBeInstanceOf(DebateValidationError);

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test('rechaza un contenido vacío o formado solo por espacios', async () => {
        await expect(service.createDebate({
            email: 'admin@querencia.es',
            title: 'Título',
            content: '   '
        })).rejects.toThrow('El contenido no puede estar vacío');

        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test(`rechaza un contenido de más de ${MAX_CONTENT_LENGTH} caracteres`, async () => {
        await expect(service.createDebate({
            email: 'admin@querencia.es',
            title: 'Título',
            content: 'a'.repeat(MAX_CONTENT_LENGTH + 1)
        })).rejects.toThrow(`no puede superar los ${MAX_CONTENT_LENGTH} caracteres`);

        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test('lanza un error de dominio si el autor no existe', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.createDebate({
            email: 'fantasma@querencia.es',
            title: 'Título',
            content: 'Contenido'
        })).rejects.toBeInstanceOf(DebateUserNotFoundError);

        expect(debateRepository.create).not.toHaveBeenCalled();
    });

    test('lista los debates sin usuario cuando la lectura es pública', async () => {
        const debates = [{ _id: 'debate-1' }];
        debateRepository.findAll.mockResolvedValue(debates);

        const result = await service.listDebates();

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
        expect(debateRepository.findAll).toHaveBeenCalled();
        expect(result).toEqual({ debates, viewerId: null });
    });

    test('lista los debates con el ObjectId del usuario autenticado', async () => {
        const debates = [{ _id: 'debate-1' }];
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        debateRepository.findAll.mockResolvedValue(debates);

        const result = await service.listDebates({ email: 'ana@uclm.es' });

        expect(userRepository.findByEmail).toHaveBeenCalledWith('ana@uclm.es');
        expect(result).toEqual({ debates, viewerId: 'usuario-1' });
    });

    test('no lista si el usuario del token ya no existe', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.listDebates({ email: 'fantasma@querencia.es' }))
            .rejects.toBeInstanceOf(DebateUserNotFoundError);

        expect(debateRepository.findAll).not.toHaveBeenCalled();
    });

    test('rechaza una reacción desconocida antes de buscar al usuario', async () => {
        await expect(service.reactToDebate({
            email: 'ana@uclm.es',
            id: 'debate-1',
            reaction: 'reaccion-inventada'
        })).rejects.toBeInstanceOf(DebateValidationError);

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
        expect(debateRepository.toggleReaction).not.toHaveBeenCalled();
    });

    test('alterna una reacción y devuelve el debate actualizado', async () => {
        const debate = { _id: 'debate-1', reactions: { profundo: ['usuario-1'] } };
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        debateRepository.toggleReaction.mockResolvedValue({ debate, reacted: true });

        const result = await service.reactToDebate({
            email: 'ana@uclm.es',
            id: 'debate-1',
            reaction: 'profundo'
        });

        expect(debateRepository.toggleReaction).toHaveBeenCalledWith(
            'debate-1',
            'profundo',
            'usuario-1'
        );
        expect(result).toEqual({
            debate,
            reacted: true,
            viewerId: 'usuario-1'
        });
    });

    test('lanza un error de dominio si el debate no existe', async () => {
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        debateRepository.toggleReaction.mockResolvedValue(null);

        await expect(service.reactToDebate({
            email: 'ana@uclm.es',
            id: 'debate-inexistente',
            reaction: 'profundo'
        })).rejects.toBeInstanceOf(DebateNotFoundError);
    });

    test('no reacciona si el usuario de la sesión no existe', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.reactToDebate({
            email: 'fantasma@querencia.es',
            id: 'debate-1',
            reaction: 'profundo'
        })).rejects.toBeInstanceOf(DebateUserNotFoundError);

        expect(debateRepository.toggleReaction).not.toHaveBeenCalled();
    });
});
