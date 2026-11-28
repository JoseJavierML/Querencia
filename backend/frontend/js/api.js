import { cerrarSesion, fetchAutenticado } from './auth.js';
import { ApiError } from './apiError.js';

const BASE_URL = '/api';

async function readResponseBody(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            return await response.json();
        } catch (error) {
            throw new ApiError(response.status, 'La respuesta del servidor no es válida.', 'INVALID_RESPONSE');
        }
    }

    const text = await response.text();
    if (!response.ok) {
        return { message: 'Error en la petición al servidor.' };
    }
    return text ? { message: text } : {};
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetchAutenticado(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        const data = await readResponseBody(response);
        if (!response.ok) {
            const message = data && (data.message || data.error)
                ? (data.message || data.error)
                : 'Error en la petición al servidor.';
            throw new ApiError(response.status, message);
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

    crearEntradaDiario: (text, title = '', vinylId = null) => fetchAPI('/diario', {
        method: 'POST',
        body: JSON.stringify({ text, title, vinylId })
    }),

    listarDiario: () => fetchAPI('/diario', { method: 'GET' }),

    eliminarEntradaDiario: (id) => fetchAPI(`/diario/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    }),

    crearDebate: (title, content, coverImageUrl = '', isAnonymous = false, vinylId = null) => fetchAPI('/debates', {
        method: 'POST',
        body: JSON.stringify({ title, content, coverImageUrl, isAnonymous, vinylId })
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

    crearPistaVelo: ({ releaseDate, audioUrl, title, artist, coverUrl, vinylId }) => fetchAPI('/velo/tracks', {
        method: 'POST',
        body: JSON.stringify({ releaseDate, audioUrl, title, artist, coverUrl, vinylId })
    }),

    listarPistasVelo: () => fetchAPI('/velo/tracks', { method: 'GET' }),

    reordenarPistasVelo: (trackIds) => fetchAPI('/velo/tracks/order', {
        method: 'PATCH',
        body: JSON.stringify({ trackIds })
    }),

    actualizarPistaVelo: (id, { releaseDate, audioUrl, title, artist, coverUrl, vinylId }) => fetchAPI(
        `/velo/tracks/${encodeURIComponent(id)}`,
        {
            method: 'PUT',
            body: JSON.stringify({ releaseDate, audioUrl, title, artist, coverUrl, vinylId })
        }
    ),

    listarCajonesArchivo: (agrupacion = 'genero') => fetchAPI(
        `/archivo/cajones?agrupar=${encodeURIComponent(agrupacion)}`,
        { method: 'GET' }
    ),

    listarVinilosArchivo: () => fetchAPI(
        '/archivo/cajones?agrupar=artista',
        { method: 'GET' }
    ),

    obtenerDiscoArchivo: (id) => fetchAPI(
        `/archivo/disco/${encodeURIComponent(id)}`,
        { method: 'GET' }
    ),

    buscarArchivo: ({ query, artist, title } = {}) => {
        const body = {};

        if (query !== undefined && query !== null) {
            body.query = query;
        }
        if (artist !== undefined && artist !== null) {
            body.artist = artist;
        }
        if (title !== undefined && title !== null) {
            body.title = title;
        }

        return fetchAPI('/archivo/buscar', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    checkSession: async () => {
        if (!localStorage.getItem('token') && !localStorage.getItem('querencia_token')) {
            return false;
        }

        try {
            await fetchAPI('/session', { method: 'GET' });
            return true;
        } catch (error) {
            if (error.status === 401) return false;
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
