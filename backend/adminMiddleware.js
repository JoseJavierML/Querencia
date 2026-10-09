const isAdminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ message: 'Acceso denegado. Se requieren permisos de administrador.' });
};

module.exports = isAdminMiddleware;