const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

require('./userModel');
const { Debate } = require('./debateModel');
const { VinylRepository } = require('./vinylModel');
const { buildCatalogKey } = require('./archivoUtils');

const User = mongoose.model('User');

const SEED_AUTHOR_EMAIL = 'seed@querencia.local';

/**
 * Reflexiones iniciales del Muro. El seed es idempotente por título: si una
 * reflexión ya existe no se duplica. `vinyl` es opcional y enlaza la reflexión
 * con un disco de El Archivo (debe haberse poblado antes con
 * `npm run seed:vinilos`); si el disco no está en la caché, la reflexión se
 * crea sin vínculo. Si no se indica portada, se reutiliza la del vinilo.
 */
const SEED_DEBATES = [
    {
        title: 'El duende no cabe en un algoritmo',
        coverImageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Camar%C3%B3n_De_La_Isla_and_Paco_De_Luc%C3%ADa_%281969%29.jpg?width=960',
        content: [
            'Hay una diferencia entre escuchar música y dejar que la música nos atraviese. Camarón de la Isla no cantaba para llenar un silencio: lo abría. Su voz llegaba desde un lugar que no se puede editar, ese duende que aparece cuando el artista deja de protegerse y se convierte en herida.',
            'Hoy consumimos canciones como consumimos titulares: quince segundos, siguiente, siguiente. La inmediatez nos promete que nada nos dolerá demasiado. Pero el arte atemporal hace lo contrario: nos pide tiempo, nos obliga a quedarnos con lo que incomoda y nos devuelve una parte de nosotros que creíamos perdida.',
            'En un mundo que nos exige ser de piedra, permitirnos sentir es el mayor acto de rebeldía. ¿Qué escuchamos cuando dejamos de huir de la canción?'
        ].join('\n\n')
    },
    {
        title: 'Realejo Beach: cuando el compás se baila con zapatillas',
        createdAt: '2026-11-20T19:30:00.000Z',
        vinyl: { artist: 'La Plazuela', title: 'Realejo Beach' },
        content: [
            'Hay discos que suenan a un lugar concreto. Roneo Funk Club, el debut de La Plazuela, huele a Granada: a cuesta empedrada, a peña de barrio y a sábado que empieza en el Realejo y termina sin hora. En Realejo Beach el dúo hace algo que parece sencillo y no lo es: sostiene el compás por bulerías mientras un bajo de funk le discute cada tiempo.',
            'Lo interesante es que no hay disfraz. Las palmas, los jaleos y los giros del cante viejo siguen ahí, reconocibles; lo que cambia es el suelo sobre el que pisan. Los sintetizadores y la caja de ritmos no tapan la raíz, la iluminan desde otro ángulo, como esas fotos antiguas que alguien vuelve a revelar con colores nuevos.',
            'Hay quien dirá que esto ya no es flamenco. Yo creo que el flamenco siempre ha sido eso: lo que la gente de cada época hacía con lo que había heredado. Escuchadla con calma, a ser posible dos veces seguidas, y fijaos en cómo cambia el cuerpo entre la primera y la segunda.',
            '¿Dónde está para vosotros la frontera entre renovar una tradición y vaciarla?'
        ].join('\n\n')
    },
    {
        title: 'Al tercer mundo: la bulería que no pide permiso',
        createdAt: '2026-11-22T21:15:00.000Z',
        vinyl: { artist: 'Israel Fernández', title: 'Al Tercer Mundo' },
        content: [
            'Israel Fernández es de esos cantaores que suenan a otra época sin sonar antiguos. En Pura Sangre, con Diego del Morao y Pional a los mandos de la producción, el cantaor toledano se atreve con texturas electrónicas sin soltar ni un momento la mano del cante.',
            'Al tercer mundo es la prueba. La bulería llega envuelta en una atmósfera casi de madrugada, con capas que respiran por debajo de la voz, pero el pellizco no se diluye: cada tercio está dicho con la seriedad de quien ha mamado el cante en casa. La modernidad aquí no es un adorno, es un espacio nuevo para que el quejío resuene.',
            'Merece la pena escucharla junto a la Soleá de mi casa del mismo disco: una mira hacia dentro y la otra hacia fuera, y entre las dos dibujan a un artista que no necesita elegir entre la raíz y el presente.',
            '¿Qué os provoca más: el cante desnudo con una guitarra o el cante que se deja acompañar por máquinas?'
        ].join('\n\n')
    }
];

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

const esUrlHttp = (valor) => typeof valor === 'string' && /^https?:\/\//i.test(valor.trim());

const resolverVinilo = async (referencia) => {
    if (!referencia) {
        return null;
    }

    const catalogKey = buildCatalogKey(referencia.artist, referencia.title);
    const vinilo = catalogKey ? await VinylRepository.findByCatalogKey(catalogKey) : null;

    if (!vinilo) {
        console.warn(
            `[seed] El vinilo "${referencia.artist} — ${referencia.title}" no está en El Archivo. ` +
            'Ejecuta antes npm run seed:vinilos para enlazarlo; la reflexión se crea sin vínculo.'
        );
    }

    return vinilo;
};

const sembrarDebate = async (seed, obtenerAutor) => {
    const vinilo = await resolverVinilo(seed.vinyl);
    const portada = seed.coverImageUrl || (vinilo && esUrlHttp(vinilo.coverUrl) ? vinilo.coverUrl : null);

    const debateExistente = await Debate.findOne({ title: seed.title }).lean();
    if (debateExistente) {
        const cambios = {};
        if (!debateExistente.coverImageUrl && portada) {
            cambios.coverImageUrl = portada;
        }
        if (!debateExistente.vinylId && vinilo) {
            cambios.vinylId = vinilo._id;
        }

        if (Object.keys(cambios).length > 0) {
            await Debate.updateOne({ _id: debateExistente._id }, { $set: cambios });
            console.log(`[seed] Completado el debate existente "${seed.title}": ${Object.keys(cambios).join(', ')}.`);
        }

        console.log(`[seed] El debate "${seed.title}" ya existe. No se crea un duplicado.`);
        return false;
    }

    const autor = await obtenerAutor();
    const datos = {
        title: seed.title,
        content: seed.content,
        coverImageUrl: portada,
        authorId: autor._id,
        vinylId: vinilo ? vinilo._id : null
    };
    if (seed.createdAt) {
        datos.createdAt = new Date(seed.createdAt);
    }

    const debate = await Debate.create(datos);

    console.log(`[seed] Debate creado: ${debate._id}`);
    console.log(`[seed]   título: ${debate.title}`);
    console.log(`[seed]   autor: ${autor.email} | vinilo: ${vinilo ? `${vinilo.artist} — ${vinilo.title}` : 'sin vínculo'}`);
    console.log(`[seed]   portada: ${debate.coverImageUrl || 'placeholder'}`);
    return true;
};

const ejecutarSeed = async () => {
    const mongoUri = (process.env.MONGO_URI || '').trim();
    if (!mongoUri) {
        throw new Error('MONGO_URI no está definido. Añádelo a backend/.env antes de ejecutar el seed.');
    }

    await mongoose.connect(mongoUri);
    console.log('[seed] Conexión a MongoDB establecida.');

    let autor = null;
    const obtenerAutor = async () => {
        if (!autor) {
            autor = await resolverAutor();
        }
        return autor;
    };

    let creados = 0;
    for (const seed of SEED_DEBATES) {
        if (await sembrarDebate(seed, obtenerAutor)) {
            creados += 1;
        }
    }

    console.log(`[seed] Resumen: ${creados} creados, ${SEED_DEBATES.length - creados} ya existentes.`);
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
