document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const mensaje = document.getElementById('mensaje');

    try {
        // Hacemos la petición al servidor (como lo hacíamos con curl)
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            mensaje.style.color = 'green';
            mensaje.textContent = '¡Ingreso exitoso! Redirigiendo...';
            
            // Guardamos el token en el navegador de forma segura
            localStorage.setItem('token', data.token);
            localStorage.setItem('rol_id', data.usuario.rol_id);

            // Redirigir al panel principal
            window.location.href = 'dashboard.html';
        } else {
            mensaje.style.color = 'red';
            mensaje.textContent = data.error;
        }
    } catch (error) {
        mensaje.textContent = 'Error al conectar con el servidor.';
    }
});
