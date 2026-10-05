const activeSessions = new Map();

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ authenticated: false, message: 'Acceso denegado: No hay token' });
    }

    const token = authHeader.split(' ')[1];
    const session = activeSessions.get(token);

    if (!session) {
        return res.status(401).json({ authenticated: false, message: 'Sesión inválida o expirada' });
    }
    req.user = session; 
    next(); // 
};

const generateToken = (user) => {
    const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    activeSessions.set(token, user);
    return token;
};

const deleteToken = (token) => {
    activeSessions.delete(token);
};

module.exports = {
    authMiddleware,
    generateToken,
    deleteToken,
    activeSessions 
};