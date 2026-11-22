import { api } from './api.js';
import { createVinylPicker } from './vinylPicker.js';
import { appendMiniVinyl } from './vinylPlayer.js';

const diaryForm = document.getElementById('diaryForm');
const diaryTitle = document.getElementById('diaryTitle');
const diaryText = document.getElementById('diaryText');
const saveEntryBtn = document.getElementById('saveEntryBtn');
const diaryStatus = document.getElementById('diaryStatus');
const entriesList = document.getElementById('entriesList');
const editorView = document.getElementById('editorView');
const readingView = document.getElementById('readingView');
const readingDate = document.getElementById('readingDate');
const readingTitle = document.getElementById('readingTitle');
const readingContent = document.getElementById('readingContent');
const backToEditorBtn = document.getElementById('backToEditorBtn');
const deleteReadingBtn = document.getElementById('deleteReadingBtn');
const readingVinyl = document.getElementById('readingVinyl');

const diaryVinylPicker = createVinylPicker({
    container: document.getElementById('diaryVinylPicker'),
    label: 'El vinilo de este eco (opcional)',
    hint: 'Adjunta una escucha de El Archivo a tu pensamiento.',
    emptyMessage: 'El Archivo aún está vacío. Busca discos en su sección para llenar los cajones.'
});

const MAX_TITLE_LENGTH = 50;
const EXCERPT_LENGTH = 40;

let entradaSeleccionada = null;
let estadoTimeout = null;

const formateadorFecha = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short'
});

function mostrarEstado(mensaje, tipo = '') {
    if (!diaryStatus) return;

    if (estadoTimeout) {
        clearTimeout(estadoTimeout);
        estadoTimeout = null;
    }

    diaryStatus.textContent = mensaje;
    diaryStatus.classList.remove('success', 'error');
    if (tipo) diaryStatus.classList.add(tipo);

    if (mensaje) {
        estadoTimeout = setTimeout(() => {
            diaryStatus.textContent = '';
            diaryStatus.classList.remove('success', 'error');
            estadoTimeout = null;
        }, 3000);
    }
}

function formatearFecha(valor) {
    const fecha = new Date(valor);
    if (!valor || Number.isNaN(fecha.getTime())) return 'Sin fecha';
    return formateadorFecha.format(fecha);
}

function obtenerTitulo(entrada) {
    return typeof entrada.title === 'string' ? entrada.title.trim() : '';
}

function obtenerEtiqueta(entrada) {
    const titulo = obtenerTitulo(entrada);
    if (titulo) return titulo;

    const texto = typeof entrada.text === 'string'
        ? entrada.text.replace(/\s+/g, ' ').trim()
        : '';
    if (!texto) return 'Eco sin título';
    if (texto.length <= EXCERPT_LENGTH) return texto;
    return `${texto.slice(0, EXCERPT_LENGTH).trimEnd()}…`;
}

function marcarEntradaActiva() {
    if (!entriesList) return;
    entriesList.querySelectorAll('.entry-item').forEach((item) => {
        const activa = Boolean(entradaSeleccionada)
            && item.dataset.id === String(entradaSeleccionada._id);
        item.classList.toggle('is-active', activa);
    });
}

function mostrarLectura(entrada) {
    if (!editorView || !readingView) return;

    entradaSeleccionada = entrada;
    const titulo = obtenerTitulo(entrada);

    readingDate.textContent = formatearFecha(entrada.createdAt);
    if (titulo) {
        readingTitle.textContent = titulo;
        readingTitle.classList.remove('is-untitled');
    } else {
        readingTitle.textContent = 'Eco sin título';
        readingTitle.classList.add('is-untitled');
    }
    readingContent.textContent = entrada.text || '';
    appendMiniVinyl(readingVinyl, entrada);

    editorView.hidden = true;
    readingView.hidden = false;
    readingView.scrollTop = 0;
    marcarEntradaActiva();

    if (backToEditorBtn) backToEditorBtn.focus();
}

function mostrarEditor() {
    if (!editorView || !readingView) return;

    entradaSeleccionada = null;
    readingView.hidden = true;
    editorView.hidden = false;
    diaryVinylPicker.clear();
    marcarEntradaActiva();

    if (diaryTitle) diaryTitle.focus();
}

function crearEntradaVisual(entrada) {
    const item = document.createElement('li');
    item.className = 'entry-item';
    item.dataset.id = entrada._id ? String(entrada._id) : '';

    const etiqueta = obtenerEtiqueta(entrada);

    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'entry-open';
    abrir.setAttribute('aria-label', `Leer eco: ${etiqueta}`);
    abrir.addEventListener('click', () => mostrarLectura(entrada));

    const fecha = document.createElement('time');
    fecha.className = 'entry-date';
    fecha.dateTime = entrada.createdAt || '';
    fecha.textContent = formatearFecha(entrada.createdAt);

    const titulo = document.createElement('span');
    titulo.className = 'entry-label';
    titulo.textContent = etiqueta;

    abrir.append(fecha, titulo);

    const borrar = document.createElement('button');
    borrar.type = 'button';
    borrar.className = 'entry-delete';
    borrar.textContent = '×';
    borrar.title = 'Eliminar eco';
    borrar.setAttribute('aria-label', `Eliminar eco: ${etiqueta}`);
    borrar.addEventListener('click', () => eliminarEntrada(entrada, borrar));

    item.append(abrir, borrar);
    return item;
}

function renderizarEntradas(entradas) {
    if (!entriesList) return;
    entriesList.replaceChildren();

    if (!Array.isArray(entradas) || entradas.length === 0) {
        const vacio = document.createElement('li');
        vacio.className = 'entry-empty';
        vacio.textContent = 'Aún no has escrito ningún eco.';
        entriesList.appendChild(vacio);
        return;
    }

    const fragmento = document.createDocumentFragment();
    entradas.forEach((entrada) => fragmento.appendChild(crearEntradaVisual(entrada)));
    entriesList.appendChild(fragmento);
    marcarEntradaActiva();
}

function mostrarErrorEntradas(mensaje) {
    if (!entriesList) return;
    entriesList.replaceChildren();
    const fallo = document.createElement('li');
    fallo.className = 'entry-error';
    fallo.textContent = mensaje;
    entriesList.appendChild(fallo);
}

async function cargarEntradas() {
    try {
        const entradas = await api.listarDiario();
        renderizarEntradas(entradas);

        if (entradaSeleccionada) {
            const sigueExistiendo = Array.isArray(entradas)
                && entradas.some((entrada) => String(entrada._id) === String(entradaSeleccionada._id));
            if (!sigueExistiendo) mostrarEditor();
        }
    } catch (error) {
        mostrarErrorEntradas('No se pudo cargar tu diario.');
        mostrarEstado(error.message || 'No se pudo cargar tu diario.', 'error');
    }
}

async function guardarEntrada(event) {
    event.preventDefault();
    if (!diaryText || !saveEntryBtn) return;

    const texto = diaryText.value.trim();
    if (!texto) {
        mostrarEstado('Escribe algo antes de guardar tu eco.', 'error');
        diaryText.focus();
        return;
    }

    const titulo = diaryTitle ? diaryTitle.value.trim() : '';
    if (titulo.length > MAX_TITLE_LENGTH) {
        mostrarEstado(`El título no puede superar los ${MAX_TITLE_LENGTH} caracteres.`, 'error');
        if (diaryTitle) diaryTitle.focus();
        return;
    }

    saveEntryBtn.disabled = true;
    mostrarEstado('Guardando tu eco...');

    try {
        const vinylId = diaryVinylPicker.getValue();
        await api.crearEntradaDiario(texto, titulo, vinylId);
        diaryText.value = '';
        if (diaryTitle) diaryTitle.value = '';
        diaryVinylPicker.clear();
        mostrarEstado('Eco guardado.', 'success');
        await cargarEntradas();
    } catch (error) {
        mostrarEstado(error.message || 'No se pudo guardar el eco.', 'error');
    } finally {
        saveEntryBtn.disabled = false;
    }
}

async function eliminarEntrada(entrada, boton) {
    if (!entrada || !entrada._id) return;

    const confirmado = window.confirm(
        `¿Eliminar "${obtenerEtiqueta(entrada)}"? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    if (boton) boton.disabled = true;
    mostrarEstado('Eliminando eco...');

    try {
        await api.eliminarEntradaDiario(entrada._id);

        if (entradaSeleccionada
            && String(entradaSeleccionada._id) === String(entrada._id)) {
            mostrarEditor();
        }

        mostrarEstado('Eco eliminado.', 'success');
        await cargarEntradas();
    } catch (error) {
        mostrarEstado(error.message || 'No se pudo eliminar el eco.', 'error');
    } finally {
        if (boton) boton.disabled = false;
    }
}

async function ejecutarLogout() {
    try {
        await api.logout();
    } catch (error) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}

window.ejecutarLogout = ejecutarLogout;

async function inicializarDiario() {
    try {
        const tieneSesion = await api.checkSession();
        if (!tieneSesion) {
            window.location.href = 'index.html';
            return;
        }
        await cargarEntradas();
    } catch (error) {
        mostrarErrorEntradas('No se pudo cargar tu diario.');
        mostrarEstado(error.message || 'No se pudo verificar la sesión.', 'error');
    }
}

if (diaryForm) {
    diaryForm.addEventListener('submit', guardarEntrada);
}

if (backToEditorBtn) {
    backToEditorBtn.addEventListener('click', () => {
        if (diaryText) diaryText.value = '';
        if (diaryTitle) diaryTitle.value = '';
        diaryVinylPicker.clear();
        mostrarEditor();
    });
}

if (deleteReadingBtn) {
    deleteReadingBtn.addEventListener('click', () => {
        if (entradaSeleccionada) {
            eliminarEntrada(entradaSeleccionada, deleteReadingBtn);
        }
    });
}

document.addEventListener('DOMContentLoaded', inicializarDiario);
