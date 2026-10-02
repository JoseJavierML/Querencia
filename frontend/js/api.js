
const BASE_URL = 'http://localhost:3000/api'; 


async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                // Aquí inyectaremos el token de seguridad más adelante (P15)
                ...options.headers
            }
        });

        const data = await response.json();

        // Si el servidor devuelve un error (ej. credenciales incorrectas)
        if (!response.ok) {
            throw new Error(data.message || 'Error en la petición al servidor');
        }

        return data;
    } catch (error) {
        console.error('🔥 Error de comunicación con la API:', error);
        throw error;
    }
}

/**
 * Objeto 'api' que exporta los métodos que usaremos en el Frontend (Tarea #T29)
 */
export const api = {
    // Petición para iniciar sesión
    login: async (email, password) => {
        return await fetchAPI('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    // Petición para registrar un nuevo usuario
    registro: async (email, password) => {
        return await fetchAPI('/registro', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }
};