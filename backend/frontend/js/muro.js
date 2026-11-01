import { api } from './api.js';

const REACTION_LABELS = Object.freeze({
    rompeEsquemas: 'Rompe esquemas',
    profundo: 'Profundo',
    melancolico: 'Melancólico',
    intimo: 'Íntimo',
    inquietante: 'Inquietante',
    tecnologico: 'Tecnológico'
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
    const total = Number(reaccion.count);
    contador.textContent = String(Number.isFinite(total) ? total : 0);
    boton.appendChild(contador);

    return boton;
}

function renderizarReacciones(contenedor, debate) {
    contenedor.replaceChildren();

    Object.entries(REACTION_LABELS).forEach(([tipo, etiqueta]) => {
        const reaccion = debate.reactions && debate.reactions[tipo]
            ? debate.reactions[tipo]
            : { count: 0, reactedByMe: false };

        contenedor.appendChild(
            crearBotonReaccion(String(debate._id), tipo, etiqueta, reaccion)
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
    } catch (error) {
        console.error('No se pudieron cargar los debates:', error);
        mostrarEstado('No se pudieron cargar los debates. Inténtalo de nuevo.');
    }
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

    await cargarDebates();
}

document.addEventListener('DOMContentLoaded', inicializarMuro);
