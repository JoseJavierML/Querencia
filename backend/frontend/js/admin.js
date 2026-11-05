import { fetchAutenticado } from './auth.js';
import { api } from './api.js';

const getTodayKey = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === 'year').value;
    const month = parts.find((part) => part.type === 'month').value;
    const day = parts.find((part) => part.type === 'day').value;

    return `${year}-${month}-${day}`;
};

const formatTrackDate = (releaseDate) => {
    const date = new Date(releaseDate);
    if (Number.isNaN(date.getTime())) {
        return 'Fecha sin definir';
    }

    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    });
};

const STATUS_LABELS = {
    today: 'Hoy',
    future: 'Programada',
    past: 'Pasada'
};

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token') || localStorage.getItem('querencia_token');
    const tableBody = document.getElementById('usersTableBody');
    const errorMessage = document.getElementById('errorMessage');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    async function fetchUsers() {
        try {
            const response = await fetchAutenticado('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Acceso denegado: Se requieren permisos de administrador.');
                }
                throw new Error('Error al obtener la lista de usuarios.');
            }

            const users = await response.json();
            renderUsersTable(users);
        } catch (error) {
            errorMessage.textContent = error.message;
        }
    }

    function renderUsersTable(users) {
        tableBody.innerHTML = '';

        users.forEach((user) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.email}</td>
                <td>${user.role || 'user'}</td>
                <td>
                    <button class="delete-btn" data-email="${user.email}">Eliminar</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.delete-btn').forEach((button) => {
            button.addEventListener('click', () => deleteUser(button.getAttribute('data-email')));
        });
    }

    async function deleteUser(email) {
        if (!confirm(`¿Seguro que deseas eliminar al usuario ${email}?`)) return;

        try {
            const response = await fetchAutenticado(`/api/users/${email}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) throw new Error('No se pudo eliminar al usuario.');
            fetchUsers();
        } catch (error) {
            alert(error.message);
        }
    }

    fetchUsers();

    // --- La Cola del Velo ---
    const veloForm = document.getElementById('veloTrackForm');
    const veloTrackId = document.getElementById('veloTrackId');
    const veloReleaseDate = document.getElementById('veloReleaseDate');
    const veloTitle = document.getElementById('veloTitle');
    const veloArtist = document.getElementById('veloArtist');
    const veloAudioUrl = document.getElementById('veloAudioUrl');
    const veloCoverUrl = document.getElementById('veloCoverUrl');
    const veloSubmitBtn = document.getElementById('veloSubmitBtn');
    const veloCancelEditBtn = document.getElementById('veloCancelEditBtn');
    const veloFormMessage = document.getElementById('veloFormMessage');
    const veloTracksBody = document.getElementById('veloTracksBody');
    const veloQueueStatus = document.getElementById('veloQueueStatus');
    const veloQueueFooter = document.getElementById('veloQueueFooter');

    if (!veloForm || !veloTracksBody) {
        return;
    }

    veloReleaseDate.min = getTodayKey();

    const setVeloMessage = (message, type = '') => {
        veloFormMessage.textContent = message;
        veloFormMessage.classList.toggle('is-error', type === 'error');
        veloFormMessage.classList.toggle('is-success', type === 'success');
    };

    const resetVeloForm = () => {
        veloForm.reset();
        veloTrackId.value = '';
        veloReleaseDate.min = getTodayKey();
        veloSubmitBtn.textContent = 'Programar pista';
        veloSubmitBtn.disabled = false;
        veloCancelEditBtn.hidden = true;
        setVeloMessage('');
    };

    const renderEmptyQueue = (message) => {
        veloTracksBody.innerHTML = '';
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 5;
        cell.className = 'queue-empty';
        cell.textContent = message;
        row.appendChild(cell);
        veloTracksBody.appendChild(row);
    };

    const renderVeloTracks = (tracks) => {
        veloTracksBody.innerHTML = '';

        if (!Array.isArray(tracks) || tracks.length === 0) {
            renderEmptyQueue('No hay pistas programadas todavía.');
            return;
        }

        tracks.forEach((track) => {
            const row = document.createElement('tr');

            const dateCell = document.createElement('td');
            dateCell.textContent = formatTrackDate(track.releaseDate);
            row.appendChild(dateCell);

            const trackCell = document.createElement('td');
            trackCell.className = 'track-cell';
            const trackTitle = document.createElement('strong');
            trackTitle.textContent = track.title;
            const trackArtist = document.createElement('span');
            trackArtist.textContent = track.artist;
            trackCell.appendChild(trackTitle);
            trackCell.appendChild(trackArtist);
            row.appendChild(trackCell);

            const reflectionsCell = document.createElement('td');
            reflectionsCell.textContent = String(track.reflectionCount || 0);
            row.appendChild(reflectionsCell);

            const statusCell = document.createElement('td');
            const status = document.createElement('span');
            const statusKey = STATUS_LABELS[track.status] ? track.status : 'future';
            status.className = `status-badge status-${statusKey}`;
            status.textContent = STATUS_LABELS[statusKey];
            statusCell.appendChild(status);
            row.appendChild(statusCell);

            const actionsCell = document.createElement('td');
            if (track.status === 'past') {
                const locked = document.createElement('span');
                locked.className = 'queue-status';
                locked.textContent = 'Histórica';
                actionsCell.appendChild(locked);
            } else {
                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.className = 'btn-action';
                editButton.textContent = 'Editar';
                editButton.addEventListener('click', () => startEditingTrack(track));
                actionsCell.appendChild(editButton);
            }
            row.appendChild(actionsCell);

            veloTracksBody.appendChild(row);
        });
    };

    const loadVeloTracks = async () => {
        try {
            const data = await api.listarPistasVelo();
            const tracks = Array.isArray(data) ? data : [];
            renderVeloTracks(tracks);

            const activeCount = tracks.filter((track) => track.status !== 'past').length;
            veloQueueStatus.textContent = `${tracks.length} ${tracks.length === 1 ? 'pista' : 'pistas'} en la cola`;
            veloQueueFooter.textContent = `${activeCount} ${activeCount === 1 ? 'pista activa o futura' : 'pistas activas o futuras'} · ${tracks.reduce((total, track) => total + (track.reflectionCount || 0), 0)} reflexiones`;
        } catch (error) {
            renderEmptyQueue('No se pudo cargar la cola del Velo.');
            veloQueueStatus.textContent = 'Error de sincronización';
            veloQueueFooter.textContent = error.message;
        }
    };

    const startEditingTrack = (track) => {
        veloTrackId.value = track._id;
        veloReleaseDate.value = String(track.releaseDate).slice(0, 10);
        veloTitle.value = track.title || '';
        veloArtist.value = track.artist || '';
        veloAudioUrl.value = track.audioUrl || '';
        veloCoverUrl.value = track.coverUrl || '';
        veloSubmitBtn.textContent = 'Guardar cambios';
        veloCancelEditBtn.hidden = false;
        setVeloMessage(`Editando la pista del ${formatTrackDate(track.releaseDate)}.`, 'success');
        veloForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        veloTitle.focus();
    };

    veloCancelEditBtn.addEventListener('click', resetVeloForm);

    veloForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const trackId = veloTrackId.value;
        const payload = {
            releaseDate: veloReleaseDate.value,
            title: veloTitle.value.trim(),
            artist: veloArtist.value.trim(),
            audioUrl: veloAudioUrl.value.trim(),
            coverUrl: veloCoverUrl.value.trim()
        };

        if (!payload.releaseDate || !payload.title || !payload.artist || !payload.audioUrl) {
            setVeloMessage('Completa la fecha, el título, el artista y la URL del audio.', 'error');
            return;
        }

        veloSubmitBtn.disabled = true;
        setVeloMessage(trackId ? 'Guardando los cambios...' : 'Programando la pista...');

        try {
            if (trackId) {
                await api.actualizarPistaVelo(trackId, payload);
            } else {
                await api.crearPistaVelo(payload);
            }

            resetVeloForm();
            setVeloMessage(trackId ? 'Pista actualizada correctamente.' : 'Pista programada correctamente.', 'success');
            await loadVeloTracks();
        } catch (error) {
            setVeloMessage(error.message || 'No se pudo guardar la pista.', 'error');
            veloSubmitBtn.disabled = false;
        }
    });

    loadVeloTracks();
});
