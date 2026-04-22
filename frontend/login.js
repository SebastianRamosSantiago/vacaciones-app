// login.js - Lógica para la página de login

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Mostrar mensaje de carga
    const button = document.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.textContent = 'Ingresando...';
    button.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Guardar información en sessionStorage
            sessionStorage.setItem('user', JSON.stringify({
                username: data.username,
                rol: data.rol,
                empleado_id: data.empleado_id
            }));
            // Redirigir al dashboard
            window.location.href = '/';
        } else {
            mostrarError(data.error);
        }
    } catch (error) {
        mostrarError('Error de conexión con el servidor');
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
});

function mostrarError(mensaje) {
    // Crear elemento de error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = '❌ ' + mensaje;
    errorDiv.style.marginBottom = '15px';
    
    // Insertar antes del formulario
    const form = document.getElementById('loginForm');
    form.parentNode.insertBefore(errorDiv, form);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}