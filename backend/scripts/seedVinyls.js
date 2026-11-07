/**
 * Poblado inicial de El Archivo.
 *
 * Inserta una selección de discos clave del flamenco y la fusión usando el
 * servicio real de El Archivo: Last.fm para metadatos, carátula y géneros, y
 * YouTube Data API v3 (con fallback de scraping) para resolver el audio.
 *
 * Ejecuta desde la raíz del repositorio:
 *   node backend/scripts/seedVinyls.js
 *
 * O desde la carpeta backend:
 *   npm run seed:vinilos
 *
 * Requiere MONGO_URI y LASTFM_API_KEY en backend/.env. YOUTUBE_API_KEY es
 * recomendable; si falta, el servicio intentará resolver el audio mediante
 * el fallback de búsqueda en YouTube.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { createArchivoService } = require('../archivoService');
const { VinylRepository } = require('../vinylModel');

const SEED_VINYLS = [
    {
        artist: 'Camarón de la Isla',
        title: 'La leyenda del tiempo',
        query: 'La leyenda del tiempo Camarón de la Isla'
    },
    {
        artist: 'Enrique Morente',
        title: 'Omega',
        query: 'Omega Enrique Morente Lagartija Nick'
    },
    {
        artist: 'Rocío Márquez',
        title: 'Tercer cielo',
        query: 'Tercer cielo Rocío Márquez'
    },
    {
        artist: 'Paco de Lucía',
        title: 'Entre dos aguas',
        query: 'Entre dos aguas Paco de Lucía'
    },
    {
        artist: 'Bebo Valdés',
        title: 'Lágrimas negras',
        query: 'Lágrimas negras Bebo Valdés Diego El Cigala'
    },
    {
        artist: 'Estrella Morente',
        title: 'Volver',
        query: 'Volver Estrella Morente'
    }
];

const hasValue = (value) => typeof value === 'string' && value.trim().length > 0;

const validateEnvironment = () => {
    const mongoUri = hasValue(process.env.MONGO_URI)
        ? process.env.MONGO_URI.trim()
        : '';

    if (!mongoUri) {
        throw new Error('MONGO_URI no está definido. Añádelo a backend/.env antes de ejecutar el seed.');
    }
    if (typeof globalThis.fetch !== 'function') {
        throw new Error('Este script necesita fetch nativo. Usa Node.js 18 o superior.');
    }
    if (!hasValue(process.env.LASTFM_API_KEY)) {
        throw new Error(
            'LASTFM_API_KEY no está definida. Crea una clave gratuita en https://www.last.fm/api/account/create y añádela a backend/.env.'
        );
    }
    if (!hasValue(process.env.YOUTUBE_API_KEY)) {
        console.warn(
            '[seed] Aviso: YOUTUBE_API_KEY no está definida. Se intentará resolver el audio con el fallback de búsqueda en YouTube.'
        );
    }

    return mongoUri;
};

const searchOne = async (service, seed) => {
    try {
        const result = await service.searchVinyl({
            artist: seed.artist,
            title: seed.title
        });
        return { result, source: 'artista y título' };
    } catch (error) {
        if (!seed.query) {
            throw error;
        }

        console.warn(
            `[seed] No se pudo resolver "${seed.artist} — ${seed.title}" por artista y título (${error.message}). Reintentando con búsqueda libre...`
        );
        const result = await service.searchVinyl({ query: seed.query });
        return { result, source: 'búsqueda libre' };
    }
};

const ejecutarSeed = async () => {
    const mongoUri = validateEnvironment();

    await mongoose.connect(mongoUri);
    console.log('[seed] Conexión a MongoDB establecida.');

    const service = createArchivoService({
        vinylRepository: VinylRepository
    });

    let created = 0;
    let reused = 0;
    const failures = [];

    for (const seed of SEED_VINYLS) {
        console.log(`\n[seed] Procesando ${seed.artist} — ${seed.title}...`);

        try {
            const { result, source } = await searchOne(service, seed);
            const vinyl = result.vinyl;

            if (result.created) {
                created += 1;
            } else {
                reused += 1;
            }

            console.log(
                `[seed] ${result.created ? 'Creado' : 'Reutilizado'} (${source}): ${vinyl.artist} — ${vinyl.title}`
            );
            console.log(
                `[seed]   género: ${vinyl.genre || 'Sin clasificar'} | audio: ${vinyl.youtubeVideoId || 'sin YouTube'} | id: ${vinyl._id}`
            );
        } catch (error) {
            failures.push({ seed, error });
            console.error(`[seed] Error con ${seed.artist} — ${seed.title}: ${error.message}`);
        }
    }

    const drawers = await service.getDrawers({ groupBy: 'genero' });
    const resumenCajones = drawers.cajones
        .map((cajon) => `${cajon.etiqueta} (${cajon.total})`)
        .join(', ');

    console.log('\n[seed] Resumen del poblado:');
    console.log(`[seed]   creados: ${created} | reutilizados: ${reused} | fallidos: ${failures.length}`);
    console.log(`[seed]   vinilos en El Archivo: ${drawers.total}`);
    console.log(`[seed]   cajones: ${resumenCajones || 'sin vinilos'}`);

    if (failures.length > 0) {
        console.warn('[seed] Algunos discos no se pudieron insertar. Revisa los avisos anteriores.');
        process.exitCode = 1;
    }
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
