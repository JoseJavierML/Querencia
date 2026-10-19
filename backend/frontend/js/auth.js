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
        const bytes = Uint8Array.from(atob(base64 + '='.repeat(padding)), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
        console.warn('Token JWT no válido para decodificar:', error);
        return null;
    }
}

export function obtenerUsuarioActual() {
    const token = obtenerToken();
    if (!token) return null;

    try {
        const userRaw = localStorage.getItem('querencia_user');
        if (userRaw) {
            const user = JSON.parse(userRaw);
            if (user && user.email) {
                return {
                    email: user.email || user.username || null,
                    rol: user.rol || user.role || 'user'
                };
            }
        }
    } catch (e) {
        console.warn('Error leyendo querencia_user', e);
    }

    const payload = decodificarPayload(token);
    if (!payload) return null;

    return {
        email: payload.email || payload.username || null,
        rol: payload.rol || payload.role || 'user'
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
    const container = document.querySelector('[data-auth-header]');
    if (!container) return;
    const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    if (isIndex) {
        return; 
    }

    const usuario = obtenerUsuarioActual();
    
    if (!usuario) {
        container.innerHTML = `
            <a class="nav-link" href="index.html#login-form">Iniciar sesión</a>
            <a class="nav-link" href="index.html#register-form">Registrarse</a>
        `;
        return;
    }

    const emailStr = usuario.email || 'oyente@querencia.es';
    const inicial = emailStr.charAt(0).toUpperCase();
    const isAdmin = usuario.rol === 'admin';

    container.innerHTML = `
        <div id="userProfileBadge" style="display: inline-flex; align-items: center; gap: 0.65rem; padding: 0.3rem 0.85rem 0.3rem 0.4rem; border-radius: 9999px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(184, 147, 69, 0.2); backdrop-filter: blur(8px);">
            <div style="width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, rgba(184, 147, 69, 0.25), rgba(58, 10, 10, 0.6)); border: 1px solid rgba(234, 221, 179, 0.4); display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', serif; font-size: 0.8rem; font-weight: 600; color: var(--gold-light); text-shadow: 0 0 8px rgba(234, 221, 179, 0.4);">${inicial}</div>
            <div style="display: flex; flex-direction: column; text-align: left; line-height: 1.15;">
                <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: var(--gold-dark); font-family: -apple-system, sans-serif;">${isAdmin ? 'Admin' : 'Oyente'}</span>
                <span id="currentUserEmail" style="font-family: 'Lora', serif; font-size: 0.82rem; color: var(--gold-light); font-style: italic; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emailStr}</span>
            </div>
        </div>
        <button class="logout-btn" id="logoutBtn" type="button">Cerrar sesión</button>
    `;

    const btnLogout = container.querySelector('#logoutBtn');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.ejecutarLogout) {
                window.ejecutarLogout();
            } else {
                cerrarSesion();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', renderHeader);