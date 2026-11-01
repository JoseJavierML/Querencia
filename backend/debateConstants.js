const REACTION_DEFINITIONS = Object.freeze([
    Object.freeze({ key: 'profundo', label: 'Profundo' }),
    Object.freeze({ key: 'melancolico', label: 'Melancólico' }),
    Object.freeze({ key: 'rompeEsquemas', label: 'Rompe esquemas' })
]);

const REACTION_TYPES = Object.freeze(
    REACTION_DEFINITIONS.map(({ key }) => key)
);

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const MAX_COVER_URL_LENGTH = 2048;

module.exports = {
    REACTION_DEFINITIONS,
    REACTION_TYPES,
    MAX_TITLE_LENGTH,
    MAX_CONTENT_LENGTH,
    MAX_COVER_URL_LENGTH
};
