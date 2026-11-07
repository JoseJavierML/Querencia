import { api } from './api.js';
import { obtenerUsuarioActual } from './auth.js';
import { createVinylPicker } from './vinylPicker.js';
import { appendMiniVinyl } from './vinylPlayer.js';

const REACTION_FALLBACK_LABELS = Object.freeze({
    profundo: 'Profundo',
    melancolico: 'Melancólico',
    rompeEsquemas: 'Rompe esquemas'
});

const AURAS = [
    'rgba(184, 147, 69, 0.55)',
    'rgba(138, 22, 22, 0.45)',
    'rgba(234, 221, 179, 0.35)'
];

const PLACEHOLDER_COVER = 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg';

const MAX_TEXTO_COLAPSADO = 250;
const ESTADO_DURACION_MS = 3500;
const ESTADO_TRANSICION_MS = 350;

const PENCIL_ICON_PATH = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z';
const TRASH_ICON_PATH = 'M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h1v-8h-1Zm3 0v8h1v-8h-1Z';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const grid = document.querySelector('.debate-grid');
const status = document.getElementById('wallStatus');

function esAdministrador() {
    const usuario = obtenerUsuarioActual();
    return Boolean(usuario && usuario.rol === 'admin');
}

let estadoTimeout = null;
let estadoOcultarTimeout = null;

function mostrarEstado(mensaje, visible = true, { persistente = false } = {}) {
    if (!status) return;

    clearTimeout(estadoTimeout);
    clearTimeout(estadoOcultarTimeout);

    if (!visible || !mensaje) {
        status.classList.remove('is-visible');
        estadoOcultarTimeout = window.setTimeout(() => {
            if (!status.classList.contains('is-visible')) {
                status.hidden = true;
                status.textContent = '';
            }
        }, ESTADO_TRANSICION_MS);
        return;
    }

    status.textContent = mensaje;
    status.hidden = false;
    status.classList.remove('is-visible');
    void status.offsetWidth;
    status.classList.add('is-visible');

    if (persistente) return;

    estadoTimeout = window.setTimeout(() => {
        status.classList.remove('is-visible');
        estadoOcultarTimeout = window.setTimeout(() => {
            if (!status.classList.contains('is-visible')) {
                status.hidden = true;
                status.textContent = '';
            }
        }, ESTADO_TRANSICION_MS);
    }, ESTADO_DURACION_MS);
}

function formatearFecha(fechaISO) {
    const fecha = new Date(fechaISO);
    if (Number.isNaN(fecha.getTime())) {
        return 'Fecha desconocida';
    }

    const diferencia = Date.now() - fecha.getTime();
    if (diferencia < 0) {
        return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    }

    const minutos = Math.floor(diferencia / 60000);
    if (minutos < 1) return 'Hace unos instantes';
    if (minutos < 60) return `Hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;

    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;

    return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}

function recortarEmail(email) {
    if (typeof email !== 'string') {
        return '';
    }

    const nombre = email.split('@')[0].trim();
    return nombre || email.trim();
}

function obtenerAutorVisible(debate) {
    if (debate.isAnonymous) {
        return 'Publicado por Anónimo';
    }
    if (debate.authorEmail) {
        return `Abierto por ${recortarEmail(debate.authorEmail)}`;
    }
    return 'Abierto por la Administración';
}

function crearIcono(pathData, className) {
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (className) {
        svg.setAttribute('class', className);
    }

    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);

    return svg;
}

function crearModalLectura() {
    const overlay = document.createElement('div');
    overlay.className = 'reading-modal';
    overlay.id = 'readingModal';
    overlay.hidden = true;

    const backdrop = document.createElement('div');
    backdrop.className = 'reading-modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('section');
    dialog.className = 'reading-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'readingModalTitle');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'reading-modal-close';
    close.setAttribute('aria-label', 'Cerrar lectura');
    close.title = 'Cerrar lectura';
    close.textContent = '×';

    const eyebrow = document.createElement('p');
    eyebrow.className = 'reading-eyebrow';
    eyebrow.textContent = 'Lectura profunda';

    const title = document.createElement('h2');
    title.className = 'reading-title';
    title.id = 'readingModalTitle';

    const meta = document.createElement('p');
    meta.className = 'reading-meta';

    const vinylSlot = document.createElement('div');
    vinylSlot.className = 'qv-vinyl-slot reading-vinyl';

    const body = document.createElement('div');
    body.className = 'reading-body';

    const text = document.createElement('p');
    text.className = 'reading-text';
    body.appendChild(text);

    dialog.append(close, eyebrow, title, meta, vinylSlot, body);
    overlay.append(backdrop, dialog);
    document.body.appendChild(overlay);

    let elementoConFoco = null;
    let scrollPrevio = 0;
    let paddingPrevio = '';

    const cerrar = () => {
        if (overlay.hidden) return;

        overlay.hidden = true;
        document.documentElement.classList.remove('reading-modal-open');
        document.body.classList.remove('reading-modal-open');
        document.body.style.paddingRight = paddingPrevio;
        window.scrollTo(0, scrollPrevio);

        if (elementoConFoco && typeof elementoConFoco.focus === 'function') {
            elementoConFoco.focus({ preventScroll: true });
        }
        elementoConFoco = null;
    };

    const abrir = (debate) => {
        if (!overlay.hidden) return;

        elementoConFoco = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        scrollPrevio = window.scrollY;
        paddingPrevio = document.body.style.paddingRight;

        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        title.textContent = debate.title || 'Reflexión sin título';
        meta.textContent = `${obtenerAutorVisible(debate)} • ${formatearFecha(debate.createdAt)}`;
        text.textContent = typeof debate.content === 'string' ? debate.content : '';
        appendMiniVinyl(vinylSlot, debate);

        overlay.hidden = false;
        document.documentElement.classList.add('reading-modal-open');
        document.body.classList.add('reading-modal-open');

        window.requestAnimationFrame(() => {
            if (overlay.hidden) return;
            body.scrollTop = 0;
            close.focus({ preventScroll: true });
        });
    };

    close.addEventListener('click', cerrar);
    backdrop.addEventListener('click', cerrar);

    document.addEventListener('keydown', (event) => {
        if (overlay.hidden) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            cerrar();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = dialog.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const primero = focusables[0];
        const ultimo = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === primero) {
            event.preventDefault();
            ultimo.focus();
        } else if (!event.shiftKey && document.activeElement === ultimo) {
            event.preventDefault();
            primero.focus();
        }
    });

    return { abrir };
}

const modalLectura = crearModalLectura();

function normalizarReacciones(debate) {
    const reacciones = debate && debate.reactions && typeof debate.reactions === 'object'
        ? debate.reactions
        : {};

    const entradas = Object.entries(reacciones);
    if (entradas.length === 0) {
        return Object.entries(REACTION_FALLBACK_LABELS).map(([tipo, label]) => ({
            tipo,
            label,
            count: 0,
            reactedByMe: false
        }));
    }

    return entradas.map(([tipo, reaccion]) => {
        const total = Number(reaccion && reaccion.count);

        return {
            tipo,
            label: (reaccion && reaccion.label) || REACTION_FALLBACK_LABELS[tipo] || tipo,
            count: Number.isFinite(total) ? total : 0,
            reactedByMe: Boolean(reaccion && reaccion.reactedByMe)
        };
    });
}

function crearBotonReaccion(debateId, tipo, etiqueta, reaccion) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'reaction-tag';
    if (reaccion.reactedByMe) {
        boton.classList.add('active');
    }
    boton.dataset.reaction = tipo;
    boton.dataset.debateId = debateId;
    boton.setAttribute('aria-pressed', String(Boolean(reaccion.reactedByMe)));

    boton.appendChild(document.createTextNode(`${etiqueta} `));

    const contador = document.createElement('span');
    contador.className = 'count';
    contador.textContent = String(reaccion.count);
    boton.appendChild(contador);

    return boton;
}

function renderizarReacciones(contenedor, debate) {
    contenedor.replaceChildren();

    normalizarReacciones(debate).forEach(({ tipo, label, count, reactedByMe }) => {
        contenedor.appendChild(
            crearBotonReaccion(String(debate._id), tipo, label, { count, reactedByMe })
        );
    });
}

function activarAura(tarjeta) {
    tarjeta.addEventListener('mouseenter', () => {
        const auraAleatoria = AURAS[Math.floor(Math.random() * AURAS.length)];
        tarjeta.style.setProperty('--aura-color', auraAleatoria);
    });

    tarjeta.addEventListener('mousemove', (event) => {
        const rect = tarjeta.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        tarjeta.style.setProperty('--mouse-x', `${x}px`);
        tarjeta.style.setProperty('--mouse-y', `${y}px`);
    });
}

async function eliminarDebate(debate, tarjeta, boton) {
    const titulo = debate.title || 'esta reflexión';
    if (!window.confirm(`¿Eliminar "${titulo}"? Esta acción no se puede deshacer.`)) {
        return;
    }

    boton.disabled = true;
    tarjeta.classList.add('is-deleting');

    try {
        await api.eliminarDebate(debate._id);
        const actualizado = await cargarDebates();
        if (actualizado) {
            mostrarEstado('Reflexión eliminada del muro.', true);
        } else {
            boton.disabled = false;
            tarjeta.classList.remove('is-deleting');
        }
    } catch (error) {
        console.error('No se pudo eliminar la reflexión:', error);
        mostrarEstado(error.message || 'No se pudo eliminar la reflexión.', true);
        boton.disabled = false;
        tarjeta.classList.remove('is-deleting');
    }
}

function crearTarjeta(debate, esAdmin) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'debate-card';
    tarjeta.dataset.debateId = String(debate._id);

    const portadaUrl = typeof debate.coverImageUrl === 'string' && debate.coverImageUrl.trim()
        ? debate.coverImageUrl.trim()
        : PLACEHOLDER_COVER;

    const portada = document.createElement('div');
    portada.className = 'album-cover-wrapper';
    const imagen = document.createElement('img');
    imagen.className = 'album-cover';
    imagen.src = portadaUrl;
    imagen.alt = debate.title ? `Portada de ${debate.title}` : 'Portada de la reflexión';
    imagen.loading = 'lazy';
    imagen.referrerPolicy = 'no-referrer';
    imagen.addEventListener('error', () => {
        if (imagen.src !== PLACEHOLDER_COVER) {
            imagen.src = PLACEHOLDER_COVER;
        }
    }, { once: true });
    portada.appendChild(imagen);

    const meta = document.createElement('div');
    meta.className = 'debate-meta';
    meta.textContent = `${obtenerAutorVisible(debate)} • ${formatearFecha(debate.createdAt)}`;

    const titulo = document.createElement('h2');
    titulo.className = 'debate-title';
    titulo.textContent = debate.title || '';

    const texto = document.createElement('p');
    texto.className = 'debate-text';

    const contenido = typeof debate.content === 'string' ? debate.content : '';
    const esLargo = contenido.length > MAX_TEXTO_COLAPSADO;
    const contenidoTruncado = esLargo
        ? `${contenido.slice(0, MAX_TEXTO_COLAPSADO).trimEnd()}...`
        : contenido;
    texto.textContent = contenidoTruncado;

    const cuerpo = document.createElement('div');
    cuerpo.className = 'debate-content';
    cuerpo.appendChild(texto);

    if (esLargo) {
        const leerMas = document.createElement('button');
        leerMas.type = 'button';
        leerMas.className = 'debate-read-more';
        leerMas.textContent = 'Leer más';
        leerMas.setAttribute('aria-haspopup', 'dialog');
        leerMas.setAttribute('aria-controls', 'readingModal');

        leerMas.addEventListener('click', (event) => {
            event.stopPropagation();
            modalLectura.abrir(debate);
        });

        tarjeta.addEventListener('click', (event) => {
            if (event.target.closest('.reactions-container, .debate-delete, .debate-read-more, .qv-mini-vinyl')) {
                return;
            }
            modalLectura.abrir(debate);
        });

        tarjeta.classList.add('is-collapsible');
        cuerpo.appendChild(leerMas);
    }

    const reacciones = document.createElement('div');
    reacciones.className = 'reactions-container';
    renderizarReacciones(reacciones, debate);

    const vinylSlot = document.createElement('div');
    vinylSlot.className = 'qv-vinyl-slot debate-vinyl';
    appendMiniVinyl(vinylSlot, debate);

    tarjeta.append(portada, meta, titulo, cuerpo, vinylSlot, reacciones);

    if (esAdmin) {
        const borrar = document.createElement('button');
        borrar.type = 'button';
        borrar.className = 'debate-delete';
        borrar.title = 'Eliminar reflexión';
        borrar.setAttribute('aria-label', `Eliminar reflexión: ${debate.title || 'sin título'}`);
        borrar.appendChild(crearIcono(TRASH_ICON_PATH, 'debate-delete-icon'));
        borrar.addEventListener('click', () => eliminarDebate(debate, tarjeta, borrar));
        tarjeta.appendChild(borrar);
    }

    activarAura(tarjeta);

    return tarjeta;
}

function renderizarDebates(debates) {
    if (!grid) return;

    grid.replaceChildren();

    if (!Array.isArray(debates) || debates.length === 0) {
        mostrarEstado('Todavía no hay debates en el muro. La administración abrirá el primero pronto.', true, { persistente: true });
        return;
    }

    const esAdmin = esAdministrador();
    const fragmento = document.createDocumentFragment();
    debates.forEach((debate) => fragmento.appendChild(crearTarjeta(debate, esAdmin)));
    grid.appendChild(fragmento);
    mostrarEstado('', false);
}

async function cargarDebates() {
    mostrarEstado('Cargando los ecos del muro...', true, { persistente: true });

    try {
        const debates = await api.listarDebates();
        renderizarDebates(debates);
        return true;
    } catch (error) {
        console.error('No se pudieron cargar los debates:', error);
        mostrarEstado('No se pudieron cargar los debates. Inténtalo de nuevo.', true, { persistente: true });
        return false;
    }
}

function crearModalAdmin() {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal';
    overlay.id = 'adminDebateModal';
    overlay.hidden = true;

    const backdrop = document.createElement('div');
    backdrop.className = 'admin-modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');

    const dialog = document.createElement('section');
    dialog.className = 'admin-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'adminDebateHeading');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'admin-modal-close';
    close.setAttribute('aria-label', 'Cerrar formulario');
    close.title = 'Cerrar formulario';
    close.textContent = '×';

    const form = document.createElement('form');
    form.className = 'admin-panel-form';
    form.id = 'adminDebateForm';

    const heading = document.createElement('h2');
    heading.className = 'admin-panel-title';
    heading.id = 'adminDebateHeading';
    heading.textContent = 'Abrir una nueva reflexión';

    const intro = document.createElement('p');
    intro.className = 'admin-panel-intro';
    intro.textContent = 'Comparte una idea que merezca ser pensada despacio.';

    const titleLabel = document.createElement('label');
    titleLabel.className = 'admin-field';
    titleLabel.htmlFor = 'adminDebateTitle';
    const titleText = document.createElement('span');
    titleText.className = 'admin-field-label';
    titleText.textContent = 'Título';
    const titleInput = document.createElement('input');
    titleInput.className = 'admin-input';
    titleInput.id = 'adminDebateTitle';
    titleInput.name = 'title';
    titleInput.type = 'text';
    titleInput.maxLength = 120;
    titleInput.required = true;
    titleInput.autocomplete = 'off';
    titleInput.placeholder = 'El duende no cabe en un algoritmo';
    titleLabel.append(titleText, titleInput);

    const coverLabel = document.createElement('label');
    coverLabel.className = 'admin-field';
    coverLabel.htmlFor = 'adminDebateCover';
    const coverText = document.createElement('span');
    coverText.className = 'admin-field-label';
    coverText.textContent = 'URL de la imagen de portada';
    const coverInput = document.createElement('input');
    coverInput.className = 'admin-input';
    coverInput.id = 'adminDebateCover';
    coverInput.name = 'coverImageUrl';
    coverInput.type = 'url';
    coverInput.maxLength = 2048;
    coverInput.autocomplete = 'url';
    coverInput.placeholder = 'https://...';
    const coverHint = document.createElement('span');
    coverHint.className = 'admin-field-hint';
    coverHint.textContent = 'Opcional. Si la dejas vacía, se usará la portada por defecto.';
    coverLabel.append(coverText, coverInput, coverHint);

    const contentLabel = document.createElement('label');
    contentLabel.className = 'admin-field';
    contentLabel.htmlFor = 'adminDebateContent';
    const contentText = document.createElement('span');
    contentText.className = 'admin-field-label';
    contentText.textContent = 'Contenido';
    const contentInput = document.createElement('textarea');
    contentInput.className = 'admin-textarea';
    contentInput.id = 'adminDebateContent';
    contentInput.name = 'content';
    contentInput.maxLength = 5000;
    contentInput.rows = 6;
    contentInput.required = true;
    contentInput.placeholder = 'Escribe la reflexión con calma...';
    contentLabel.append(contentText, contentInput);

    const vinylField = document.createElement('div');
    vinylField.className = 'admin-field';
    const vinylPickerSlot = document.createElement('div');
    vinylField.appendChild(vinylPickerSlot);

    const vinylPicker = createVinylPicker({
        container: vinylPickerSlot,
        label: 'Vinilo de El Archivo (opcional)',
        hint: 'Enlaza una escucha oficial a esta reflexión del Muro.'
    });

    const anonymousWrapper = document.createElement('div');
    anonymousWrapper.className = 'admin-anonymous';

    const anonymousLabel = document.createElement('label');
    anonymousLabel.className = 'admin-checkbox';
    anonymousLabel.htmlFor = 'adminDebateAnonymous';

    const anonymousInput = document.createElement('input');
    anonymousInput.type = 'checkbox';
    anonymousInput.className = 'admin-checkbox-input';
    anonymousInput.id = 'adminDebateAnonymous';
    anonymousInput.name = 'isAnonymous';

    const anonymousBox = document.createElement('span');
    anonymousBox.className = 'admin-checkbox-box';
    anonymousBox.setAttribute('aria-hidden', 'true');

    const anonymousText = document.createElement('span');
    anonymousText.className = 'admin-checkbox-text';
    anonymousText.textContent = 'Publicar como anónimo';

    anonymousLabel.append(anonymousInput, anonymousBox, anonymousText);

    const anonymousHint = document.createElement('span');
    anonymousHint.className = 'admin-field-hint';
    anonymousHint.textContent = 'Tu correo no aparecerá en el muro.';

    anonymousWrapper.append(anonymousLabel, anonymousHint);

    const actions = document.createElement('div');
    actions.className = 'admin-actions';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'admin-submit';
    submit.textContent = 'Publicar reflexión';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'admin-cancel';
    cancel.textContent = 'Cancelar';

    actions.append(submit, cancel);

    const feedback = document.createElement('p');
    feedback.className = 'admin-feedback';
    feedback.id = 'adminFeedback';
    feedback.setAttribute('role', 'status');
    feedback.hidden = true;

    form.append(
        heading,
        intro,
        titleLabel,
        coverLabel,
        contentLabel,
        vinylField,
        anonymousWrapper,
        actions,
        feedback
    );
    dialog.append(close, form);
    overlay.append(backdrop, dialog);

    let elementoConFoco = null;

    const abrir = () => {
        if (!overlay.hidden) return;
        elementoConFoco = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        overlay.hidden = false;
        document.body.classList.add('admin-modal-open');
        window.requestAnimationFrame(() => titleInput.focus());
    };

    const cerrar = () => {
        overlay.hidden = true;
        document.body.classList.remove('admin-modal-open');
        if (elementoConFoco) {
            elementoConFoco.focus();
            elementoConFoco = null;
        }
    };

    const mostrarFeedback = (mensaje, esError = false) => {
        feedback.textContent = mensaje;
        feedback.hidden = !mensaje;
        feedback.classList.toggle('is-error', esError);
    };

    close.addEventListener('click', cerrar);
    backdrop.addEventListener('click', cerrar);

    cancel.addEventListener('click', () => {
        form.reset();
        vinylPicker.clear();
        mostrarFeedback('');
        cerrar();
    });

    document.addEventListener('keydown', (event) => {
        if (!overlay.hidden && event.key === 'Escape') {
            event.preventDefault();
            cerrar();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const coverImageUrl = coverInput.value.trim();
        const isAnonymous = anonymousInput.checked;
        const vinylId = vinylPicker.getValue();

        if (!title || !content) {
            mostrarFeedback('El título y el contenido son obligatorios.', true);
            return;
        }

        submit.disabled = true;
        cancel.disabled = true;
        submit.textContent = 'Publicando...';
        mostrarFeedback('');

        try {
            await api.crearDebate(title, content, coverImageUrl, isAnonymous, vinylId);
            form.reset();
            vinylPicker.clear();
            cerrar();

            const actualizado = await cargarDebates();
            if (actualizado) {
                mostrarEstado('Reflexión publicada en el muro.', true);
            } else {
                mostrarEstado('La reflexión se publicó, pero el muro no se pudo actualizar. Recarga la página.', true);
            }
        } catch (error) {
            mostrarFeedback(error.message || 'No se pudo publicar la reflexión.', true);
        } finally {
            submit.disabled = false;
            cancel.disabled = false;
            submit.textContent = 'Publicar reflexión';
        }
    });

    return { overlay, abrir };
}

function crearBotonFlotanteAdmin() {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'admin-fab';
    boton.id = 'adminDebateFab';
    boton.title = 'Crear nueva reflexión';
    boton.setAttribute('aria-label', 'Crear nueva reflexión');
    boton.setAttribute('aria-haspopup', 'dialog');
    boton.setAttribute('aria-controls', 'adminDebateModal');
    boton.appendChild(crearIcono(PENCIL_ICON_PATH, 'admin-fab-icon'));
    return boton;
}

function montarAdministracion() {
    if (!esAdministrador()) return;
    if (document.getElementById('adminDebateFab')) return;

    const modal = crearModalAdmin();
    const fab = crearBotonFlotanteAdmin();

    fab.addEventListener('click', modal.abrir);
    document.body.append(fab, modal.overlay);
}

if (grid) {
    grid.addEventListener('click', async (event) => {
        const boton = event.target.closest('.reaction-tag');
        if (!boton || boton.disabled) return;

        const tarjeta = boton.closest('.debate-card');
        const debateId = boton.dataset.debateId;
        const reaccion = boton.dataset.reaction;
        if (!tarjeta || !debateId || !reaccion) return;

        boton.disabled = true;

        try {
            const actualizado = await api.reaccionarDebate(debateId, reaccion);
            const contenedor = tarjeta.querySelector('.reactions-container');

            if (!contenedor || !actualizado || !actualizado.reactions) {
                boton.disabled = false;
                return;
            }

            renderizarReacciones(contenedor, {
                _id: debateId,
                reactions: actualizado.reactions
            });
            mostrarEstado('', false);
        } catch (error) {
            console.error('No se pudo registrar la reacción:', error);
            mostrarEstado('No se pudo registrar la reacción. Inténtalo de nuevo.');
            boton.disabled = false;
        }
    });
}

async function ejecutarLogout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

window.ejecutarLogout = ejecutarLogout;

async function inicializarMuro() {
    try {
        const tieneSesion = await api.checkSession();
        if (!tieneSesion) {
            window.location.href = 'index.html';
            return;
        }
    } catch (error) {
        console.warn('Verificación de sesión:', error);
    }

    montarAdministracion();
    await cargarDebates();
}

document.addEventListener('DOMContentLoaded', inicializarMuro);
