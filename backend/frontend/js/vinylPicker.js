import { api } from './api.js';

let catalogCache = null;
let catalogPromise = null;

const normalizeForSearch = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const cssUrl = (value) => `url("${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;

const normalizeVinyl = (vinyl) => {
    if (!vinyl || typeof vinyl !== 'object' || !vinyl._id) {
        return null;
    }

    return {
        _id: String(vinyl._id),
        title: vinyl.title || 'Vinilo sin título',
        artist: vinyl.artist || 'Artista desconocido',
        album: vinyl.album || '',
        coverUrl: vinyl.coverUrl || '',
        genre: vinyl.genre || '',
        youtubeVideoId: vinyl.youtubeVideoId || null,
        playable: Boolean(vinyl.youtubeVideoId)
    };
};

const flattenCatalog = (payload) => {
    const cajones = Array.isArray(payload && payload.cajones) ? payload.cajones : [];
    const seen = new Set();
    const vinyls = [];

    cajones.forEach((cajon) => {
        const list = cajon && Array.isArray(cajon.vinilos) ? cajon.vinilos : [];
        list.forEach((vinyl) => {
            const normalized = normalizeVinyl(vinyl);
            if (!normalized || seen.has(normalized._id)) {
                return;
            }
            seen.add(normalized._id);
            vinyls.push(normalized);
        });
    });

    return vinyls.sort((left, right) => (
        `${left.artist} ${left.title}`.localeCompare(
            `${right.artist} ${right.title}`,
            'es',
            { sensitivity: 'base' }
        )
    ));
};

const loadCatalog = async () => {
    if (catalogCache) {
        return catalogCache;
    }
    if (!catalogPromise) {
        catalogPromise = api.listarVinilosArchivo()
            .then((payload) => {
                catalogCache = flattenCatalog(payload);
                return catalogCache;
            })
            .finally(() => {
                catalogPromise = null;
            });
    }

    return catalogPromise;
};

const createVinylPicker = ({
    container,
    label = 'Vinilo de El Archivo (opcional)',
    hint = 'Busca un vinilo cacheado para enlazarlo a esta publicación.',
    emptyMessage = 'No hay vinilos cacheados todavía. El Archivo se llenará con las primeras búsquedas.',
    onChange = null
} = {}) => {
    const root = typeof container === 'string'
        ? document.querySelector(container)
        : container;

    if (!root) {
        return {
            getValue: () => null,
            getVinyl: () => null,
            setValue: () => {},
            clear: () => {},
            destroy: () => {}
        };
    }

    root.classList.add('qv-picker');
    root.replaceChildren();

    const head = document.createElement('div');
    head.className = 'qv-picker__head';

    const labelElement = document.createElement('span');
    labelElement.className = 'qv-picker__label';
    labelElement.textContent = label;

    const status = document.createElement('span');
    status.className = 'qv-picker__status';
    status.textContent = hint;

    head.append(labelElement, status);

    const search = document.createElement('div');
    search.className = 'qv-picker__search';

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'qv-picker__input';
    input.placeholder = 'Busca por título, artista o álbum...';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', label);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'qv-picker__clear';
    clearButton.textContent = 'Sin vinilo';

    search.append(input, clearButton);

    const selectedBox = document.createElement('div');
    selectedBox.className = 'qv-picker__selected';
    selectedBox.hidden = true;

    const selectedDisc = document.createElement('span');
    selectedDisc.className = 'qv-picker__selected-disc';

    const selectedMeta = document.createElement('span');
    selectedMeta.className = 'qv-picker__selected-meta';

    const selectedTitle = document.createElement('span');
    selectedTitle.className = 'qv-picker__selected-title';

    const selectedArtist = document.createElement('span');
    selectedArtist.className = 'qv-picker__selected-artist';

    selectedMeta.append(selectedTitle, selectedArtist);

    const selectedClear = document.createElement('button');
    selectedClear.type = 'button';
    selectedClear.className = 'qv-picker__selected-clear';
    selectedClear.setAttribute('aria-label', 'Quitar el vinilo seleccionado');
    selectedClear.title = 'Quitar el vinilo seleccionado';
    selectedClear.textContent = '×';

    selectedBox.append(selectedDisc, selectedMeta, selectedClear);

    const results = document.createElement('div');
    results.className = 'qv-picker__results';
    results.id = `qvPickerResults-${Math.random().toString(36).slice(2, 9)}`;
    results.hidden = true;
    results.setAttribute('role', 'listbox');
    input.setAttribute('aria-controls', results.id);

    root.append(head, search, selectedBox, results);

    let selected = null;
    let isOpen = false;
    let loading = false;
    let catalogError = false;
    let catalog = null;

    const setStatus = (message, isError = false) => {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
    };

    const renderMessage = (message) => {
        results.replaceChildren();
        const paragraph = document.createElement('p');
        paragraph.className = 'qv-picker__message';
        paragraph.textContent = message;
        results.appendChild(paragraph);
    };

    const renderSelected = () => {
        if (!selected) {
            selectedBox.hidden = true;
            selectedTitle.textContent = '';
            selectedArtist.textContent = '';
            selectedDisc.style.backgroundImage = '';
            return;
        }

        selectedBox.hidden = false;
        selectedTitle.textContent = selected.title;
        selectedArtist.textContent = selected.album
            ? `${selected.artist} · ${selected.album}`
            : selected.artist;
        selectedDisc.style.backgroundImage = selected.coverUrl
            ? `${cssUrl(selected.coverUrl)}`
            : 'linear-gradient(135deg, rgba(234, 221, 179, 0.7), rgba(184, 147, 69, 0.45))';
        selectedDisc.style.backgroundSize = 'cover';
        selectedDisc.style.backgroundPosition = 'center';
    };

    const notifyChange = () => {
        if (typeof onChange !== 'function') {
            return;
        }
        onChange(selected ? { ...selected } : null);
    };

    const resolveSelectedFromCatalog = () => {
        if (!selected || !catalog) {
            return false;
        }
        const match = catalog.find((vinyl) => vinyl._id === selected._id);
        if (match) {
            selected = match;
            renderSelected();
            return true;
        }
        return false;
    };

    const selectVinyl = (vinyl) => {
        const normalized = normalizeVinyl(vinyl);
        if (!normalized) {
            return;
        }

        selected = normalized;
        input.value = '';
        renderSelected();
        closeResults();
        setStatus(normalized.artist, false);
        notifyChange();
    };

    const openResults = () => {
        isOpen = true;
        results.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    };

    const closeResults = () => {
        isOpen = false;
        results.hidden = true;
        input.setAttribute('aria-expanded', 'false');
    };

    const getFilteredCatalog = () => {
        const query = normalizeForSearch(input.value);
        const source = Array.isArray(catalog) ? catalog : [];

        if (!query) {
            return source;
        }

        return source.filter((vinyl) => {
            const haystack = normalizeForSearch(
                `${vinyl.title} ${vinyl.artist} ${vinyl.album} ${vinyl.genre}`
            );
            return haystack.includes(query);
        });
    };

    const renderResults = () => {
        if (!isOpen) {
            return;
        }

        if (loading) {
            renderMessage('Abriendo los cajones de El Archivo...');
            return;
        }

        if (catalogError) {
            renderMessage('No se pudo consultar El Archivo. Puedes publicar sin vinilo.');
            return;
        }

        if (!Array.isArray(catalog) || catalog.length === 0) {
            renderMessage(emptyMessage);
            return;
        }

        const matches = getFilteredCatalog();
        if (matches.length === 0) {
            renderMessage('Ningún vinilo coincide con esa búsqueda.');
            return;
        }

        const visible = matches.slice(0, 40);
        const fragment = document.createDocumentFragment();

        visible.forEach((vinyl) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'qv-picker__result';
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', String(Boolean(selected && selected._id === vinyl._id)));

            const cover = document.createElement('span');
            cover.className = 'qv-picker__result-cover';
            if (vinyl.coverUrl) {
                cover.style.backgroundImage = cssUrl(vinyl.coverUrl);
            }

            const meta = document.createElement('span');
            meta.className = 'qv-picker__result-meta';

            const title = document.createElement('span');
            title.className = 'qv-picker__result-title';
            title.textContent = vinyl.title;

            const artist = document.createElement('span');
            artist.className = 'qv-picker__result-artist';
            artist.textContent = vinyl.artist;

            meta.append(title, artist);

            const genre = document.createElement('span');
            genre.className = 'qv-picker__result-genre';
            genre.textContent = vinyl.genre || 'Sin género';

            option.append(cover, meta, genre);
            option.addEventListener('click', () => selectVinyl(vinyl));
            fragment.appendChild(option);
        });

        results.replaceChildren(fragment);

        if (matches.length > visible.length) {
            const more = document.createElement('p');
            more.className = 'qv-picker__message';
            more.textContent = `Mostrando ${visible.length} de ${matches.length} vinilos. Afina la búsqueda.`;
            results.appendChild(more);
        }
    };

    const ensureCatalog = async () => {
        if (catalog || loading) {
            return;
        }

        loading = true;
        catalogError = false;
        setStatus('Buscando en El Archivo...');
        renderResults();

        try {
            catalog = await loadCatalog();
            setStatus(`${catalog.length} ${catalog.length === 1 ? 'vinilo cacheado' : 'vinilos cacheados'}`);
            if (resolveSelectedFromCatalog()) {
                notifyChange();
            }
        } catch (error) {
            catalogError = true;
            setStatus('El Archivo no está disponible ahora mismo.', true);
        } finally {
            loading = false;
            renderResults();
        }
    };

    const clear = ({ focus = false } = {}) => {
        const hadSelection = Boolean(selected);
        selected = null;
        input.value = '';
        renderSelected();
        closeResults();
        setStatus(hint);
        if (focus) {
            input.focus();
        }
        if (hadSelection) {
            notifyChange();
        }
    };

    const setValue = (value) => {
        if (value === null || value === undefined || value === '') {
            selected = null;
            renderSelected();
            notifyChange();
            return;
        }

        if (typeof value === 'object') {
            selected = normalizeVinyl(value);
            renderSelected();
            resolveSelectedFromCatalog();
            notifyChange();
            return;
        }

        const id = String(value);
        const match = Array.isArray(catalog)
            ? catalog.find((vinyl) => vinyl._id === id)
            : null;

        selected = match || {
            _id: id,
            title: 'Vinilo enlazado',
            artist: 'El Archivo',
            album: '',
            coverUrl: '',
            genre: '',
            youtubeVideoId: null,
            playable: false,
            isPlaceholder: true
        };
        renderSelected();
        notifyChange();
    };

    input.addEventListener('focus', () => {
        openResults();
        ensureCatalog();
        renderResults();
    });

    input.addEventListener('input', () => {
        if (!isOpen) {
            openResults();
        }
        ensureCatalog();
        renderResults();
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeResults();
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const first = results.querySelector('.qv-picker__result');
            if (first) {
                first.click();
            }
        }
    });

    clearButton.addEventListener('click', () => clear());
    selectedClear.addEventListener('click', () => clear({ focus: true }));

    const handleDocumentClick = (event) => {
        if (!root.contains(event.target)) {
            closeResults();
        }
    };
    document.addEventListener('click', handleDocumentClick);

    return {
        getValue: () => (selected ? selected._id : null),
        getVinyl: () => (selected ? { ...selected } : null),
        setValue,
        clear,
        destroy: () => {
            document.removeEventListener('click', handleDocumentClick);
            root.replaceChildren();
        }
    };
};

export { createVinylPicker };
