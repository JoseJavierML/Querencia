const mongoose = require('mongoose');
const { Debate, DebateRepository } = require('./debateModel');
const {
    REACTION_TYPES,
    MAX_TITLE_LENGTH,
    MAX_CONTENT_LENGTH
} = require('./debateConstants');

const validAuthorId = () => new mongoose.Types.ObjectId();

const createValidDebate = (overrides = {}) => new Debate({
    title: 'La ruptura temporal en Omega',
    content: 'Enrique Morente y Lagartija Nick rompieron el compás tradicional.',
    authorId: validAuthorId(),
    ...overrides
});

describe('Esquema Debate', () => {
    test('acepta un debate válido y recorta título y contenido', async () => {
        const debate = createValidDebate({
            title: '  La ruptura temporal en Omega  ',
            content: '  Un debate con alma  '
        });

        await expect(debate.validate()).resolves.toBeUndefined();
        expect(debate.title).toBe('La ruptura temporal en Omega');
        expect(debate.content).toBe('Un debate con alma');
        expect(debate.createdAt).toBeInstanceOf(Date);
    });

    test('exige título, contenido y autor', async () => {
        const debate = new Debate({});

        await expect(debate.validate()).rejects.toMatchObject({
            errors: {
                title: expect.anything(),
                content: expect.anything(),
                authorId: expect.anything()
            }
        });
    });

    test(`rechaza títulos de más de ${MAX_TITLE_LENGTH} caracteres`, async () => {
        const debate = createValidDebate({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1) });

        await expect(debate.validate()).rejects.toMatchObject({
            errors: { title: expect.anything() }
        });
    });

    test(`rechaza contenidos de más de ${MAX_CONTENT_LENGTH} caracteres`, async () => {
        const debate = createValidDebate({ content: 'a'.repeat(MAX_CONTENT_LENGTH + 1) });

        await expect(debate.validate()).rejects.toMatchObject({
            errors: { content: expect.anything() }
        });
    });

    test('crea las seis reacciones como arrays vacíos de ObjectId', () => {
        const debate = createValidDebate();

        REACTION_TYPES.forEach((reaction) => {
            expect(Array.from(debate.reactions[reaction])).toEqual([]);
        });
    });

    test('referencia al modelo User y usa el nombre Debate', () => {
        expect(Debate.modelName).toBe('Debate');
        expect(Debate.schema.path('authorId').options.ref).toBe('User');
        REACTION_TYPES.forEach((reaction) => {
            expect(Debate.schema.path(`reactions.${reaction}`).embeddedSchemaType.options.ref).toBe('User');
        });
    });

    test('createdAt se genera en el servidor y es inmutable', () => {
        expect(Debate.schema.path('createdAt').options.immutable).toBe(true);
        expect(Debate.schema.path('createdAt').options.default).toBe(Date.now);
    });
});

describe('Repositorio de debates', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('crea el debate con el autor recibido', async () => {
        const save = jest.spyOn(Debate.prototype, 'save').mockResolvedValue(undefined);
        const authorId = validAuthorId();

        const debate = await DebateRepository.create({
            title: '  Título  ',
            content: '  Contenido  ',
            authorId
        });

        expect(debate.title).toBe('Título');
        expect(debate.content).toBe('Contenido');
        expect(debate.authorId.toString()).toBe(authorId.toString());
        expect(save).toHaveBeenCalled();
    });

    test('lista los debates del más reciente al más antiguo con el autor', async () => {
        const debates = [{ _id: 'debate-1' }];
        const lean = jest.fn().mockResolvedValue(debates);
        const populate = jest.fn().mockReturnValue({ lean });
        const sort = jest.fn().mockReturnValue({ populate });
        const find = jest.spyOn(Debate, 'find').mockReturnValue({ sort });

        const result = await DebateRepository.findAll();

        expect(find).toHaveBeenCalledWith({});
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(populate).toHaveBeenCalledWith('authorId', 'email');
        expect(lean).toHaveBeenCalled();
        expect(result).toBe(debates);
    });

    test('quita la reacción si el usuario ya había votado', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const userId = validAuthorId();
        const debate = { _id: id };
        const findOneAndUpdate = jest
            .spyOn(Debate, 'findOneAndUpdate')
            .mockResolvedValue(debate);

        const result = await DebateRepository.toggleReaction(id, 'profundo', userId);

        expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(findOneAndUpdate).toHaveBeenCalledWith(
            { _id: id, 'reactions.profundo': userId },
            { $pull: { 'reactions.profundo': userId } },
            { new: true }
        );
        expect(result).toEqual({ debate, reacted: false });
    });

    test('añade la reacción si el usuario no había votado', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const userId = validAuthorId();
        const debate = { _id: id };
        const findOneAndUpdate = jest
            .spyOn(Debate, 'findOneAndUpdate')
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(debate);

        const result = await DebateRepository.toggleReaction(id, 'profundo', userId);

        expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
        expect(findOneAndUpdate).toHaveBeenNthCalledWith(
            2,
            { _id: id },
            { $addToSet: { 'reactions.profundo': userId } },
            { new: true }
        );
        expect(result).toEqual({ debate, reacted: true });
    });

    test('devuelve null si el debate no existe', async () => {
        const id = new mongoose.Types.ObjectId().toString();
        const userId = validAuthorId();
        const findOneAndUpdate = jest
            .spyOn(Debate, 'findOneAndUpdate')
            .mockResolvedValue(null);

        const result = await DebateRepository.toggleReaction(id, 'profundo', userId);

        expect(result).toBeNull();
        expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    });

    test('no consulta si el id o la reacción no son válidos', async () => {
        const findOneAndUpdate = jest.spyOn(Debate, 'findOneAndUpdate');
        const userId = validAuthorId();

        await expect(DebateRepository.toggleReaction('no-es-un-id', 'profundo', userId))
            .resolves.toBeNull();
        await expect(DebateRepository.toggleReaction(
            new mongoose.Types.ObjectId().toString(),
            'reaccion-inventada',
            userId
        )).resolves.toBeNull();

        expect(findOneAndUpdate).not.toHaveBeenCalled();
    });
});
