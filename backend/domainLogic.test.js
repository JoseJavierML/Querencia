const { verificarDominio } = require('./domainLogic.js');

beforeAll(() => {
    process.env.ALLOWED_DOMAINS = 'uclm.es,alu.uclm.es';
});

test('variante3: permite un dominio exacto en minúsculas', () => {
    expect(verificarDominio('ana@uclm.es')).toBe(true);
});

test('variante3: permite un dominio exacto en mayúsculas', () => {
    expect(verificarDominio('JUAN@ALU.UCLM.ES')).toBe(true);
});

test('variante3: rechaza un subdominio no listado', () => {
    expect(verificarDominio('x@sub.uclm.es')).toBe(false);
});

test('variante3: rechaza otro dominio genérico', () => {
    expect(verificarDominio('luis@gmail.com')).toBe(false);
});