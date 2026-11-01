const {
    createDiaryService,
    DiaryValidationError,
    DiaryUserNotFoundError,
    DiaryEntryNotFoundError
} = require('./diaryService');

const createFakes = () => ({
    diaryRepository: {
        create: jest.fn(),
        findByUserId: jest.fn(),
        deleteByIdForUser: jest.fn()
    },
    userRepository: {
        findByEmail: jest.fn()
    }
});

describe('Servicio del diario', () => {
    let diaryRepository;
    let userRepository;
    let service;

    beforeEach(() => {
        const fakes = createFakes();
        diaryRepository = fakes.diaryRepository;
        userRepository = fakes.userRepository;
        service = createDiaryService({ diaryRepository, userRepository });
    });

    test('crea una entrada recortando el texto y usando el ObjectId del usuario', async () => {
        const userId = 'usuario-1';
        const entry = { _id: 'entrada-1', text: 'Hoy escuché un disco', title: '', userId };
        userRepository.findByEmail.mockResolvedValue({ _id: userId });
        diaryRepository.create.mockResolvedValue(entry);

        const result = await service.createEntry({
            email: 'ana@uclm.es',
            text: '  Hoy escuché un disco  '
        });

        expect(userRepository.findByEmail).toHaveBeenCalledWith('ana@uclm.es');
        expect(diaryRepository.create).toHaveBeenCalledWith({
            text: 'Hoy escuché un disco',
            title: '',
            userId
        });
        expect(result).toBe(entry);
    });

    test('crea una entrada recortando también el título', async () => {
        const entry = { _id: 'entrada-1', text: 'Hoy escuché un disco', title: 'Mi primer eco', userId: 'usuario-1' };
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.create.mockResolvedValue(entry);

        const result = await service.createEntry({
            email: 'ana@uclm.es',
            text: 'Hoy escuché un disco',
            title: '  Mi primer eco  '
        });

        expect(diaryRepository.create).toHaveBeenCalledWith({
            text: 'Hoy escuché un disco',
            title: 'Mi primer eco',
            userId: 'usuario-1'
        });
        expect(result).toBe(entry);
    });

    test('rechaza un texto ausente o que no sea string', async () => {
        await expect(service.createEntry({ email: 'ana@uclm.es' }))
            .rejects.toBeInstanceOf(DiaryValidationError);
        await expect(service.createEntry({ email: 'ana@uclm.es', text: 42 }))
            .rejects.toBeInstanceOf(DiaryValidationError);

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
        expect(diaryRepository.create).not.toHaveBeenCalled();
    });

    test('rechaza un texto vacío o formado solo por espacios', async () => {
        await expect(service.createEntry({ email: 'ana@uclm.es', text: '   ' }))
            .rejects.toThrow('El texto no puede estar vacío');

        expect(diaryRepository.create).not.toHaveBeenCalled();
    });

    test('rechaza un texto que supera el límite configurado', async () => {
        service = createDiaryService({
            diaryRepository,
            userRepository,
            maxTextLength: 10
        });

        await expect(service.createEntry({ email: 'ana@uclm.es', text: 'a'.repeat(11) }))
            .rejects.toThrow('no puede superar los 10 caracteres');

        expect(diaryRepository.create).not.toHaveBeenCalled();
    });

    test('acepta un texto que cabe exactamente en el límite configurado', async () => {
        service = createDiaryService({
            diaryRepository,
            userRepository,
            maxTextLength: 10
        });
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.create.mockResolvedValue({ text: 'a'.repeat(10) });

        await service.createEntry({ email: 'ana@uclm.es', text: 'a'.repeat(10) });

        expect(diaryRepository.create).toHaveBeenCalledWith({
            text: 'a'.repeat(10),
            title: '',
            userId: 'usuario-1'
        });
    });

    test('usa 5000 caracteres como límite por defecto', async () => {
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.create.mockResolvedValue({ text: 'a'.repeat(5000) });

        await service.createEntry({ email: 'ana@uclm.es', text: 'a'.repeat(5000) });
        expect(diaryRepository.create).toHaveBeenCalled();

        await expect(service.createEntry({ email: 'ana@uclm.es', text: 'a'.repeat(5001) }))
            .rejects.toThrow('no puede superar los 5000 caracteres');
    });

    test('rechaza un título que no sea string', async () => {
        await expect(service.createEntry({
            email: 'ana@uclm.es',
            text: 'hola',
            title: 42
        })).rejects.toThrow('El título debe ser texto');

        expect(diaryRepository.create).not.toHaveBeenCalled();
    });

    test('rechaza un título de más de 50 caracteres', async () => {
        await expect(service.createEntry({
            email: 'ana@uclm.es',
            text: 'hola',
            title: 'a'.repeat(51)
        })).rejects.toThrow('no puede superar los 50 caracteres');

        expect(diaryRepository.create).not.toHaveBeenCalled();
    });

    test('acepta un título de exactamente 50 caracteres', async () => {
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.create.mockResolvedValue({ title: 'a'.repeat(50) });

        await service.createEntry({
            email: 'ana@uclm.es',
            text: 'hola',
            title: 'a'.repeat(50)
        });

        expect(diaryRepository.create).toHaveBeenCalledWith({
            text: 'hola',
            title: 'a'.repeat(50),
            userId: 'usuario-1'
        });
    });

    test('lanza un error de dominio si el usuario de la sesión no existe', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.createEntry({ email: 'fantasma@uclm.es', text: 'hola' }))
            .rejects.toBeInstanceOf(DiaryUserNotFoundError);
        expect(diaryRepository.create).not.toHaveBeenCalled();
    });

    test('lista las entradas del usuario autenticado', async () => {
        const entries = [
            { _id: 'entrada-2', text: 'Segunda', title: '', userId: 'usuario-1' },
            { _id: 'entrada-1', text: 'Primera', title: '', userId: 'usuario-1' }
        ];
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.findByUserId.mockResolvedValue(entries);

        const result = await service.listEntries({ email: 'ana@uclm.es' });

        expect(userRepository.findByEmail).toHaveBeenCalledWith('ana@uclm.es');
        expect(diaryRepository.findByUserId).toHaveBeenCalledWith('usuario-1');
        expect(result).toBe(entries);
    });

    test('no lista entradas si el usuario de la sesión no existe', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.listEntries({ email: 'fantasma@uclm.es' }))
            .rejects.toBeInstanceOf(DiaryUserNotFoundError);
        expect(diaryRepository.findByUserId).not.toHaveBeenCalled();
    });

    test('elimina una entrada del usuario autenticado', async () => {
        const entry = { _id: 'entrada-1', text: 'Primera', userId: 'usuario-1' };
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.deleteByIdForUser.mockResolvedValue(entry);

        const result = await service.deleteEntry({
            email: 'ana@uclm.es',
            id: 'entrada-1'
        });

        expect(diaryRepository.deleteByIdForUser).toHaveBeenCalledWith('entrada-1', 'usuario-1');
        expect(result).toBe(entry);
    });

    test('lanza un error de dominio si el eco no existe o es de otro usuario', async () => {
        userRepository.findByEmail.mockResolvedValue({ _id: 'usuario-1' });
        diaryRepository.deleteByIdForUser.mockResolvedValue(null);

        await expect(service.deleteEntry({ email: 'ana@uclm.es', id: 'entrada-ajena' }))
            .rejects.toBeInstanceOf(DiaryEntryNotFoundError);
    });

    test('no intenta borrar si el usuario de la sesión no existe', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.deleteEntry({ email: 'fantasma@uclm.es', id: 'entrada-1' }))
            .rejects.toBeInstanceOf(DiaryUserNotFoundError);
        expect(diaryRepository.deleteByIdForUser).not.toHaveBeenCalled();
    });
});
