const UserModel = require('./userModel');

beforeEach(() => {
    UserModel.reset();
});

describe('Gestión de Usuarios (Lógica en memoria con Bcrypt)', () => {
    
    test('1. Permite registrar un usuario nuevo', async () => {
        const user = await UserModel.create('test@correo.com', 'clave123', 'usuario', 'pendiente');
        
        expect(user.email).toBe('test@correo.com');
        expect(user.role).toBe('usuario');
        expect(user.password).not.toBe('clave123'); 
    });

    test('2. Comprueba caso de error: falla al registrar un email ya existente', async () => {
        await UserModel.create('test@correo.com', 'clave123', 'usuario', 'pendiente');
        
        await expect(
            UserModel.create('test@correo.com', 'otraClave', 'usuario', 'pendiente')
        ).rejects.toThrow('El email ya está registrado');
    });

    test('3. Permite listar a los usuarios registrados', async () => {
        await UserModel.create('lista@correo.com', 'clave123', 'usuario', 'pendiente');
        
        const users = UserModel.getAll();
        expect(users.length).toBeGreaterThan(0);
    });

    test('4. Comprueba correctamente si un usuario está activo', async () => {
        await UserModel.create('activo@correo.com', 'clave123', 'usuario', 'activo');
        await UserModel.create('pendiente@correo.com', 'clave123', 'usuario', 'pendiente');
        
        const esActivo = UserModel.isActive('activo@correo.com');
        const esPendiente = UserModel.isActive('pendiente@correo.com'); 
        
        expect(esActivo).toBe(true);
        expect(esPendiente).toBe(false);
    });

    test('5. Permite eliminar un usuario y lanza error si no existe', async () => {
        await UserModel.create('activo@correo.com', 'clave123', 'usuario', 'activo');
        
        const resultado = UserModel.delete('activo@correo.com');
        expect(resultado).toBe(true);
        
        expect(() => {
            UserModel.delete('activo@correo.com');
        }).toThrow('Usuario no encontrado');
    });

    test('6. Verifica el login comprobando el hash de Bcrypt', async () => {
        await UserModel.create('login@correo.com', 'secreto123', 'usuario', 'activo');
        
        const validUser = await UserModel.login('login@correo.com', 'secreto123');
        expect(validUser.email).toBe('login@correo.com');

        await expect(
            UserModel.login('login@correo.com', 'claveFalsa')
        ).rejects.toThrow('Credenciales incorrectas');
    });
});