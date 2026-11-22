const YOUTUBE_API_URL = 'https://www.youtube.com/iframe_api';

let youtubeApiPromise = null;

export const loadYouTubeApi = () => {
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
