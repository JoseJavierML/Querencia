const {
    isValidObjectId,
    normalizeVinylId,
    resolveUserId,
    normalizeHttpUrl
} = require('./validation');

class TestValidationError extends Error {}
class TestUserNotFoundError extends Error {}

const VALID_ID = '507f1f77bcf86cd799439011';

describe('Validaciones compartidas', () => {
    test('isValidObjectId acepta ObjectId de 24 caracteres y rechaza el resto', () => {
        expect(isValidObjectId(VALID_ID)).toBe(true);
        expect(isValidObjectId(` ${VALID_ID} `)).toBe(true);
        expect(isValidObjectId('no-valido')).toBe(false);
        expect(isValidObjectId(null)).toBe(false);
        expect(isValidObjectId(123)).toBe(false);
    });

    test('normalizeVinylId devuelve null para un vinilo opcional vacío', async () => {
        await expect(normalizeVinylId(undefined, null, TestValidationError)).resolves.toBeNull();
        await expect(normalizeVinylId('', null, TestValidationError)).resolves.toBeNull();
    });

    test('normalizeVinylId valida el identificador y su existencia', async () => {
        await expect(normalizeVinylId('no-valido', null, TestValidationError))
            .rejects.toBeInstanceOf(TestValidationError);

        const missingRepository = {
            findById: jest.fn().mockResolvedValue(null)
        };
        await expect(normalizeVinylId(VALID_ID, missingRepository, TestValidationError))
            .rejects.toBeInstanceOf(TestValidationError);

        const repository = {
            findById: jest.fn().mockResolvedValue({ _id: VALID_ID })
        };
        await expect(normalizeVinylId(` ${VALID_ID} `, repository, TestValidationError))
            .resolves.toBe(VALID_ID);
        expect(repository.findById).toHaveBeenCalledWith(VALID_ID);
    });

    test('resolveUserId devuelve el id o lanza el error del servicio', async () => {
        const userRepository = {
            findByEmail: jest.fn().mockResolvedValue({ _id: 'user-1' })
        };
        await expect(resolveUserId('a@b.com', userRepository, TestUserNotFoundError))
            .resolves.toBe('user-1');

        userRepository.findByEmail.mockResolvedValue(null);
        await expect(resolveUserId('a@b.com', userRepository, TestUserNotFoundError))
            .rejects.toBeInstanceOf(TestUserNotFoundError);
    });

    test('normalizeHttpUrl normaliza URLs http/https y rechaza esquemas peligrosos', () => {
        const options = {
            field: 'La URL',
            maxLength: 100,
            ValidationError: TestValidationError
        };

        expect(normalizeHttpUrl(' https://example.com/a ', options)).toBe('https://example.com/a');
        expect(normalizeHttpUrl('', options)).toBeNull();
        expect(normalizeHttpUrl(undefined, options)).toBeNull();
        expect(() => normalizeHttpUrl('javascript:alert(1)', options))
            .toThrow('La URL debe empezar por http o https');
        expect(() => normalizeHttpUrl('no-es-url', options)).toThrow('La URL no es válido');
        expect(() => normalizeHttpUrl('https://example.com/' + 'a'.repeat(100), options))
            .toThrow('no puede superar los 100 caracteres');
        expect(() => normalizeHttpUrl(null, { ...options, required: true }))
            .toThrow('La URL es obligatorio');
    });
});
