import { api } from './api.js';

const MAX_REFLECTION_LENGTH = 5000;

window.ejecutarLogout = () => api.logout();

const getEmbedUrl = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.replace(/^www\./, '');

        if (host === 'youtu.be') {
            const videoId = url.pathname.split('/').filter(Boolean)[0];
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
            if (url.pathname.startsWith('/embed/')) {
                return rawUrl;
            }
            const videoId = url.searchParams.get('v');
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

const renderPlayer = (container, audioUrl) => {
    container.innerHTML = '';

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
        container.innerHTML = '';
        const fallback = document.createElement('div');
        const message = document.createElement('p');
        message.className = 'player-note';
        message.textContent = 'El reproductor no ha podido cargar el audio. Puedes abrirlo directamente.';

        const link = document.createElement('a');
        link.className = 'button-link';
        link.href = audioUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Abrir audio';
        link.style.marginTop = '1rem';

        fallback.appendChild(message);
        fallback.appendChild(link);
        container.appendChild(fallback);
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
