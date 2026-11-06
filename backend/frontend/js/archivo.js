import { api } from './api.js';

const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
const VINYL_MIME = 'application/x-querencia-vinilo';
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const cajonesGrid = document.getElementById('cajonesGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const loadError = document.getElementById('loadError');
const retryBtn = document.getElementById('retryBtn');
const archiveSummary = document.getElementById('archiveSummary');
const groupingButtons = Array.from(document.querySelectorAll('[data-grouping]'));

const turntableDock = document.getElementById('turntableDock');
const turntable = document.getElementById('turntable');
const record = document.getElementById('record');
const recordCover = document.getElementById('recordCover');
const turntableTrack = document.getElementById('turntableTrack');
const turntableTitle = document.getElementById('turntableTitle');
const turntableArtist = document.getElementById('turntableArtist');
const turntableStatus = document.getElementById('turntableStatus');
const playToggle = document.getElementById('playToggle');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');

const discoModal = document.getElementById('discoModal');
const discoDialog = document.getElementById('discoDialog');
const discoClose = document.getElementById('discoClose');
const discoModalTitle = document.getElementById('discoModalTitle');
const discoGenre = document.getElementById('discoGenre');
const discoArtist = document.getElementById('discoArtist');
const discoAlbum = document.getElementById('discoAlbum');
const discoCover = document.getElementById('discoCover');
const discoCoverFallback = document.getElementById('discoCoverFallback');
const discoLoading = document.getElementById('discoLoading');
const discoError = document.getElementById('discoError');
const discoRetry = document.getElementById('discoRetry');
const discoSummary = document.getElementById('discoSummary');
const discoStats = document.getElementById('discoStats');
const discoTags = document.getElementById('discoTags');
const discoPlay = document.getElementById('discoPlay');
const discoLastFm = document.getElementById('discoLastFm');

const state = {
    grouping: 'genero',
    cajones: [],
    vinyls: new Map(),
    dragging: false,
    suppressClickUntil: 0,
    modalOpener: null,
    modalVinylId: null,
    modalVinyl: null,
    detailRequestId: 0,
    previousScrollY: 0
};

let loadRequestId = 0;
let youtubeApiPromise = null;
let youtubePlayer = null;
let youtubePlayerPromise = null;
let youtubeReady = false;
let youtubeNamespace = null;
let currentVinyl = null;
let currentVideoId = '';
let playbackRequestId = 0;
let autoplayHintTimer = null;

const formatNumber = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return new Intl.NumberFormat('es-ES').format(number);
};

const pluralize = (count, singular, plural) => {
    const number = Number(count) || 0;
    return `${formatNumber(number)} ${number === 1 ? singular : plural}`;
};

const getVideoId = (vinyl) => {
    if (!vinyl || typeof vinyl.youtubeVideoId !== 'string') return '';
    const videoId = vinyl.youtubeVideoId.trim();
    return YOUTUBE_ID_PATTERN.test(videoId) ? videoId : '';
};

const setGroupButtonsDisabled = (disabled) => {
    groupingButtons.forEach((button) => {
        button.disabled = disabled;
    });
};

const showLoadingView = () => {
    loadingState.hidden = false;
    emptyState.hidden = true;
    errorState.hidden = true;
    cajonesGrid.hidden = true;
};

const showEmptyView = () => {
    loadingState.hidden = true;
    emptyState.hidden = false;
    errorState.hidden = true;
    cajonesGrid.hidden = true;
};

const showErrorView = (message) => {
    loadingState.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = false;
    cajonesGrid.hidden = true;
    loadError.textContent = message;
};

const showContentView = () => {
    loadingState.hidden = true;
    emptyState.hidden = true;
    errorState.hidden = true;
    cajonesGrid.hidden = false;
};

const createVinylCard = (vinyl, index) => {
    const title = vinyl.title || 'Disco sin título';
    const artist = vinyl.artist || 'Artista desconocido';
    const playable = Boolean(vinyl.playable && getVideoId(vinyl));

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'vinyl-card';
    card.draggable = true;
    card.dataset.vinylId = vinyl._id || '';
    card.dataset.playable = playable ? 'true' : 'false';
    card.style.setProperty('--stack', String(Math.min(index, 50)));
    card.style.setProperty('--tilt', `${(((index * 13) % 5) - 2) * 0.65}deg`);
    card.setAttribute('aria-label', `Abrir la ficha de ${title} de ${artist}${playable ? '' : '. Sin audio disponible'}`);
    card.setAttribute('aria-haspopup', 'dialog');
    card.title = `${title} · ${artist}`;

    const sleeve = document.createElement('span');
    sleeve.className = 'vinyl-sleeve';

    const fallback = document.createElement('span');
    fallback.className = 'vinyl-fallback';
    fallback.textContent = (title.charAt(0) || 'Q').toUpperCase();
    fallback.setAttribute('aria-hidden', 'true');
    sleeve.appendChild(fallback);

    if (vinyl.coverUrl) {
        const image = document.createElement('img');
        image.src = vinyl.coverUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.draggable = false;
        image.addEventListener('load', () => {
            fallback.hidden = true;
        });
        image.addEventListener('error', () => {
            image.hidden = true;
            image.removeAttribute('src');
            fallback.hidden = false;
        });
        sleeve.appendChild(image);
    }

    const caption = document.createElement('span');
    caption.className = 'vinyl-caption';
    caption.setAttribute('aria-hidden', 'true');

    const captionTitle = document.createElement('strong');
    captionTitle.textContent = title;

    const captionArtist = document.createElement('span');
    captionArtist.textContent = artist;

    caption.appendChild(captionTitle);
    caption.appendChild(captionArtist);

    if (!playable) {
        const noAudio = document.createElement('span');
        noAudio.className = 'vinyl-no-audio';
        noAudio.textContent = 'Sin audio';
        caption.appendChild(noAudio);
    }

    card.appendChild(sleeve);
    card.appendChild(caption);

    return card;
};

const renderDrawers = () => {
    const fragment = document.createDocumentFragment();

    state.cajones.forEach((cajon, drawerIndex) => {
        const vinyls = Array.isArray(cajon.vinilos) ? cajon.vinilos : [];
        const label = cajon.etiqueta || 'Sin clasificar';

        const drawer = document.createElement('article');
        drawer.className = 'drawer';
        drawer.style.setProperty('--drawer-delay', `${Math.min(drawerIndex * 70, 420)}ms`);

        const head = document.createElement('header');
        head.className = 'drawer-head';

        const heading = document.createElement('div');
        const kicker = document.createElement('p');
        kicker.className = 'drawer-kicker';
        kicker.textContent = `Cajón ${String(drawerIndex + 1).padStart(2, '0')}`;
        const title = document.createElement('h2');
        title.className = 'drawer-title';
        title.textContent = label;
        heading.appendChild(kicker);
        heading.appendChild(title);

        const count = document.createElement('span');
        count.className = 'drawer-count';
        count.textContent = pluralize(vinyls.length, 'disco', 'discos');

        head.appendChild(heading);
        head.appendChild(count);

        const stage = document.createElement('div');
        stage.className = 'drawer-stage';

        const sleeves = document.createElement('div');
        sleeves.className = 'drawer-sleeves';
        sleeves.setAttribute('role', 'group');
        sleeves.setAttribute('aria-label', `Vinilos del cajón ${label}`);

        vinyls.forEach((vinyl, vinylIndex) => {
            sleeves.appendChild(createVinylCard(vinyl, vinylIndex));
        });

        const front = document.createElement('div');
        front.className = 'drawer-front';
        front.setAttribute('aria-hidden', 'true');

        stage.appendChild(sleeves);
        stage.appendChild(front);

        drawer.appendChild(head);
        drawer.appendChild(stage);
        fragment.appendChild(drawer);
    });

    cajonesGrid.replaceChildren(fragment);
};

const loadDrawers = async () => {
    const requestId = ++loadRequestId;

    setGroupButtonsDisabled(true);
    cajonesGrid.setAttribute('aria-busy', 'true');
    showLoadingView();
    archiveSummary.textContent = 'Abriendo los cajones del archivo...';

    try {
        const data = await api.listarCajonesArchivo(state.grouping);
        if (requestId !== loadRequestId) return;

        const cajones = Array.isArray(data && data.cajones) ? data.cajones : [];
        state.cajones = cajones;
        state.vinyls.clear();

        cajones.forEach((cajon) => {
            const vinyls = Array.isArray(cajon.vinilos) ? cajon.vinilos : [];
            vinyls.forEach((vinyl) => {
                if (vinyl && vinyl._id) {
                    state.vinyls.set(vinyl._id, vinyl);
                }
            });
        });

        if (cajones.length === 0) {
            showEmptyView();
            archiveSummary.textContent = 'El archivo todavía está vacío.';
            return;
        }

        renderDrawers();
        showContentView();

        const total = Number.isFinite(Number(data.total))
            ? Number(data.total)
            : state.vinyls.size;

        archiveSummary.textContent = `El archivo reúne ${pluralize(total, 'disco', 'discos')} en ${pluralize(cajones.length, 'cajón', 'cajones')}.`;
    } catch (error) {
        if (requestId !== loadRequestId) return;
        showErrorView(error.message || 'No se pudieron abrir los cajones del archivo.');
        archiveSummary.textContent = 'No se pudo abrir el archivo.';
    } finally {
        if (requestId === loadRequestId) {
            cajonesGrid.setAttribute('aria-busy', 'false');
            setGroupButtonsDisabled(false);
        }
    }
};

const resetDragState = (suppressClick = false) => {
    state.dragging = false;
    document.body.classList.remove('dragging-vinyl');
    turntableDock.classList.remove('is-drag-over');

    cajonesGrid.querySelectorAll('.vinyl-card.is-dragging').forEach((card) => {
        card.classList.remove('is-dragging');
    });

    if (suppressClick) {
        state.suppressClickUntil = Date.now() + 250;
    }
};

const handleGridClick = (event) => {
    if (Date.now() < state.suppressClickUntil) return;
    if (!(event.target instanceof Element)) return;

    const card = event.target.closest('.vinyl-card');
    if (!card || !cajonesGrid.contains(card)) return;

    const vinyl = state.vinyls.get(card.dataset.vinylId);
    if (vinyl) {
        openDetail(vinyl, card);
    }
};

const handleDragStart = (event) => {
    if (!(event.target instanceof Element)) return;

    const card = event.target.closest('.vinyl-card');
    if (!card) return;

    const vinyl = state.vinyls.get(card.dataset.vinylId);
    if (!vinyl) {
        event.preventDefault();
        return;
    }

    state.dragging = true;
    state.suppressClickUntil = Date.now() + 400;
    card.classList.add('is-dragging');
    document.body.classList.add('dragging-vinyl');

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'copy';
        try {
            event.dataTransfer.setData('text/plain', vinyl._id);
            event.dataTransfer.setData(VINYL_MIME, JSON.stringify({
                id: vinyl._id,
                videoId: vinyl.youtubeVideoId || null
            }));
        } catch (error) {
            // Algunos navegadores limitan los tipos personalizados; text/plain sigue disponible.
        }
    }
};

const handleDragEnd = () => {
    resetDragState(true);
};

const handleTurntableDragOver = (event) => {
    if (!state.dragging) return;

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
    }
    turntableDock.classList.add('is-drag-over');
};

const handleTurntableDragLeave = (event) => {
    if (event.relatedTarget instanceof Node && turntableDock.contains(event.relatedTarget)) {
        return;
    }
    turntableDock.classList.remove('is-drag-over');
};

const handleTurntableDrop = (event) => {
    event.preventDefault();
    turntableDock.classList.remove('is-drag-over');

    let vinylId = '';

    if (event.dataTransfer) {
        try {
            vinylId = event.dataTransfer.getData('text/plain') || '';
        } catch (error) {
            vinylId = '';
        }

        if (!state.vinyls.has(vinylId)) {
            try {
                const payload = JSON.parse(event.dataTransfer.getData(VINYL_MIME));
                vinylId = payload && payload.id ? payload.id : vinylId;
            } catch (error) {
                // Se conserva el identificador de text/plain.
            }
        }
    }

    const vinyl = state.vinyls.get(vinylId);
    resetDragState(true);

    if (!vinyl) {
        setTurntableMessage('No se ha podido identificar el vinilo. Inténtalo de nuevo.', 'alert');
        return;
    }

    playVinyl(vinyl);
};

const setTurntableMessage = (message, tone = 'idle') => {
    turntableStatus.textContent = message;
    turntableStatus.classList.remove('is-alert', 'is-ok');
    if (tone === 'alert') {
        turntableStatus.classList.add('is-alert');
    } else if (tone === 'ok') {
        turntableStatus.classList.add('is-ok');
    }
};

const setPlaybackState = (mode) => {
    const spinning = mode === 'playing' || mode === 'paused';
    const canPlay = Boolean(getVideoId(currentVinyl));

    record.classList.toggle('is-spinning', spinning);
    record.classList.toggle('is-paused', mode === 'paused');
    turntable.classList.toggle('is-playing', mode === 'playing');
    playToggle.classList.toggle('is-playing', mode === 'playing');

    playIcon.hidden = mode === 'playing';
    pauseIcon.hidden = mode !== 'playing';
    playToggle.disabled = !canPlay;

    const label = mode === 'playing' ? 'Pausar el vinilo' : 'Reproducir el vinilo';
    playToggle.setAttribute('aria-label', label);
    playToggle.title = label;
};

const updateTurntableRecord = (vinyl) => {
    const title = vinyl.title || 'Disco sin título';
    const artist = vinyl.artist || 'Artista desconocido';

    turntableTrack.hidden = false;
    turntableTitle.textContent = title;
    turntableArtist.textContent = artist;
    turntable.classList.add('has-record');
    record.classList.add('has-vinyl');

    if (vinyl.coverUrl) {
        recordCover.hidden = false;
        recordCover.src = vinyl.coverUrl;
        record.classList.add('has-cover');
    } else {
        recordCover.hidden = true;
        recordCover.removeAttribute('src');
        record.classList.remove('has-cover');
    }
};

const loadYouTubeApi = () => {
    if (window.YT && typeof window.YT.Player === 'function') {
        return Promise.resolve(window.YT);
    }
    if (youtubeApiPromise) {
        return youtubeApiPromise;
    }

    youtubeApiPromise = new Promise((resolve, reject) => {
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previousReady === 'function') {
                previousReady();
            }
            if (window.YT && typeof window.YT.Player === 'function') {
                resolve(window.YT);
            } else {
                reject(new Error('La API de YouTube no está disponible'));
            }
        };

        const script = document.createElement('script');
        script.src = YOUTUBE_API_URL;
        script.async = true;
        script.addEventListener('error', () => {
            reject(new Error('No se pudo cargar la API de YouTube'));
        });
        document.head.appendChild(script);
    }).catch((error) => {
        youtubeApiPromise = null;
        throw error;
    });

    return youtubeApiPromise;
};

const ensureYouTubePlayer = () => {
    if (youtubeReady && youtubePlayer) {
        return Promise.resolve(youtubePlayer);
    }
    if (youtubePlayerPromise) {
        return youtubePlayerPromise;
    }

    youtubePlayerPromise = loadYouTubeApi().then((YT) => new Promise((resolve, reject) => {
        youtubeNamespace = YT;

        try {
            youtubePlayer = new YT.Player('youtubeHost', {
                width: 320,
                height: 180,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    rel: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: () => {
                        youtubeReady = true;
                        const iframe = typeof youtubePlayer.getIframe === 'function'
                            ? youtubePlayer.getIframe()
                            : null;
                        if (iframe) {
                            iframe.setAttribute('tabindex', '-1');
                            iframe.setAttribute('aria-hidden', 'true');
                        }
                        resolve(youtubePlayer);
                    },
                    onStateChange: handleYouTubeStateChange,
                    onError: handleYouTubeError
                }
            });
        } catch (error) {
            youtubePlayerPromise = null;
            reject(error);
        }
    })).catch((error) => {
        youtubePlayerPromise = null;
        throw error;
    });

    return youtubePlayerPromise;
};

const getPlayerState = () => {
    if (!youtubePlayer || typeof youtubePlayer.getPlayerState !== 'function') {
        return null;
    }
    return youtubePlayer.getPlayerState();
};

const handleYouTubeStateChange = (event) => {
    if (!youtubeNamespace) return;
    if (!currentVinyl || !getVideoId(currentVinyl)) return;

    const states = youtubeNamespace.PlayerState;

    if (event.data === states.PLAYING) {
        clearTimeout(autoplayHintTimer);
        setPlaybackState('playing');
        setTurntableMessage('Sonando en el tocadiscos.', 'ok');
        return;
    }

    if (event.data === states.PAUSED) {
        setPlaybackState('paused');
        setTurntableMessage('En pausa.', 'idle');
        return;
    }

    if (event.data === states.ENDED) {
        clearTimeout(autoplayHintTimer);
        setPlaybackState('ended');
        setTurntableMessage('El disco ha llegado a su final.', 'idle');
        return;
    }

    if (event.data === states.BUFFERING) {
        setTurntableMessage('Cargando el audio...', 'idle');
    }
};

const handleYouTubeError = () => {
    if (!currentVinyl || !getVideoId(currentVinyl)) return;

    clearTimeout(autoplayHintTimer);
    setPlaybackState('idle');
    setTurntableMessage('No se pudo reproducir este vinilo. Prueba con otro disco.', 'alert');
};

const playVinyl = (vinyl) => {
    if (!vinyl) return;

    const requestId = ++playbackRequestId;
    clearTimeout(autoplayHintTimer);

    currentVinyl = vinyl;
    updateTurntableRecord(vinyl);

    const videoId = getVideoId(vinyl);
    currentVideoId = videoId;

    if (!videoId) {
        if (youtubeReady && youtubePlayer) {
            try {
                if (typeof youtubePlayer.stopVideo === 'function') {
                    youtubePlayer.stopVideo();
                } else if (typeof youtubePlayer.pauseVideo === 'function') {
                    youtubePlayer.pauseVideo();
                }
            } catch (error) {
                console.warn('No se pudo detener el vinilo anterior:', error);
            }
        }

        setPlaybackState('idle');
        setTurntableMessage('Este vinilo no tiene audio disponible. Abre su ficha para consultarlo.', 'alert');
        return;
    }

    setPlaybackState('idle');
    setTurntableMessage('Colocando el vinilo en el plato...', 'idle');

    ensureYouTubePlayer().then((player) => {
        if (requestId !== playbackRequestId) return;

        setTurntableMessage('Preparando la escucha...', 'idle');
        player.loadVideoById(videoId);
        player.playVideo();

        autoplayHintTimer = window.setTimeout(() => {
            if (requestId !== playbackRequestId || !youtubeNamespace) return;

            const playerState = getPlayerState();
            if (playerState !== youtubeNamespace.PlayerState.PLAYING
                && playerState !== youtubeNamespace.PlayerState.BUFFERING) {
                setTurntableMessage('Pulsa reproducir para escuchar el vinilo.', 'idle');
            }
        }, 2800);
    }).catch((error) => {
        if (requestId !== playbackRequestId) return;
        console.error('No se pudo preparar el reproductor de YouTube:', error);
        setPlaybackState('idle');
        setTurntableMessage('No se pudo cargar el reproductor de YouTube. Inténtalo de nuevo.', 'alert');
    });
};

recordCover.addEventListener('error', () => {
    recordCover.hidden = true;
    recordCover.removeAttribute('src');
    record.classList.remove('has-cover');
});

playToggle.addEventListener('click', () => {
    if (!currentVinyl) return;

    const videoId = getVideoId(currentVinyl);
    if (!videoId) return;

    if (!youtubeReady || !youtubePlayer || !youtubeNamespace) {
        playVinyl(currentVinyl);
        return;
    }

    const playerState = getPlayerState();
    const states = youtubeNamespace.PlayerState;

    if (playerState === states.PLAYING) {
        youtubePlayer.pauseVideo();
        return;
    }

    if (currentVideoId !== videoId) {
        currentVideoId = videoId;
        youtubePlayer.loadVideoById(videoId);
    } else if (playerState === states.ENDED) {
        youtubePlayer.seekTo(0, true);
    }

    setTurntableMessage('Reanudando la escucha...', 'idle');
    youtubePlayer.playVideo();
});

const cleanSummary = (summary) => {
    if (typeof summary !== 'string') return '';
    return summary
        .trim()
        .replace(/\s*Read more on Last\.fm\.?\s*$/i, '')
        .replace(/\s*Leer más en Last\.fm\.?\s*$/i, '')
        .trim();
};

const formatDuration = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds)));
    if (!Number.isFinite(total)) return '';

    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const updateDiscoCover = (coverUrl, title) => {
    if (coverUrl) {
        discoCover.hidden = false;
        discoCover.src = coverUrl;
        discoCover.alt = title ? `Portada de ${title}` : 'Portada del disco';
        discoCoverFallback.hidden = true;
    } else {
        discoCover.hidden = true;
        discoCover.removeAttribute('src');
        discoCover.alt = '';
        discoCoverFallback.hidden = false;
    }
};

const createStat = (label, value) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'disco-stat';

    const term = document.createElement('dt');
    term.textContent = label;

    const description = document.createElement('dd');
    description.textContent = value;

    wrapper.appendChild(term);
    wrapper.appendChild(description);
    return wrapper;
};

const fillQuickDetail = (vinyl) => {
    const title = vinyl.title || 'Disco sin título';
    const artist = vinyl.artist || 'Artista desconocido';
    const album = vinyl.album || '';
    const canPlay = Boolean(getVideoId(vinyl));

    discoModalTitle.textContent = title;
    discoArtist.textContent = artist;
    discoGenre.textContent = vinyl.genre || 'Sin clasificar';
    discoAlbum.textContent = album;
    discoAlbum.hidden = !album;
    updateDiscoCover(vinyl.coverUrl, title);

    discoPlay.disabled = !canPlay;
    discoPlay.textContent = canPlay ? 'Escuchar en el tocadiscos' : 'Sin audio disponible';
};

const resetDetailState = () => {
    discoLoading.hidden = false;
    discoError.hidden = true;
    discoError.textContent = '';
    discoRetry.hidden = true;
    discoSummary.hidden = true;
    discoSummary.textContent = '';
    discoStats.hidden = true;
    discoStats.replaceChildren();
    discoTags.hidden = true;
    discoTags.replaceChildren();
    discoLastFm.hidden = true;
    discoLastFm.removeAttribute('href');
    discoDialog.setAttribute('aria-busy', 'true');
};

const renderDetail = (disco) => {
    const title = disco.title || 'Disco sin título';
    const artist = disco.artist || 'Artista desconocido';
    const album = disco.album || '';
    const info = disco.lastFmInfo || {};

    discoModalTitle.textContent = title;
    discoArtist.textContent = artist;
    discoGenre.textContent = disco.genre || 'Sin clasificar';
    discoAlbum.textContent = album;
    discoAlbum.hidden = !album;
    updateDiscoCover(disco.coverUrl, title);

    const summary = cleanSummary(info.summary);
    discoSummary.textContent = summary || 'Last.fm no ofrece una sinopsis para este disco.';
    discoSummary.hidden = false;

    discoStats.replaceChildren();
    const stats = [];
    const listeners = Number(info.listeners);
    const playcount = Number(info.playcount);
    const duration = Number(info.duration);

    if (Number.isFinite(listeners) && listeners > 0) {
        stats.push(['Oyentes', formatNumber(listeners)]);
    }
    if (Number.isFinite(playcount) && playcount > 0) {
        stats.push(['Reproducciones', formatNumber(playcount)]);
    }
    if (Number.isFinite(duration) && duration > 0) {
        stats.push(['Duración', formatDuration(duration)]);
    }
    if (typeof info.published === 'string' && info.published.trim()) {
        stats.push(['Publicado', info.published.trim()]);
    }

    stats.forEach(([label, value]) => {
        discoStats.appendChild(createStat(label, value));
    });
    discoStats.hidden = stats.length === 0;

    const tags = Array.isArray(info.tags)
        ? info.tags.filter((tag) => typeof tag === 'string' && tag.trim())
        : [];

    discoTags.replaceChildren();
    tags.slice(0, 12).forEach((tag) => {
        const chip = document.createElement('span');
        chip.className = 'disco-tag';
        chip.textContent = tag.trim();
        discoTags.appendChild(chip);
    });
    discoTags.hidden = tags.length === 0;

    discoLastFm.hidden = true;
    discoLastFm.removeAttribute('href');

    if (typeof info.url === 'string') {
        try {
            const lastFmUrl = new URL(info.url);
            if (lastFmUrl.protocol === 'http:' || lastFmUrl.protocol === 'https:') {
                discoLastFm.href = lastFmUrl.href;
                discoLastFm.hidden = false;
            }
        } catch (error) {
            discoLastFm.hidden = true;
        }
    }

    const canPlay = Boolean(disco.playable && getVideoId(disco));
    discoPlay.disabled = !canPlay;
    discoPlay.textContent = canPlay ? 'Escuchar en el tocadiscos' : 'Sin audio disponible';

    discoLoading.hidden = true;
    discoError.hidden = true;
    discoRetry.hidden = true;
    discoDialog.setAttribute('aria-busy', 'false');
};

const loadDetail = async (vinylId, requestId) => {
    try {
        const disco = await api.obtenerDiscoArchivo(vinylId);
        if (requestId !== state.detailRequestId || discoModal.hidden) return;

        state.modalVinyl = disco;
        renderDetail(disco);
    } catch (error) {
        if (requestId !== state.detailRequestId || discoModal.hidden) return;

        discoLoading.hidden = true;
        discoError.textContent = error.message || 'No se pudo consultar la ficha del disco.';
        discoError.hidden = false;
        discoRetry.hidden = false;
        discoDialog.setAttribute('aria-busy', 'false');
    }
};

const openDetail = (vinyl, opener) => {
    if (!vinyl || !vinyl._id) return;

    state.modalOpener = opener || document.activeElement;
    state.previousScrollY = window.scrollY;
    state.modalVinylId = vinyl._id;
    state.modalVinyl = vinyl;
    state.detailRequestId += 1;

    const requestId = state.detailRequestId;

    fillQuickDetail(vinyl);
    resetDetailState();

    document.body.classList.add('modal-open');
    discoModal.hidden = false;
    discoDialog.scrollTop = 0;
    discoClose.focus({ preventScroll: true });

    loadDetail(vinyl._id, requestId);
};

const closeDetail = ({ focusPlay = false } = {}) => {
    if (discoModal.hidden) return;

    state.detailRequestId += 1;
    discoModal.hidden = true;
    discoDialog.setAttribute('aria-busy', 'false');
    document.body.classList.remove('modal-open');
    window.scrollTo(0, state.previousScrollY);

    const opener = state.modalOpener;
    state.modalOpener = null;
    state.modalVinyl = null;

    if (focusPlay) {
        playToggle.focus({ preventScroll: true });
    } else if (opener && typeof opener.focus === 'function' && opener.isConnected) {
        opener.focus({ preventScroll: true });
    }
};

const getFocusableElements = (container) => {
    const selector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter((element) => (
        !element.hidden && element.offsetParent !== null
    ));
};

const handleModalKeydown = (event) => {
    if (discoModal.hidden) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        closeDetail();
        return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(discoDialog);
    if (focusable.length === 0) {
        event.preventDefault();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
};

const initArchivoPage = () => {
    window.ejecutarLogout = () => api.logout();

    groupingButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const grouping = button.dataset.grouping;
            if (!grouping || grouping === state.grouping) return;

            state.grouping = grouping;
            groupingButtons.forEach((candidate) => {
                const isActive = candidate === button;
                candidate.classList.toggle('is-active', isActive);
                candidate.setAttribute('aria-pressed', String(isActive));
            });

            loadDrawers();
        });
    });

    retryBtn.addEventListener('click', loadDrawers);

    cajonesGrid.addEventListener('click', handleGridClick);
    cajonesGrid.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    turntableDock.addEventListener('dragenter', handleTurntableDragOver);
    turntableDock.addEventListener('dragover', handleTurntableDragOver);
    turntableDock.addEventListener('dragleave', handleTurntableDragLeave);
    turntableDock.addEventListener('drop', handleTurntableDrop);

    discoClose.addEventListener('click', () => closeDetail());
    discoModal.addEventListener('click', (event) => {
        if (event.target instanceof Element && event.target.closest('[data-close-detail]')) {
            closeDetail();
        }
    });

    discoRetry.addEventListener('click', () => {
        if (!state.modalVinylId) return;

        state.detailRequestId += 1;
        const requestId = state.detailRequestId;
        discoRetry.hidden = true;
        discoError.hidden = true;
        discoLoading.hidden = false;
        discoDialog.setAttribute('aria-busy', 'true');
        discoClose.focus({ preventScroll: true });

        loadDetail(state.modalVinylId, requestId);
    });

    discoPlay.addEventListener('click', () => {
        if (!state.modalVinyl) return;
        const vinyl = state.modalVinyl;
        if (!getVideoId(vinyl)) return;

        playVinyl(vinyl);
        closeDetail({ focusPlay: true });
    });

    discoCover.addEventListener('load', () => {
        discoCoverFallback.hidden = true;
    });

    discoCover.addEventListener('error', () => {
        discoCover.hidden = true;
        discoCover.removeAttribute('src');
        discoCoverFallback.hidden = false;
    });

    document.addEventListener('keydown', handleModalKeydown);
    setPlaybackState('idle');
    setTurntableMessage('Arrastra un vinilo hasta el plato.', 'idle');

    loadDrawers();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArchivoPage, { once: true });
} else {
    initArchivoPage();
}
