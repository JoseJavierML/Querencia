import { api } from './api.js';
import { obtenerUsuarioActual } from './auth.js';

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

const grid = document.querySelector('.debate-grid');
const status = document.getElementById('wallStatus');

function mostrarEstado(mensaje, visible = true) {
    if (!status) return;
    status.textContent = mensaje;
    status.hidden = !visible;
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

function crearTarjeta(debate) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'debate-card';
    tarjeta.dataset.debateId = String(debate._id);

    const portada = document.createElement('div');
    portada.className = 'album-cover-wrapper';
    const imagen = document.createElement('img');
    imagen.className = 'album-cover';
    imagen.src = PLACEHOLDER_COVER;
    imagen.alt = debate.title || 'Debate de la comunidad';
    imagen.loading = 'lazy';
    portada.appendChild(imagen);

    const meta = document.createElement('div');
    meta.className = 'debate-meta';
    const autor = debate.authorEmail
        ? `Abierto por ${debate.authorEmail}`
        : 'Abierto por la Administración';
    meta.textContent = `${autor} • ${formatearFecha(debate.createdAt)}`;

    const titulo = document.createElement('h2');
    titulo.className = 'debate-title';
    titulo.textContent = debate.title || '';

    const texto = document.createElement('p');
    texto.className = 'debate-text';
    texto.textContent = debate.content || '';

    const reacciones = document.createElement('div');
    reacciones.className = 'reactions-container';
    renderizarReacciones(reacciones, debate);

    tarjeta.append(portada, meta, titulo, texto, reacciones);
    activarAura(tarjeta);

    return tarjeta;
}

function renderizarDebates(debates) {
    if (!grid) return;

    grid.replaceChildren();

    if (!Array.isArray(debates) || debates.length === 0) {
        mostrarEstado('Todavía no hay debates en el muro. La administración abrirá el primero pronto.');
        return;
    }

    const fragmento = document.createDocumentFragment();
    debates.forEach((debate) => fragmento.appendChild(crearTarjeta(debate)));
    grid.appendChild(fragmento);
    mostrarEstado('', false);
}

async function cargarDebates() {
    mostrarEstado('Cargando los ecos del muro...');

    try {
        const debates = await api.listarDebates();
        renderizarDebates(debates);
        return true;
    } catch (error) {
        console.error('No se pudieron cargar los debates:', error);
        mostrarEstado('No se pudieron cargar los debates. Inténtalo de nuevo.');
        return false;
    }
}

function crearPanelAdmin() {
    const panel = document.createElement('section');
    panel.className = 'admin-panel';
    panel.setAttribute('aria-label', 'Administración del muro');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'admin-panel-toggle';
    toggle.id = 'adminPanelToggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'adminDebateForm');
    toggle.textContent = 'Crear nueva reflexión';

    const form = document.createElement('form');
    form.className = 'admin-panel-form';
    form.id = 'adminDebateForm';
    form.hidden = true;

    const heading = document.createElement('h2');
    heading.className = 'admin-panel-title';
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

    form.append(heading, intro, titleLabel, contentLabel, actions, feedback);
    panel.append(toggle, form);

    const setOpen = (open) => {
        form.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Cerrar formulario' : 'Crear nueva reflexión';
        if (open) {
            window.requestAnimationFrame(() => titleInput.focus());
        }
    };

    const mostrarFeedback = (mensaje, esError = false) => {
        feedback.textContent = mensaje;
        feedback.hidden = !mensaje;
        feedback.classList.toggle('is-error', esError);
    };

    toggle.addEventListener('click', () => {
        setOpen(form.hidden);
    });

    cancel.addEventListener('click', () => {
        mostrarFeedback('');
        setOpen(false);
        toggle.focus();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!title || !content) {
            mostrarFeedback('El título y el contenido son obligatorios.', true);
            return;
        }

        submit.disabled = true;
        cancel.disabled = true;
        submit.textContent = 'Publicando...';
        mostrarFeedback('');

        try {
            await api.crearDebate(title, content);
            form.reset();
            setOpen(false);

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

    return panel;
}

function montarPanelAdmin() {
    if (!grid || !grid.parentNode) return;

    const usuario = obtenerUsuarioActual();
    if (!usuario || usuario.rol !== 'admin') return;
    if (document.getElementById('adminDebatePanel')) return;

    const panel = crearPanelAdmin();
    panel.id = 'adminDebatePanel';
    grid.parentNode.insertBefore(panel, grid);
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

    montarPanelAdmin();
    await cargarDebates();
}

document.addEventListener('DOMContentLoaded', inicializarMuro);
