import { api } from './api.js';

const MAX_REFLECTION_LENGTH = 5000;

window.ejecutarLogout = () => api.logout();

const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.3v13.4L19 12z"></path></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="5" width="3.4" height="14" rx="1"></rect><rect x="13.6" y="5" width="3.4" height="14" rx="1"></rect></svg>';

let youtubeApiPromise = null;
let playerRenderId = 0;
const activeYouTubePlayers = new Set();

const getYouTubeVideoId = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '');

        if (host === 'youtu.be') {
            return url.pathname.split('/').filter(Boolean)[0] || null;
        }

        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
            if (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')) {
                return url.pathname.split('/').filter(Boolean)[1] || null;
            }
            return url.searchParams.get('v');
        }

        return null;
    } catch (error) {
        return null;
    }
};

const getEmbedUrl = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '');

        if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
            const videoId = getYouTubeVideoId(rawUrl);
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        if (host === 'spotify.com' || host === 'open.spotify.com') {
            if (url.pathname.includes('/embed/')) {
                return rawUrl;
            }
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts.length >= 2) {
                return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
            }
            return null;
        }

        if (host === 'soundcloud.com' || host === 'w.soundcloud.com') {
            if (host === 'w.soundcloud.com' && url.pathname.includes('/player')) {
                return rawUrl;
            }
            return `https://w.soundcloud.com/player/?url=${encodeURIComponent(rawUrl)}&color=%23b89345&auto_play=false`;
        }

        if (host === 'vimeo.com' || host === 'player.vimeo.com') {
            if (host === 'player.vimeo.com') {
                return rawUrl;
            }
            const videoId = url.pathname.split('/').filter(Boolean)[0];
            return videoId && /^\d+$/.test(videoId)
                ? `https://player.vimeo.com/video/${videoId}`
                : null;
        }

        if ((host === 'bandcamp.com' || host.endsWith('.bandcamp.com')) && url.pathname.includes('EmbeddedPlayer')) {
            return rawUrl;
        }

        return null;
    } catch (error) {
        return null;
    }
};

const destroyYouTubePlayers = () => {
    activeYouTubePlayers.forEach((player) => {
        try {
            player.destroy();
        } catch (error) {
            // El reproductor ya pudo haber sido retirado por la API.
        }
    });
    activeYouTubePlayers.clear();
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

const showPlayerFallback = (container, audioUrl, renderId, allowDirectLink = false) => {
    if (renderId !== playerRenderId) {
        return;
    }

    container.innerHTML = '';
    const fallback = document.createElement('div');
    const message = document.createElement('p');
    message.className = 'player-note';
    message.textContent = 'El reproductor no ha podido cargar el audio. Puedes intentarlo de nuevo.';

    fallback.appendChild(message);

    if (allowDirectLink) {
        const link = document.createElement('a');
        link.className = 'button-link';
        link.href = audioUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Abrir audio';
        link.style.marginTop = '1rem';
        fallback.appendChild(link);
    } else {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'button-link';
        retry.textContent = 'Reintentar la escucha';
        retry.style.marginTop = '1rem';
        retry.addEventListener('click', () => renderPlayer(container, audioUrl));
        fallback.appendChild(retry);
    }

    container.appendChild(fallback);
};

const renderYouTubePlayer = (container, videoId, audioUrl, renderId) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'yt-custom-player';

    const hiddenShell = document.createElement('div');
    hiddenShell.className = 'yt-hidden-shell';
    hiddenShell.setAttribute('aria-hidden', 'true');

    const host = document.createElement('div');
    hiddenShell.appendChild(host);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yt-toggle';
    button.innerHTML = PLAY_ICON;
    button.disabled = true;
    button.setAttribute('aria-label', 'Preparando la pista');

    wrapper.appendChild(hiddenShell);
    wrapper.appendChild(button);
    container.appendChild(wrapper);

    const setControlState = (isPlaying) => {
        button.classList.toggle('is-playing', isPlaying);
        button.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
        const label = isPlaying ? 'Pausar la pista' : 'Reproducir la pista';
        button.setAttribute('aria-label', label);
        button.title = label;
    };

    const handleFailure = () => {
        if (renderId !== playerRenderId) {
            return;
        }
        destroyYouTubePlayers();
        showPlayerFallback(container, audioUrl, renderId);
    };

    loadYouTubeApi().then((YT) => {
        if (renderId !== playerRenderId) {
            return;
        }

        const player = new YT.Player(host, {
            videoId,
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
                    if (renderId !== playerRenderId) {
                        player.destroy();
                        return;
                    }

                    const iframe = player.getIframe();
                    if (iframe) {
                        iframe.classList.add('yt-hidden-frame');
                        iframe.setAttribute('aria-hidden', 'true');
                        iframe.setAttribute('tabindex', '-1');
                    }

                    activeYouTubePlayers.add(player);
                    button.disabled = false;
                    setControlState(false);
                },
                onStateChange: (event) => {
                    if (renderId !== playerRenderId) {
                        return;
                    }
                    if (event.data === YT.PlayerState.PLAYING) {
                        setControlState(true);
                    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                        setControlState(false);
                    }
                },
                onError: handleFailure
            }
        });

        button.addEventListener('click', () => {
            if (renderId !== playerRenderId) {
                return;
            }
            const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : null;
            if (state === YT.PlayerState.PLAYING) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        });
    }).catch(handleFailure);
};

const renderPlayer = (container, audioUrl) => {
    const renderId = ++playerRenderId;
    destroyYouTubePlayers();
    container.innerHTML = '';

    const youtubeVideoId = getYouTubeVideoId(audioUrl);
    if (youtubeVideoId) {
        renderYouTubePlayer(container, youtubeVideoId, audioUrl, renderId);
        return;
    }

    const embedUrl = getEmbedUrl(audioUrl);
    if (embedUrl) {
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.title = 'Reproductor de la pista del día';
        iframe.loading = 'lazy';
        iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
        iframe.setAttribute('allowfullscreen', '');
        container.appendChild(iframe);
        return;
    }

    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = audioUrl;
    audio.setAttribute('aria-label', 'Reproductor de la pista del día');

    audio.addEventListener('error', () => {
        showPlayerFallback(container, audioUrl, renderId, true);
    });

    container.appendChild(audio);
};

const formatReleaseDate = (releaseDate) => {
    const date = new Date(releaseDate);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const formatted = date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    });

    return `Pista del ${formatted}`;
};

const initVeloPage = () => {
    const states = {
        loading: document.getElementById('loadingState'),
        empty: document.getElementById('emptyState'),
        error: document.getElementById('errorState'),
        blind: document.getElementById('blindState'),
        revealed: document.getElementById('revealedState')
    };

    const blindPlayer = document.getElementById('blindPlayer');
    const revealedPlayer = document.getElementById('revealedPlayer');
    const reflectionText = document.getElementById('reflectionText');
    const blindCharCount = document.getElementById('blindCharCount');
    const reflectBtn = document.getElementById('reflectBtn');
    const blindError = document.getElementById('blindError');
    const loadError = document.getElementById('loadError');
    const retryBtn = document.getElementById('retryBtn');
    const trackTitle = document.getElementById('trackTitle');
    const trackArtist = document.getElementById('trackArtist');
    const trackDate = document.getElementById('trackDate');
    const trackCover = document.getElementById('trackCover');
    const coverFallback = document.getElementById('coverFallback');
    const reflectionsWall = document.getElementById('reflectionsWall');
    const reflectionCount = document.getElementById('reflectionCount');

    const showState = (name) => {
        Object.entries(states).forEach(([stateName, element]) => {
            if (element) {
                element.hidden = stateName !== name;
            }
        });
    };

    const showError = (message) => {
        blindError.textContent = message;
        blindError.hidden = false;
    };

    const hideError = () => {
        blindError.textContent = '';
        blindError.hidden = true;
    };

    const updateCounter = () => {
        blindCharCount.textContent = `${reflectionText.value.length} / ${MAX_REFLECTION_LENGTH}`;
    };

    const resetCover = () => {
        trackCover.hidden = true;
        trackCover.removeAttribute('src');
        trackCover.alt = '';
        coverFallback.hidden = false;
    };

    const renderCover = (coverUrl) => {
        resetCover();
        if (!coverUrl) {
            return;
        }

        trackCover.alt = 'Portada de la pista revelada';
        trackCover.addEventListener('load', () => {
            trackCover.hidden = false;
            coverFallback.hidden = true;
        }, { once: true });
        trackCover.addEventListener('error', () => {
            resetCover();
        }, { once: true });
        trackCover.src = coverUrl;
    };

    const renderReflections = (reflections = []) => {
        reflectionsWall.innerHTML = '';
        reflectionCount.textContent = `${reflections.length} ${reflections.length === 1 ? 'reflexión' : 'reflexiones'}`;

        if (reflections.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'wall-empty';
            empty.textContent = 'Aún no hay otras voces en esta pista. La primera escucha también es una forma de abrir el velo.';
            reflectionsWall.appendChild(empty);
            return;
        }

        reflections.forEach((reflection, index) => {
            const card = document.createElement('article');
            card.className = 'reflection-card';
            if (reflection.isMine) {
                card.classList.add('is-mine');
            }

            const meta = document.createElement('div');
            meta.className = 'reflection-meta';

            const voice = document.createElement('span');
            voice.className = 'voice-index';
            voice.textContent = `Voz ${String(index + 1).padStart(2, '0')}`;
            meta.appendChild(voice);

            if (reflection.isMine) {
                const mineTag = document.createElement('span');
                mineTag.className = 'mine-tag';
                mineTag.textContent = 'Tu reflexión';
                meta.appendChild(mineTag);
            }

            const text = document.createElement('p');
            text.className = 'reflection-text';
            text.textContent = reflection.text;

            card.appendChild(meta);
            card.appendChild(text);
            reflectionsWall.appendChild(card);
        });
    };

    const renderRevealed = (track, scrollToTop = false) => {
        showState('revealed');

        trackTitle.textContent = track.title || 'Pista sin título';
        trackArtist.textContent = track.artist || 'Artista sin nombre';
        trackDate.textContent = formatReleaseDate(track.releaseDate);
        renderCover(track.coverUrl);
        renderPlayer(revealedPlayer, track.audioUrl);
        renderReflections(track.reflections || []);

        if (scrollToTop) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const renderBlind = (track) => {
        showState('blind');

        reflectionText.value = '';
        updateCounter();
        hideError();
        reflectBtn.disabled = false;
        renderPlayer(blindPlayer, track.audioUrl);

        window.setTimeout(() => reflectionText.focus(), 250);
    };

    const loadToday = async () => {
        showState('loading');
        loadError.textContent = '';

        try {
            const data = await api.obtenerVeloDelDia();

            if (data && data.participated) {
                renderRevealed(data);
                return;
            }

            if (data && data.audioUrl) {
                renderBlind(data);
                return;
            }

            showState('error');
            loadError.textContent = 'La respuesta del servidor no contiene una pista válida.';
        } catch (error) {
            if (error.status === 404) {
                showState('empty');
                return;
            }

            showState('error');
            loadError.textContent = error.message || 'No se pudo cargar la pista del día.';
        }
    };

    const submitReflection = async () => {
        const text = reflectionText.value.trim();
        if (text.length === 0) {
            showError('Escribe una reflexión antes de retirar el velo.');
            reflectionText.focus();
            return;
        }

        hideError();
        reflectBtn.disabled = true;
        const originalMarkup = reflectBtn.innerHTML;
        reflectBtn.textContent = 'Retirando el velo...';

        try {
            const track = await api.reflexionarVelo(text);
            renderRevealed(track, true);
        } catch (error) {
            if (error.status === 409) {
                await loadToday();
                return;
            }

            reflectBtn.innerHTML = originalMarkup;
            reflectBtn.disabled = false;
            showError(error.message || 'No se pudo guardar tu reflexión. Inténtalo de nuevo.');
        }
    };

    reflectionText.addEventListener('input', updateCounter);
    reflectBtn.addEventListener('click', submitReflection);
    retryBtn.addEventListener('click', loadToday);

    reflectionText.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submitReflection();
        }
    });

    updateCounter();
    loadToday();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVeloPage, { once: true });
} else {
    initVeloPage();
}
