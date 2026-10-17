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
            throw new Error(data.message || 'Error en la petición al servidor');
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
            body: JSON.stringify({ email, password })
        });

        if (data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('querencia_token', data.token);
            localStorage.setItem('querencia_user', JSON.stringify(data.user));
        }

        return data;
    },

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
