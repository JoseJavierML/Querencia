const mongoose = require('mongoose');
const { DiaryEntry } = require('./diaryModel');

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

    test('createdAt se genera en el servidor y es inmutable', () => {
        expect(DiaryEntry.schema.path('createdAt').options.immutable).toBe(true);
        expect(DiaryEntry.schema.path('createdAt').options.default).toBe(Date.now);
    });
});
