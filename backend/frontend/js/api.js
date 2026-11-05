import { cerrarSesion, fetchAutenticado } from './auth.js';

const BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetchAutenticado(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await response.json();
        if (!response.ok) {
            const error = new Error(data.message || 'Error en la petición al servidor');
            error.status = response.status;
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error de comunicación con la API:', error);
        throw error;
    }
}

export const api = {
    registro: (email, password) => fetchAPI('/registro', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    }),

    login: async (email, password) => {
        const data = await fetchAPI('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
            skipAuthRedirect: true
        });

        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('querencia_token', data.token);
            localStorage.setItem('querencia_user', JSON.stringify(data.user));
        }

        return data;
    },

    crearEntradaDiario: (text, title = '') => fetchAPI('/diario', {
        method: 'POST',
        body: JSON.stringify({ text, title })
    }),

    listarDiario: () => fetchAPI('/diario', { method: 'GET' }),

    eliminarEntradaDiario: (id) => fetchAPI(`/diario/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    }),

    crearDebate: (title, content, coverImageUrl = '', isAnonymous = false) => fetchAPI('/debates', {
        method: 'POST',
        body: JSON.stringify({ title, content, coverImageUrl, isAnonymous })
    }),

    eliminarDebate: (id) => fetchAPI(`/debates/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    }),

    listarDebates: () => fetchAPI('/debates', { method: 'GET' }),

    reaccionarDebate: (id, reaction) => fetchAPI(`/debates/${encodeURIComponent(id)}/react`, {
        method: 'POST',
        body: JSON.stringify({ reaction })
    }),

    obtenerVeloDelDia: () => fetchAPI('/velo/today', { method: 'GET' }),

    reflexionarVelo: (text) => fetchAPI('/velo/today/reflect', {
        method: 'POST',
        body: JSON.stringify({ text })
    }),

    crearPistaVelo: ({ releaseDate, audioUrl, title, artist, coverUrl }) => fetchAPI('/velo/tracks', {
        method: 'POST',
        body: JSON.stringify({ releaseDate, audioUrl, title, artist, coverUrl })
    }),

    listarPistasVelo: () => fetchAPI('/velo/tracks', { method: 'GET' }),

    actualizarPistaVelo: (id, { releaseDate, audioUrl, title, artist, coverUrl }) => fetchAPI(
        `/velo/tracks/${encodeURIComponent(id)}`,
        {
            method: 'PUT',
            body: JSON.stringify({ releaseDate, audioUrl, title, artist, coverUrl })
        }
    ),

    checkSession: async () => {
        if (!localStorage.getItem('token') && !localStorage.getItem('querencia_token')) {
            return false;
        }

        try {
            await fetchAPI('/session', { method: 'GET' });
            return true;
        } catch (error) {
            if (error.message.startsWith('La sesión ha caducado')) return false;
            throw error;
        }
    },

    logout: async () => {
        try {
            await fetchAPI('/logout', { method: 'POST' });
        } catch (error) {
            console.warn('Sesión ya expirada en el servidor, limpiando localmente.');
        } finally {
            cerrarSesion();
        }
    }
};
