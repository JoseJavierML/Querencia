document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('querencia_token');
    const tableBody = document.getElementById('usersTableBody');
    const errorMessage = document.getElementById('errorMessage');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    async function fetchUsers() {
        try {
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Acceso denegado: Se requieren permisos de administrador.');
                }
                throw new Error('Error al obtener la lista de usuarios.');
            }

            const users = await response.json();
            renderUsersTable(users); // #T51
        } catch (error) {
            errorMessage.textContent = error.message;
        }
    }

    function renderUsersTable(users) {
        tableBody.innerHTML = '';

        users.forEach(user => {
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

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const email = e.target.getAttribute('data-email');
                deleteUser(email);
            });
        });
    }

    async function deleteUser(email) {
        if (!confirm(`¿Seguro que deseas eliminar al usuario ${email}?`)) return;

        try {
            const response = await fetch(`/api/users/${email}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('No se pudo eliminar al usuario.');
            }

            fetchUsers();
        } catch (error) {
            alert(error.message);
        }
    }

    fetchUsers();
});