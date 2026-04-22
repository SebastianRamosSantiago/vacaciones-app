let empleados = [];
let empleadoActual = null;
let currentUser = null;

// ==================== AUTENTICACIÓN ====================

async function checkAuth() {
    try {
        const response = await fetch('/api/current_user');
        const user = await response.json();
        
        if (!user.authenticated) {
            window.location.href = '/login';
            return false;
        }
        
        currentUser = user;
        
        // Mostrar barra de usuario
        mostrarInfoUsuario();
        
        // Configurar vista según rol
        if (currentUser.rol === 'admin') {
            await configurarVistaAdmin();
        } else {
            await configurarVistaEmpleado();
        }
        
        return true;
    } catch (error) {
        console.error('Error de autenticación:', error);
        window.location.href = '/login';
        return false;
    }
}

function mostrarInfoUsuario() {
    const container = document.querySelector('.container');
    // Eliminar barra anterior si existe
    const oldBar = document.querySelector('.user-bar');
    if (oldBar) oldBar.remove();
    
    const userBar = document.createElement('div');
    userBar.className = 'user-bar';
    userBar.innerHTML = `
        <div class="user-info">
            <span>👤 <strong>${currentUser.username}</strong></span>
            <span class="user-role">
                ${currentUser.rol === 'admin' ? '👑 Administrador' : '📋 Empleado'}
            </span>
        </div>
        <button onclick="logout()" class="btn-logout">Cerrar Sesión</button>
    `;
    container.insertBefore(userBar, container.firstChild);
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    sessionStorage.clear();
    window.location.href = '/login';
}

// ==================== VISTA DE EMPLEADO ====================

async function configurarVistaEmpleado() {
    // Ocultar elementos que no necesita
    document.getElementById('formularioCard').style.display = 'block';
    document.getElementById('historialCard').style.display = 'block';
    
    // Cargar sus datos
    await cargarMisDatos();
    await cargarMiHistorial();
}

async function cargarMisDatos() {
    try {
        const response = await fetch('/api/empleados');
        const misDatos = await response.json();
        
        if (misDatos.length > 0) {
            empleadoActual = misDatos[0];
            const infoDiv = document.getElementById('infoEmpleado');
            infoDiv.innerHTML = `
                <strong>📧 Email:</strong> ${empleadoActual.email}<br>
                <strong>🏢 Departamento:</strong> ${empleadoActual.departamento}<br>
                <strong>📅 Fecha Contrato:</strong> ${empleadoActual.fecha_contrato}<br>
                <strong>🎯 Días disponibles:</strong> <span style="color: #28a745; font-weight: bold;">${empleadoActual.dias_disponibles}</span>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cargarMiHistorial() {
    try {
        const response = await fetch('/api/solicitudes');
        const solicitudes = await response.json();
        mostrarSolicitudes(solicitudes);
    } catch (error) {
        console.error('Error:', error);
    }
}

// ==================== VISTA DE ADMIN ====================

async function configurarVistaAdmin() {
    // Mostrar cards
    document.getElementById('formularioCard').style.display = 'block';
    document.getElementById('historialCard').style.display = 'block';
    
    // 1. Crear selector de empleados si no existe
    let selectorAdmin = document.getElementById('adminEmpleadoSelect');
    if (!selectorAdmin) {
        const formularioCard = document.getElementById('formularioCard');
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'form-group';
        selectorDiv.innerHTML = `
            <label>👥 Seleccionar Empleado:</label>
            <select id="adminEmpleadoSelect">
                <option value="">-- Todos los empleados --</option>
            </select>
        `;
        formularioCard.insertBefore(selectorDiv, formularioCard.firstChild);
        selectorAdmin = document.getElementById('adminEmpleadoSelect');
    }
    
    // 2. Cargar lista de empleados en el selector
    await cargarListaEmpleadosAdmin();
    
    // 3. Evento al cambiar de empleado
    selectorAdmin.onchange = async () => {
        const empleadoId = selectorAdmin.value;
        if (empleadoId) {
            // Buscar empleado seleccionado
            empleadoActual = empleados.find(emp => emp.id == empleadoId);
            if (empleadoActual) {
                mostrarInfoEmpleadoAdmin(empleadoActual);
                await cargarSolicitudesPorEmpleado(empleadoId);
            }
        } else {
            // Mostrar TODAS las solicitudes
            empleadoActual = null;
            document.getElementById('infoEmpleado').innerHTML = '';
            await cargarTodasSolicitudes();
        }
    };
    
    // 4. Botón para ver todas las solicitudes
    let btnVerTodas = document.getElementById('btnVerTodas');
    if (!btnVerTodas) {
        const formularioCard = document.getElementById('formularioCard');
        btnVerTodas = document.createElement('button');
        btnVerTodas.id = 'btnVerTodas';
        btnVerTodas.textContent = '📋 Ver Todas las Solicitudes';
        btnVerTodas.className = 'btn-primary';
        btnVerTodas.style.marginTop = '10px';
        btnVerTodas.style.background = '#17a2b8';
        btnVerTodas.onclick = async () => {
            document.getElementById('adminEmpleadoSelect').value = '';
            empleadoActual = null;
            document.getElementById('infoEmpleado').innerHTML = '';
            await cargarTodasSolicitudes();
            mostrarMensaje('Mostrando todas las solicitudes', 'success');
        };
        formularioCard.appendChild(btnVerTodas);
    }
    
    // 5. Cargar todas las solicitudes al inicio
    await cargarTodasSolicitudes();
}

async function cargarListaEmpleadosAdmin() {
    try {
        const response = await fetch('/api/todos_empleados');
        empleados = await response.json();
        
        const select = document.getElementById('adminEmpleadoSelect');
        // Limpiar opciones excepto la primera
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        empleados.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = `${emp.nombre} - ${emp.departamento} (${emp.dias_disponibles} días)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar empleados', 'error');
    }
}

function mostrarInfoEmpleadoAdmin(empleado) {
    const infoDiv = document.getElementById('infoEmpleado');
    infoDiv.innerHTML = `
        <strong>📧 Email:</strong> ${empleado.email}<br>
        <strong>🏢 Departamento:</strong> ${empleado.departamento}<br>
        <strong>🎯 Días disponibles:</strong> <span style="color: #28a745; font-weight: bold;">${empleado.dias_disponibles}</span>
    `;
}

async function cargarTodasSolicitudes() {
    try {
        const response = await fetch('/api/solicitudes');
        const solicitudes = await response.json();
        mostrarSolicitudes(solicitudes);
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar solicitudes', 'error');
    }
}

async function cargarSolicitudesPorEmpleado(empleadoId) {
    try {
        const response = await fetch(`/api/solicitudes?empleado_id=${empleadoId}`);
        const solicitudes = await response.json();
        mostrarSolicitudes(solicitudes);
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar solicitudes del empleado', 'error');
    }
}

// ==================== FUNCIÓN COMÚN PARA MOSTRAR SOLICITUDES ====================

function mostrarSolicitudes(solicitudes) {
    const container = document.getElementById('listaSolicitudes');
    
    if (!solicitudes || solicitudes.length === 0) {
        container.innerHTML = '<p>📭 No hay solicitudes registradas</p>';
        return;
    }
    
    container.innerHTML = solicitudes.map(sol => `
        <div class="solicitud ${sol.estado}">
            <strong>👤 ${sol.empleado_nombre || 'Empleado'}</strong><br>
            <strong>📅 ${sol.fecha_inicio} → ${sol.fecha_fin}</strong><br>
            <span>📆 Días: ${sol.dias_solicitados}</span><br>
            <span>📝 Estado: ${sol.estado.toUpperCase()}</span><br>
            <span>📅 Solicitado: ${new Date(sol.fecha_solicitud).toLocaleDateString()}</span>
            ${sol.motivo ? `<br><span>💬 Motivo: ${sol.motivo}</span>` : ''}
            ${currentUser && currentUser.rol === 'admin' && sol.estado === 'pendiente' ? `
                <br><br>
                <button onclick="aprobarSolicitud(${sol.id})" class="btn-aprobar">
                    ✅ Aprobar
                </button>
                <button onclick="rechazarSolicitud(${sol.id})" class="btn-rechazar">
                    ❌ Rechazar
                </button>
            ` : ''}
        </div>
    `).join('');
}

// ==================== ACCIONES DE SOLICITUDES ====================

async function aprobarSolicitud(id) {
    await cambiarEstadoSolicitud(id, 'aprobado');
}

async function rechazarSolicitud(id) {
    await cambiarEstadoSolicitud(id, 'rechazado');
}

async function cambiarEstadoSolicitud(id, estado) {
    try {
        const response = await fetch(`/api/solicitudes/${id}/estado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ estado })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje(`✅ ${data.mensaje}`, 'success');
            
            // Recargar según la vista actual
            if (currentUser.rol === 'admin') {
                const selector = document.getElementById('adminEmpleadoSelect');
                if (selector && selector.value) {
                    // Si hay un empleado seleccionado, recargar sus solicitudes
                    await cargarSolicitudesPorEmpleado(selector.value);
                    // Actualizar días disponibles del empleado
                    await cargarListaEmpleadosAdmin();
                    if (empleadoActual) {
                        const empleadoActualizado = empleados.find(e => e.id == empleadoActual.id);
                        if (empleadoActualizado) mostrarInfoEmpleadoAdmin(empleadoActualizado);
                    }
                } else {
                    // Recargar todas las solicitudes
                    await cargarTodasSolicitudes();
                    await cargarListaEmpleadosAdmin();
                }
            } else {
                await cargarMiHistorial();
                await cargarMisDatos();
            }
        } else {
            mostrarMensaje(`❌ Error: ${data.error}`, 'error');
        }
    } catch (error) {
        mostrarMensaje('Error de conexión', 'error');
    }
}

// ==================== FORMULARIO DE SOLICITUD ====================

document.getElementById('vacacionesForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let empleado_id;
    
    if (currentUser.rol === 'admin') {
        const selector = document.getElementById('adminEmpleadoSelect');
        if (!selector || !selector.value) {
            mostrarMensaje('Selecciona un empleado primero', 'error');
            return;
        }
        empleado_id = parseInt(selector.value);
    } else {
        empleado_id = currentUser.empleado_id;
    }
    
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const motivo = document.getElementById('motivo').value;
    
    if (!fechaInicio || !fechaFin) {
        mostrarMensaje('Completa todas las fechas', 'error');
        return;
    }
    
    if (new Date(fechaInicio) > new Date(fechaFin)) {
        mostrarMensaje('La fecha inicio debe ser anterior a la fecha fin', 'error');
        return;
    }
    
    // Deshabilitar botón
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/solicitar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                empleado_id: empleado_id,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                motivo: motivo
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje(`✅ ${data.mensaje}`, 'success');
            
            // Recargar según la vista
            if (currentUser.rol === 'admin') {
                const selector = document.getElementById('adminEmpleadoSelect');
                if (selector && selector.value) {
                    await cargarSolicitudesPorEmpleado(selector.value);
                } else {
                    await cargarTodasSolicitudes();
                }
                await cargarListaEmpleadosAdmin();
            } else {
                await cargarMiHistorial();
                await cargarMisDatos();
            }
            
            document.getElementById('vacacionesForm').reset();
        } else {
            mostrarMensaje(`❌ Error: ${data.error}`, 'error');
        }
        
    } catch (error) {
        mostrarMensaje('Error de conexión con el servidor', 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// ==================== UTILERÍAS ====================

function mostrarMensaje(mensaje, tipo) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tipo}`;
    alertDiv.textContent = mensaje;
    
    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// ==================== INICIAR APLICACIÓN ====================
checkAuth();