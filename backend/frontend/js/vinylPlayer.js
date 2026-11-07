const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
const VINYL_MIME = 'application/x-querencia-vinyl';

const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.3v13.4L19 12z"></path></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="3.4" height="14" rx="1"></rect><rect x="13.6" y="5" width="3.4" height="14" rx="1"></rect></svg>';

let youtubeApiPromise = null;
let dock = null;
let dockParts = null;
let player = null;
let playerReady = false;
let isPlaying = false;
let currentVinyl = null;
let playToken = 0;
let dragArmToken = null;

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

const normalizeVinylObject = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return null;
    }
    if (!candidate.title || !candidate.artist) {
        return null;
    }
    if (!candidate._id && !candidate.youtubeVideoId) {
        return null;
    }

    return {
        _id: candidate._id ? String(candidate._id) : null,
        title: candidate.title,
        artist: candidate.artist,
        album: candidate.album || '',
        coverUrl: candidate.coverUrl || '',
        genre: candidate.genre || '',
        youtubeVideoId: candidate.youtubeVideoId || null,
        playable: Boolean(candidate.youtubeVideoId)
    };
};

const extractLinkedVinyl = (source) => {
    if (!source || typeof source !== 'object') {
        return null;
    }

    return normalizeVinylObject(source.vinyl) || normalizeVinylObject(source.vinylId);
};

const normalizeVinyl = (source) => {
    return extractLinkedVinyl(source) || normalizeVinylObject(source);
};

const ensureDock = () => {
    if (dock) {
        return dock;
    }
    if (!document.body) {
        return null;
    }

    dock = document.createElement('section');
    dock.className = 'qv-dock';
    dock.id = 'qvVinylDock';
    dock.hidden = true;
    dock.setAttribute('aria-label', 'Tocadiscos global de El Archivo');
    dock.innerHTML = `
        <div class="qv-dock__disc" aria-hidden="true"></div>
        <div class="qv-dock__copy">
            <span class="qv-dock__eyebrow">El Archivo suena</span>
            <span class="qv-dock__title"></span>
            <span class="qv-dock__artist"></span>
            <span class="qv-dock__message" role="status" hidden></span>
        </div>
        <div class="qv-dock__controls">
            <button type="button" class="qv-dock__button qv-dock__toggle" aria-label="Reproducir vinilo" title="Reproducir vinilo">${PLAY_ICON}</button>
            <button type="button" class="qv-dock__button qv-dock__button--close" aria-label="Cerrar el tocadiscos" title="Cerrar">×</button>
        </div>
        <div class="qv-dock__frame" aria-hidden="true"></div>
    `;

    dockParts = {
        disc: dock.querySelector('.qv-dock__disc'),
        title: dock.querySelector('.qv-dock__title'),
        artist: dock.querySelector('.qv-dock__artist'),
        message: dock.querySelector('.qv-dock__message'),
        toggle: dock.querySelector('.qv-dock__toggle'),
        close: dock.querySelector('.qv-dock__button--close'),
        frame: dock.querySelector('.qv-dock__frame')
    };

    dockParts.toggle.addEventListener('click', () => {
        if (!player || !playerReady) {
            return;
        }
        if (isPlaying) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });

    dockParts.close.addEventListener('click', () => {
        destroyPlayer();
        currentVinyl = null;
        dock.hidden = true;
    });

    dock.addEventListener('dragover', (event) => {
        const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : [];
        if (!types.includes(VINYL_MIME) && !types.includes('text/plain')) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        dock.classList.add('is-drop-target');
    });

    dock.addEventListener('dragleave', (event) => {
        if (event.target === dock) {
            dock.classList.remove('is-drop-target');
        }
    });

    dock.addEventListener('drop', (event) => {
        event.preventDefault();
        dock.classList.remove('is-drop-target');
        const raw = event.dataTransfer
            ? event.dataTransfer.getData(VINYL_MIME) || event.dataTransfer.getData('text/plain')
            : '';
        if (!raw) {
            return;
        }
        try {
            playVinyl(JSON.parse(raw), { force: true });
        } catch (error) {
            // El arrastre puede venir de otra página o no contener JSON válido.
        }
    });

    document.body.appendChild(dock);
    return dock;
};

const setDockMessage = (message = '') => {
    if (!dockParts) {
        return;
    }
    dockParts.message.textContent = message;
    dockParts.message.hidden = !message;
};

const syncDockControl = () => {
    if (!dockParts) {
        return;
    }

    dock.classList.toggle('is-playing', isPlaying);
    dockParts.toggle.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
    const label = isPlaying ? 'Pausar vinilo' : 'Reproducir vinilo';
    dockParts.toggle.setAttribute('aria-label', label);
    dockParts.toggle.title = label;
    dockParts.toggle.disabled = !playerReady;
};

const paintDockVinyl = (vinyl) => {
    if (!dockParts) {
        return;
    }

    dockParts.title.textContent = vinyl.title;
    dockParts.artist.textContent = vinyl.album
        ? `${vinyl.artist} · ${vinyl.album}`
        : vinyl.artist;

    dockParts.disc.style.setProperty(
        '--qv-dock-cover',
        vinyl.coverUrl ? `url("${vinyl.coverUrl.replace(/"/g, '\\"')}")` : 'none'
    );
};

const destroyPlayer = () => {
    playToken += 1;
    playerReady = false;
    isPlaying = false;

    if (player && typeof player.destroy === 'function') {
        try {
            player.destroy();
        } catch (error) {
            // YouTube ya pudo haber retirado el iframe.
        }
    }
    player = null;

    if (dockParts) {
        dockParts.frame.replaceChildren();
        setDockMessage('');
        syncDockControl();
    }
};

const createPlayer = (vinyl) => {
    const token = ++playToken;
    const YT = window.YT;
    const host = document.createElement('div');
    dockParts.frame.replaceChildren(host);

    const nextPlayer = new YT.Player(host, {
        videoId: vinyl.youtubeVideoId,
        width: 240,
        height: 135,
        playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
        },
        events: {
            onReady: (event) => {
                if (token !== playToken) {
                    event.target.destroy();
                    return;
                }
                player = event.target;
                playerReady = true;
                setDockMessage('');
                syncDockControl();
                event.target.playVideo();
            },
            onStateChange: (event) => {
                if (token !== playToken) {
                    return;
                }
                if (event.data === YT.PlayerState.PLAYING) {
                    isPlaying = true;
                    syncDockControl();
                } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                    isPlaying = false;
                    syncDockControl();
                }
            },
            onError: () => {
                if (token !== playToken) {
                    return;
                }
                playerReady = false;
                isPlaying = false;
                setDockMessage('YouTube no permite reproducir este vinilo.');
                syncDockControl();
            }
        }
    });

    player = nextPlayer;
};

const playVinyl = (source, { force = false } = {}) => {
    const vinyl = normalizeVinyl(source);
    if (!vinyl) {
        return;
    }

    const nextDock = ensureDock();
    if (!nextDock) {
        return;
    }

    const isSameVinyl = currentVinyl
        && currentVinyl._id
        && vinyl._id
        && currentVinyl._id === vinyl._id;

    if (isSameVinyl) {
        nextDock.hidden = false;
        if (player && playerReady) {
            if (isPlaying && !force) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        }
        return;
    }

    currentVinyl = vinyl;
    nextDock.hidden = false;
    setDockMessage('');
    paintDockVinyl(vinyl);

    destroyPlayer();

    if (!vinyl.youtubeVideoId) {
        setDockMessage('Este vinilo no tiene una escucha disponible.');
        syncDockControl();
        return;
    }

    loadYouTubeApi().then((YT) => {
        if (currentVinyl !== vinyl) {
            return;
        }
        createPlayer(vinyl);
    }).catch(() => {
        if (currentVinyl !== vinyl) {
            return;
        }
        setDockMessage('No se pudo cargar el reproductor de YouTube.');
        syncDockControl();
    });
};

const renderMiniVinyl = (source) => {
    const vinyl = normalizeVinyl(source);
    if (!vinyl) {
        return null;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'qv-mini-vinyl';
    button.dataset.vinylId = vinyl._id || '';
    button.draggable = true;
    button.title = `Escuchar ${vinyl.title} de ${vinyl.artist} en el tocadiscos global`;
    button.setAttribute(
        'aria-label',
        `Escuchar ${vinyl.title} de ${vinyl.artist} en el tocadiscos global`
    );

    if (!vinyl.youtubeVideoId) {
        button.classList.add('is-unplayable');
        button.title = `${vinyl.title} de ${vinyl.artist}`;
    }

    const disc = document.createElement('span');
    disc.className = 'qv-mini-vinyl__disc';
    disc.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'qv-mini-vinyl__label';

    if (!vinyl.coverUrl) {
        label.classList.add('is-fallback');
    }
    disc.appendChild(label);

    if (vinyl.coverUrl) {
        const cover = document.createElement('img');
        cover.className = 'qv-mini-vinyl__cover';
        cover.src = vinyl.coverUrl;
        cover.alt = '';
        cover.loading = 'lazy';
        cover.decoding = 'async';
        cover.draggable = false;
        cover.addEventListener('error', () => {
            cover.remove();
            label.classList.add('is-fallback');
        });
        disc.appendChild(cover);
    }

    const play = document.createElement('span');
    play.className = 'qv-mini-vinyl__play';
    play.innerHTML = PLAY_ICON;
    disc.appendChild(play);

    const meta = document.createElement('span');
    meta.className = 'qv-mini-vinyl__meta';

    const title = document.createElement('span');
    title.className = 'qv-mini-vinyl__title';
    title.textContent = vinyl.title;

    const artist = document.createElement('span');
    artist.className = 'qv-mini-vinyl__artist';
    artist.textContent = vinyl.album ? `${vinyl.artist} · ${vinyl.album}` : vinyl.artist;

    meta.append(title, artist);

    const hint = document.createElement('span');
    hint.className = 'qv-mini-vinyl__hint';
    hint.textContent = vinyl.youtubeVideoId ? 'Escuchar' : 'Sin escucha';

    button.append(disc, meta, hint);

    button.addEventListener('dragstart', (event) => {
        const payload = JSON.stringify(vinyl);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData(VINYL_MIME, payload);
            event.dataTransfer.setData('text/plain', payload);
        }
        button.classList.add('is-dragging');

        const targetDock = ensureDock();
        if (!targetDock) {
            return;
        }
        if (targetDock.hidden) {
            dragArmToken = vinyl;
            targetDock.hidden = false;
            paintDockVinyl(vinyl);
            setDockMessage('Suelta el vinilo sobre el tocadiscos para escucharlo.');
            syncDockControl();
        }
        targetDock.classList.add('is-drop-target');
    });

    button.addEventListener('dragend', () => {
        button.classList.remove('is-dragging');
        if (dock) {
            dock.classList.remove('is-drop-target');
        }
        if (dragArmToken === vinyl && !currentVinyl && dock) {
            dock.hidden = true;
            setDockMessage('');
        }
        dragArmToken = null;
    });

    button.addEventListener('click', () => playVinyl(vinyl));

    return button;
};

const appendMiniVinyl = (container, source) => {
    if (!container) {
        return null;
    }

    const vinyl = extractLinkedVinyl(source);
    const mini = vinyl ? renderMiniVinyl(vinyl) : null;
    if (!mini) {
        container.replaceChildren();
        return null;
    }

    container.replaceChildren(mini);
    return mini;
};

export {
    playVinyl,
    renderMiniVinyl,
    appendMiniVinyl
};
