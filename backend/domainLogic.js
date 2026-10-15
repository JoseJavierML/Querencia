function verificarDominio(email) {
    const allowedDomainsStr = process.env.ALLOWED_DOMAINS || '';
    const allowedDomains = allowedDomainsStr.split(',').map(d => d.trim().toLowerCase());
    const partes = email.split('@');
    const dominio = partes[partes.length - 1].toLowerCase();
    return allowedDomains.includes(dominio);
}

module.exports = { verificarDominio };