const HTML_ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

const escapeHtml = (value) => String(value ?? '').replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character]
);

const serializeForInlineScript = (value) => JSON.stringify(value ?? '')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

module.exports = {
    escapeHtml,
    serializeForInlineScript
};
