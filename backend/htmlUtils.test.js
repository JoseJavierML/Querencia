const { escapeHtml, serializeForInlineScript } = require('./htmlUtils');

describe('Utilidades HTML', () => {
    test('escapa los caracteres peligrosos de un texto', () => {
        expect(escapeHtml('<script>alert("x")</script>'))
            .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
        expect(escapeHtml("' & < >")).toBe('&#39; &amp; &lt; &gt;');
    });

    test('serializa valores para un script inline sin cerrar la etiqueta', () => {
        const serialized = serializeForInlineScript('</script><img src=x onerror=alert(1)>');
        expect(serialized).not.toContain('</script>');
        expect(serialized).toContain('\\u003c');
        expect(JSON.parse(serialized.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')))
            .toBe('</script><img src=x onerror=alert(1)>');
    });
});
