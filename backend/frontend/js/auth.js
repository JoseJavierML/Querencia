const TOKEN_KEYS = ['token', 'querencia_token'];

function obtenerToken() {
    return TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || null;
}

function decodificarPayload(token) {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;

        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - (base64.length % 4)) % 4;
        const bytes = Uint8Array.from(atob(base64 + '='.repeat(padding)), (character) => character.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
        console.warn('Token JWT no válido:', error);
        return null;
    }
}

export function obtenerUsuarioActual() {
    const token = obtenerToken();
    if (!token) return null;

    const payload = decodificarPayload(token);
    if (!payload || (payload.exp && payload.exp * 1000 <= Date.now())) return null;

    return {
        ...payload,
        email: payload.email || payload.username || null,
        rol: payload.rol || payload.role || null
    };
}

export function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('querencia_token');
    localStorage.removeItem('querencia_user');
    window.location.href = 'index.html';
}

export async function fetchAutenticado(url, options = {}) {
    const token = obtenerToken();
    const headers = { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...options.headers };
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        cerrarSesion();
        throw new Error('La sesión ha caducado. Inicia sesión de nuevo.');
    }

    return response;
}

export function renderHeader() {
    const container = document.querySelector('[data-auth-header], #authHeader, .nav-actions');
    if (!container) return;

    const usuario = obtenerUsuarioActual();
    if (!usuario) {
        container.innerHTML = `
            <a class="nav-link" href="index.html#login-form">Iniciar sesión</a>
            <a class="nav-link" href="index.html#register-form">Registrarse</a>
        `;
        return;
    }

    const identificador = usuario.email || usuario.name || 'Usuario';
    container.innerHTML = `
        <span class="user-greeting" aria-label="Usuario activo">${identificador}</span>
        <button class="logout-btn" id="logoutBtn" type="button">Cerrar sesión</button>
    `;
    container.querySelector('#logoutBtn').addEventListener('click', cerrarSesion);
}

document.addEventListener('DOMContentLoaded', renderHeader);
