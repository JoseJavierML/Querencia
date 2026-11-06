const {
    createArchivoService,
    ArchivoValidationError,
    ArchivoNotFoundError,
    ArchivoConfigurationError
} = require('./archivoService');
const { buildCatalogKey } = require('./archivoUtils');
const { MAX_QUERY_LENGTH } = require('./archivoConstants');

const VIDEO_ID = 'abc123DEF45';
const NOW = new Date('2026-11-06T12:00:00.000Z');

const lastFmSearch = {
    results: {
        trackmatches: {
            track: [
                {
                    name: 'La leyenda del tiempo',
                    artist: 'Camarón de la Isla',
                    url: 'https://www.last.fm/music/Camar%C3%B3n/La+leyenda+del+tiempo',
                    listeners: '1000',
                    mbid: 'mbid-1',
                    image: [
                        { '#text': 'https://example.com/search.jpg', size: 'extralarge' }
                    ]
                }
            ]
        }
    }
};

const lastFmInfo = {
    track: {
        name: 'La leyenda del tiempo',
        artist: { name: 'Camarón de la Isla' },
        album: {
            title: 'La leyenda del tiempo',
            image: [
                { '#text': 'https://example.com/cover.jpg', size: 'extralarge' }
            ]
        },
        duration: '240',
        listeners: '1000',
        playcount: '2000',
        url: 'https://www.last.fm/music/Camar%C3%B3n/La+leyenda+del+tiempo',
        mbid: 'mbid-1',
        toptags: {
            tag: [
                { name: 'flamenco' },
                { name: 'copla' }
            ]
        },
        wiki: {
            summary: '<a href="https://www.last.fm">Una escucha fundamental</a>',
            published: '01 Jan 1979'
        }
    }
};

const createJsonResponse = (data, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data))
});

const createFetchImpl = ({
    search = lastFmSearch,
    info = lastFmInfo,
    youtube = { items: [{ id: { videoId: VIDEO_ID } }] },
    youtubeHtml = '<html>"videoId":"abc123DEF45"</html>'
} = {}) => jest.fn((url) => {
    const parsed = new URL(url);

    if (parsed.hostname === 'ws.audioscrobbler.com') {
        const method = parsed.searchParams.get('method');
        if (method === 'track.search') {
            return Promise.resolve(createJsonResponse(search));
        }
        if (method === 'track.getInfo') {
            return Promise.resolve(createJsonResponse(info));
        }
    }

    if (parsed.hostname === 'www.googleapis.com') {
        return Promise.resolve(createJsonResponse(youtube));
    }

    if (parsed.hostname === 'www.youtube.com') {
        return Promise.resolve(createJsonResponse(youtubeHtml));
    }

    return Promise.reject(new Error(`URL no esperada: ${url}`));
});

const createRepo = (overrides = {}) => ({
    findByCatalogKey: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    upsertByCatalogKey: jest.fn(),
    updateById: jest.fn(),
    touchById: jest.fn().mockResolvedValue(null),
    ...overrides
});

const createCachedVinyl = (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    catalogKey: buildCatalogKey('Camarón de la Isla', 'La leyenda del tiempo'),
    title: 'La leyenda del tiempo',
    artist: 'Camarón de la Isla',
    album: 'La leyenda del tiempo',
    coverUrl: 'https://example.com/cover.jpg',
    genre: 'Flamenco',
    youtubeVideoId: VIDEO_ID,
    lastFmInfo: {
        mbid: 'mbid-1',
        url: 'https://www.last.fm/music/Camar%C3%B3n/La+leyenda+del+tiempo',
        listeners: 1000,
        playcount: 2000,
        duration: 240,
        published: '01 Jan 1979',
        summary: 'Una escucha fundamental',
        tags: ['flamenco', 'copla'],
        album: 'La leyenda del tiempo',
        fetchedAt: new Date('2026-11-05T00:00:00.000Z')
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-05T00:00:00.000Z'),
    lastAccessedAt: null,
    ...overrides
});

const buildService = (overrides = {}) => {
    const repo = overrides.repo || createRepo();
    const fetchImpl = overrides.fetchImpl || createFetchImpl();
    const service = createArchivoService({
        vinylRepository: repo,
        fetchImpl,
        lastFmApiKey: 'clave-lastfm',
        youtubeApiKey: 'clave-youtube',
        youtubeScrapingEnabled: false,
        cacheTtlDays: 30,
        httpTimeoutMs: 1000,
        now: () => new Date(NOW),
        logger: {
            warn: jest.fn(),
            debug: jest.fn()
        },
        ...overrides.options
    });

    return { service, repo, fetchImpl };
};

describe('Servicio de El Archivo', () => {
    test('devuelve un disco cacheado sin consumir APIs externas', async () => {
        const cached = createCachedVinyl();
        const repo = createRepo({
            findByCatalogKey: jest.fn().mockResolvedValue(cached)
        });
        const { service, fetchImpl } = buildService({ repo });

        const result = await service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });

        expect(result).toMatchObject({
            cached: true,
            created: false,
            stale: false
        });
        expect(result.vinyl.title).toBe('La leyenda del tiempo');
        expect(result.vinyl.playable).toBe(true);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(repo.touchById).toHaveBeenCalledWith(cached._id);
        expect(repo.upsertByCatalogKey).not.toHaveBeenCalled();
    });

    test('no reintenta YouTube en cada búsqueda de una ficha reciente sin audio', async () => {
        const cached = createCachedVinyl({
            youtubeVideoId: null,
            updatedAt: new Date('2026-11-06T00:00:00.000Z')
        });
        const repo = createRepo({
            findByCatalogKey: jest.fn().mockResolvedValue(cached)
        });
        const { service, fetchImpl } = buildService({ repo });

        const result = await service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });

        expect(result.cached).toBe(true);
        expect(result.vinyl.playable).toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(repo.updateById).not.toHaveBeenCalled();
        expect(repo.touchById).toHaveBeenCalledWith(cached._id);
    });

    test('busca en Last.fm y YouTube y guarda un disco nuevo con metadatos normalizados', async () => {
        const repo = createRepo({
            upsertByCatalogKey: jest.fn().mockImplementation(async (data) => ({
                _id: '507f1f77bcf86cd799439012',
                ...data,
                createdAt: NOW,
                updatedAt: NOW
            }))
        });
        const { service, fetchImpl } = buildService({ repo });

        const result = await service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });

        expect(result).toMatchObject({
            cached: false,
            created: true,
            stale: false
        });
        expect(result.vinyl).toMatchObject({
            title: 'La leyenda del tiempo',
            artist: 'Camarón de la Isla',
            album: 'La leyenda del tiempo',
            coverUrl: 'https://example.com/cover.jpg',
            genre: 'Flamenco',
            youtubeVideoId: VIDEO_ID,
            playable: true
        });
        expect(repo.upsertByCatalogKey).toHaveBeenCalledWith(expect.objectContaining({
            catalogKey: buildCatalogKey('Camarón de la Isla', 'La leyenda del tiempo'),
            youtubeVideoId: VIDEO_ID,
            genre: 'Flamenco',
            lastFmInfo: expect.objectContaining({
                tags: ['flamenco', 'copla'],
                summary: 'Una escucha fundamental'
            })
        }));
        expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

    test('resuelve una búsqueda libre y reutiliza la caché por artista y título', async () => {
        const cached = createCachedVinyl();
        const repo = createRepo({
            findByCatalogKey: jest.fn().mockResolvedValue(cached)
        });
        const { service, fetchImpl } = buildService({ repo });

        const result = await service.searchVinyl({
            query: 'La leyenda del tiempo'
        });

        expect(result.cached).toBe(true);
        expect(result.created).toBe(false);
        expect(repo.findByCatalogKey).toHaveBeenCalledWith(cached.catalogKey);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(repo.upsertByCatalogKey).not.toHaveBeenCalled();
    });

    test('refresca la caché caducada con Last.fm', async () => {
        const cached = createCachedVinyl({
            youtubeVideoId: null,
            lastFmInfo: {
                ...createCachedVinyl().lastFmInfo,
                fetchedAt: new Date('2020-01-01T00:00:00.000Z')
            }
        });
        const repo = createRepo({
            findByCatalogKey: jest.fn().mockResolvedValue(cached),
            updateById: jest.fn().mockImplementation(async (id, updates) => ({
                ...cached,
                ...updates,
                _id: id
            }))
        });
        const { service, fetchImpl } = buildService({ repo });

        const result = await service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });

        expect(result).toMatchObject({
            cached: true,
            created: false,
            stale: false
        });
        expect(result.vinyl.youtubeVideoId).toBe(VIDEO_ID);
        expect(repo.updateById).toHaveBeenCalledWith(
            cached._id,
            expect.objectContaining({
                catalogKey: cached.catalogKey,
                youtubeVideoId: VIDEO_ID
            })
        );
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    test('conserva la copia caducada si Last.fm no responde', async () => {
        const cached = createCachedVinyl({
            lastFmInfo: {
                ...createCachedVinyl().lastFmInfo,
                fetchedAt: new Date('2020-01-01T00:00:00.000Z')
            }
        });
        const repo = createRepo({
            findByCatalogKey: jest.fn().mockResolvedValue(cached)
        });
        const fetchImpl = jest.fn().mockRejectedValue(new Error('red no disponible'));
        const { service } = buildService({ repo, fetchImpl });

        const result = await service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });

        expect(result).toMatchObject({
            cached: true,
            created: false,
            stale: true
        });
        expect(result.vinyl.title).toBe('La leyenda del tiempo');
        expect(repo.upsertByCatalogKey).not.toHaveBeenCalled();
    });

    test('guarda metadatos aunque YouTube no devuelva un vídeo', async () => {
        const repo = createRepo({
            upsertByCatalogKey: jest.fn().mockImplementation(async (data) => ({
                _id: '507f1f77bcf86cd799439013',
                ...data,
                createdAt: NOW,
                updatedAt: NOW
            }))
        });
        const baseFetch = createFetchImpl();
        const fetchImpl = jest.fn((url) => {
            const parsed = new URL(url);
            if (parsed.hostname === 'www.googleapis.com') {
                return Promise.reject(new Error('cuota agotada'));
            }
            return baseFetch(url);
        });
        const { service } = buildService({ repo, fetchImpl });

        const result = await service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        });

        expect(result.created).toBe(true);
        expect(result.vinyl.youtubeVideoId).toBeNull();
        expect(result.vinyl.playable).toBe(false);
        expect(repo.upsertByCatalogKey).toHaveBeenCalledWith(expect.objectContaining({
            youtubeVideoId: null
        }));
    });

    test('rechaza la búsqueda externa si falta LASTFM_API_KEY y no hay caché', async () => {
        const { service } = buildService({
            options: {
                lastFmApiKey: ''
            }
        });

        await expect(service.searchVinyl({
            artist: 'Camarón de la Isla',
            title: 'La leyenda del tiempo'
        })).rejects.toBeInstanceOf(ArchivoConfigurationError);
    });

    test('valida que la búsqueda o el par artista-título estén presentes', async () => {
        const { service } = buildService();

        await expect(service.searchVinyl({})).rejects.toBeInstanceOf(ArchivoValidationError);
        await expect(service.searchVinyl({ artist: 'Camarón de la Isla' }))
            .rejects.toBeInstanceOf(ArchivoValidationError);
        await expect(service.searchVinyl({ query: 'a'.repeat(MAX_QUERY_LENGTH + 1) }))
            .rejects.toBeInstanceOf(ArchivoValidationError);
    });

    test('agrupa los vinilos por género con su recuento y orden estable', async () => {
        const repo = createRepo({
            findAll: jest.fn().mockResolvedValue([
                {
                    _id: '1',
                    title: 'La leyenda del tiempo',
                    artist: 'Camarón de la Isla',
                    genre: 'Flamenco',
                    youtubeVideoId: VIDEO_ID
                },
                {
                    _id: '2',
                    title: 'Soleá',
                    artist: 'Paco de Lucía',
                    genre: 'Flamenco',
                    youtubeVideoId: null
                },
                {
                    _id: '3',
                    title: 'Kind of Blue',
                    artist: 'Miles Davis',
                    genre: 'Jazz',
                    youtubeVideoId: VIDEO_ID
                }
            ])
        });
        const { service } = buildService({ repo });

        const result = await service.getDrawers({ groupBy: 'genero' });

        expect(result.agrupacion).toBe('genero');
        expect(result.total).toBe(3);
        expect(result.cajones).toHaveLength(2);
        expect(result.cajones[0]).toMatchObject({
            clave: 'flamenco',
            etiqueta: 'Flamenco',
            total: 2
        });
        expect(result.cajones[1]).toMatchObject({
            clave: 'jazz',
            etiqueta: 'Jazz',
            total: 1
        });
        expect(repo.findAll).toHaveBeenCalledWith({ genre: '', artist: '' });
    });

    test('agrupa por artista y rechaza agrupaciones desconocidas', async () => {
        const repo = createRepo({
            findAll: jest.fn().mockResolvedValue([
                { _id: '1', title: 'A', artist: 'Camarón de la Isla', genre: 'Flamenco' },
                { _id: '2', title: 'B', artist: 'Paco de Lucía', genre: 'Flamenco' }
            ])
        });
        const { service } = buildService({ repo });

        const result = await service.getDrawers({ groupBy: 'artista' });
        expect(result.agrupacion).toBe('artista');
        expect(result.cajones).toHaveLength(2);

        await expect(service.getDrawers({ groupBy: 'album' }))
            .rejects.toBeInstanceOf(ArchivoValidationError);
    });

    test('valida el identificador y devuelve el detalle del disco', async () => {
        const id = '507f1f77bcf86cd799439011';
        const repo = createRepo({
            findById: jest.fn().mockImplementation(async (requestedId) => (
                requestedId === id ? createCachedVinyl({ _id: id }) : null
            ))
        });
        const { service } = buildService({ repo });

        await expect(service.getVinylById('no-valido'))
            .rejects.toBeInstanceOf(ArchivoValidationError);
        await expect(service.getVinylById('507f1f77bcf86cd799439099'))
            .rejects.toBeInstanceOf(ArchivoNotFoundError);

        const vinyl = await service.getVinylById(id);
        expect(vinyl._id).toBe(id);
        expect(repo.touchById).toHaveBeenCalledWith(id);
    });
});
