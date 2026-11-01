const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

require('./userModel');
const { Debate } = require('./debateModel');

const User = mongoose.model('User');

const SEED_TITLE = 'El duende no cabe en un algoritmo';
const SEED_AUTHOR_EMAIL = 'seed@querencia.local';
const SEED_COVER_IMAGE_URL = 'https://commons.wikimedia.org/wiki/Special:FilePath/Camar%C3%B3n_De_La_Isla_and_Paco_De_Luc%C3%ADa_%281969%29.jpg?width=960';

const SEED_CONTENT = [
    'Hay una diferencia entre escuchar música y dejar que la música nos atraviese. Camarón de la Isla no cantaba para llenar un silencio: lo abría. Su voz llegaba desde un lugar que no se puede editar, ese duende que aparece cuando el artista deja de protegerse y se convierte en herida.',
    'Hoy consumimos canciones como consumimos titulares: quince segundos, siguiente, siguiente. La inmediatez nos promete que nada nos dolerá demasiado. Pero el arte atemporal hace lo contrario: nos pide tiempo, nos obliga a quedarnos con lo que incomoda y nos devuelve una parte de nosotros que creíamos perdida.',
    'En un mundo que nos exige ser de piedra, permitirnos sentir es el mayor acto de rebeldía. ¿Qué escuchamos cuando dejamos de huir de la canción?'
].join('\n\n');

const resolverAutor = async () => {
    const emailConfigurado = (process.env.SEED_AUTHOR_EMAIL || '').trim();

    if (emailConfigurado) {
        const autorConfigurado = await User.findOne({ email: emailConfigurado });
        if (!autorConfigurado) {
            throw new Error(`SEED_AUTHOR_EMAIL apunta a un usuario que no existe: ${emailConfigurado}`);
        }
        return autorConfigurado;
    }

    const administrador = await User.findOne({ role: 'admin' });
    if (administrador) {
        return administrador;
    }

    const autorTecnicoExistente = await User.findOne({ email: SEED_AUTHOR_EMAIL });
    if (autorTecnicoExistente) {
        return autorTecnicoExistente;
    }

    const passwordAleatoria = crypto.randomBytes(32).toString('hex');
    const passwordHasheada = await bcrypt.hash(passwordAleatoria, 10);

    const autorTecnico = await User.create({
        email: SEED_AUTHOR_EMAIL,
        password: passwordHasheada,
        role: 'admin',
        status: 'activo'
    });

    console.log(`[seed] Creado el autor técnico ${SEED_AUTHOR_EMAIL} con rol admin.`);
    console.log('[seed] La contraseña es aleatoria y no se imprime; la cuenta no está pensada para iniciar sesión.');

    return autorTecnico;
};

const ejecutarSeed = async () => {
    const mongoUri = (process.env.MONGO_URI || '').trim();
    if (!mongoUri) {
        throw new Error('MONGO_URI no está definido. Añádelo a backend/.env antes de ejecutar el seed.');
    }

    await mongoose.connect(mongoUri);
    console.log('[seed] Conexión a MongoDB establecida.');

    const debateExistente = await Debate.findOne({ title: SEED_TITLE }).lean();
    if (debateExistente) {
        if (!debateExistente.coverImageUrl) {
            await Debate.updateOne(
                { _id: debateExistente._id },
                { $set: { coverImageUrl: SEED_COVER_IMAGE_URL } }
            );
            console.log('[seed] Portada añadida al debate existente.');
        }

        console.log(`[seed] El debate "${SEED_TITLE}" ya existe. No se crea un duplicado.`);
        return;
    }

    const autor = await resolverAutor();
    const debate = await Debate.create({
        title: SEED_TITLE,
        content: SEED_CONTENT,
        coverImageUrl: SEED_COVER_IMAGE_URL,
        authorId: autor._id
    });

    console.log(`[seed] Autor: ${autor.email}`);
    console.log(`[seed] Debate creado: ${debate._id}`);
    console.log(`[seed] Título: ${debate.title}`);
    console.log(`[seed] Portada: ${debate.coverImageUrl}`);
};

ejecutarSeed()
    .catch((error) => {
        console.error(`[seed] Error: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await mongoose.connection.close();
        } catch (error) {
            console.error(`[seed] No se pudo cerrar la conexión: ${error.message}`);
        }
    });
