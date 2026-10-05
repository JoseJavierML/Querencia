const BASE_URL = 'http://localhost:3000/api'; 

async function fetchAPI(endpoint, options = {}) {
    try {
        const token = localStorage.getItem('querencia_token');
        const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...authHeader,
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
    registro: async (email, password) => {
        return await fetchAPI('/registro', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },

    login: async (email, password) => {
        const data = await fetchAPI('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (data.token) {
            localStorage.setItem('querencia_token', data.token);
            localStorage.setItem('querencia_user', JSON.stringify(data.user));
        }
        
        return data;
    },

    checkSession: async () => {
        const token = localStorage.getItem('querencia_token');
        if (!token) return false;

        try {
            await fetchAPI('/session', { method: 'GET' });
            return true;
        } catch (error) {
            localStorage.removeItem('querencia_token');
            localStorage.removeItem('querencia_user');
            return false;
        }
    },

    logout: async () => {
        try {
            await fetchAPI('/logout', { method: 'POST' });
        } catch (error) {
            console.warn('Sesión ya expirada en el servidor, limpiando localmente.');
        } finally {
            localStorage.removeItem('querencia_token');
            localStorage.removeItem('querencia_user');
            window.location.href = 'index.html'; 
        }
    }
};