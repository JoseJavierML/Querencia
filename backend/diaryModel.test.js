const mongoose = require('mongoose');
const { DiaryEntry, DiaryRepository } = require('./diaryModel');

describe('Esquema DiaryEntry', () => {
    test('acepta una entrada válida y recorta el texto', async () => {
        const userId = new mongoose.Types.ObjectId();
        const entry = new DiaryEntry({ text: '  una escucha atenta  ', userId });

        await expect(entry.validate()).resolves.toBeUndefined();
        expect(entry.text).toBe('una escucha atenta');
        expect(entry.userId.toString()).toBe(userId.toString());
        expect(entry.createdAt).toBeInstanceOf(Date);
    });

    test('exige texto y userId', async () => {
        const entry = new DiaryEntry({});

        await expect(entry.validate()).rejects.toMatchObject({
            errors: {
                text: expect.anything(),
                userId: expect.anything()
            }
        });
    });

    test('referencia al modelo User y usa el nombre DiaryEntry', () => {
        expect(DiaryEntry.modelName).toBe('DiaryEntry');
        expect(DiaryEntry.schema.path('userId').options.ref).toBe('User');
    });

    test('rechaza textos de más de 5000 caracteres', async () => {
        const entry = new DiaryEntry({
            text: 'a'.repeat(5001),
            userId: new mongoose.Types.ObjectId()
        });

        await expect(entry.validate()).rejects.toMatchObject({
            errors: {
                text: expect.anything()
            }
        });
    });

    test('el título es opcional, se recorta y por defecto es vacío', async () => {
        const sinTitulo = new DiaryEntry({
            text: 'Sin título',
            userId: new mongoose.Types.ObjectId()
        });
        await expect(sinTitulo.validate()).resolves.toBeUndefined();
        expect(sinTitulo.title).toBe('');

        const conTitulo = new DiaryEntry({
            text: 'Con título',
            title: '  Mi primer eco  ',
            userId: new mongoose.Types.ObjectId()
        });
        await expect(conTitulo.validate()).resolves.toBeUndefined();
        expect(conTitulo.title).toBe('Mi primer eco');
    });

    test('rechaza títulos de más de 50 caracteres', async () => {
        const entry = new DiaryEntry({
            text: 'Con título largo',
            title: 'a'.repeat(51),
            userId: new mongoose.Types.ObjectId()
        });

        await expect(entry.validate()).rejects.toMatchObject({
            errors: {
                title: expect.anything()
            }
        });
    });

    test('acepta un título de exactamente 50 caracteres', async () => {
        const entry = new DiaryEntry({
            text: 'Con título justo',
            title: 'a'.repeat(50),
            userId: new mongoose.Types.ObjectId()
        });

        await expect(entry.validate()).resolves.toBeUndefined();
        expect(entry.title).toHaveLength(50);
    });

    test('createdAt se genera en el servidor y es inmutable', () => {
        expect(DiaryEntry.schema.path('createdAt').options.immutable).toBe(true);
        expect(DiaryEntry.schema.path('createdAt').options.default).toBe(Date.now);
    });
});

describe('Repositorio del diario', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('crea la entrada con el título recibido', async () => {
        const save = jest.spyOn(DiaryEntry.prototype, 'save').mockResolvedValue(undefined);

        const entry = await DiaryRepository.create({
            text: 'Texto',
            title: 'Título',
            userId: new mongoose.Types.ObjectId()
        });

        expect(entry.title).toBe('Título');
        expect(save).toHaveBeenCalled();
    });

    test('borra por _id y userId en la misma consulta', async () => {
        const deleted = { _id: 'entrada-1' };
        const findOneAndDelete = jest
            .spyOn(DiaryEntry, 'findOneAndDelete')
            .mockResolvedValue(deleted);
        const id = new mongoose.Types.ObjectId().toString();
        const userId = new mongoose.Types.ObjectId();

        const result = await DiaryRepository.deleteByIdForUser(id, userId);

        expect(findOneAndDelete).toHaveBeenCalledWith({ _id: id, userId });
        expect(result).toBe(deleted);
    });

    test('devuelve null sin consultar si el id no es un ObjectId válido', async () => {
        const findOneAndDelete = jest.spyOn(DiaryEntry, 'findOneAndDelete');

        const result = await DiaryRepository.deleteByIdForUser('no-es-un-id', 'usuario-1');

        expect(result).toBeNull();
        expect(findOneAndDelete).not.toHaveBeenCalled();
    });
});
