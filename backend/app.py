from flask import Flask, request, jsonify, send_from_directory, redirect, url_for, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from .database import get_connection, init_db
import sqlite3
from datetime import datetime
import os
from werkzeug.security import check_password_hash

# ANTES (línea donde se crea app):
app = Flask(__name__, static_folder='../frontend', static_url_path='')

# CAMBIAR A:
import os
app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'tu_clave_secreta_aqui_cambiala_por_algo_seguro')

# Configurar Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_page'

# Clase de Usuario para Flask-Login
class User:
    def __init__(self, id, username, rol, empleado_id):
        self.id = id
        self.username = username
        self.rol = rol
        self.empleado_id = empleado_id
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False
    
    def get_id(self):
        return str(self.id)

@login_manager.user_loader
def load_user(user_id):
    conn = get_connection()
    user = conn.execute('SELECT * FROM usuarios WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    if user:
        return User(user['id'], user['username'], user['rol'], user['empleado_id'])
    return None

# Inicializar la base de datos
init_db()

# ==================== RUTAS DE AUTENTICACIÓN ====================

@app.route('/login')
def login_page():
    """Sirve la página de login"""
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/api/login', methods=['POST'])
def login():
    """API de login"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_connection()
    user = conn.execute('SELECT * FROM usuarios WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if user and check_password_hash(user['password'], password):
        user_obj = User(user['id'], user['username'], user['rol'], user['empleado_id'])
        login_user(user_obj)
        return jsonify({
            'success': True,
            'rol': user['rol'],
            'empleado_id': user['empleado_id'],
            'username': user['username']
        })
    
    return jsonify({'success': False, 'error': 'Usuario o contraseña incorrectos'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'success': True})

@app.route('/api/current_user')
def current_user_info():
    """Obtener información del usuario actual"""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'username': current_user.username,
            'rol': current_user.rol,
            'empleado_id': current_user.empleado_id
        })
    return jsonify({'authenticated': False})

# ==================== RUTAS PROTEGIDAS ====================

@app.route('/')
@login_required
def serve_frontend():
    """Sirve la página principal (solo con login)"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
@login_required
def serve_static(path):
    if path == 'login.html':
        return send_from_directory(app.static_folder, 'login.html')
    return send_from_directory(app.static_folder, path)

# API: Obtener empleados (solo admin ve todos, empleado ve solo su info)
@app.route('/api/empleados', methods=['GET'])
@login_required
def get_empleados():
    conn = get_connection()
    
    if current_user.rol == 'admin':
        # Admin ve todos los empleados
        empleados = conn.execute('SELECT * FROM empleados').fetchall()
    else:
        # Empleado solo ve su propia información
        empleados = conn.execute('SELECT * FROM empleados WHERE id = ?', (current_user.empleado_id,)).fetchall()
    
    conn.close()
    return jsonify([dict(e) for e in empleados])

# API: Obtener solicitudes
@app.route('/api/solicitudes', methods=['GET'])
@login_required
def get_solicitudes():
    empleado_id = request.args.get('empleado_id')
    conn = get_connection()
    
    if current_user.rol == 'admin' and empleado_id:
        # Admin puede ver solicitudes de cualquier empleado
        solicitudes = conn.execute('''
            SELECT s.*, e.nombre as empleado_nombre 
            FROM solicitudes s
            JOIN empleados e ON s.empleado_id = e.id
            WHERE s.empleado_id = ?
            ORDER BY s.fecha_solicitud DESC
        ''', (empleado_id,)).fetchall()
    elif current_user.rol == 'admin':
        # Admin ve todas las solicitudes
        solicitudes = conn.execute('''
            SELECT s.*, e.nombre as empleado_nombre 
            FROM solicitudes s
            JOIN empleados e ON s.empleado_id = e.id
            ORDER BY s.fecha_solicitud DESC
        ''').fetchall()
    else:
        # Empleado solo ve sus solicitudes
        solicitudes = conn.execute('''
            SELECT s.*, e.nombre as empleado_nombre 
            FROM solicitudes s
            JOIN empleados e ON s.empleado_id = e.id
            WHERE s.empleado_id = ?
            ORDER BY s.fecha_solicitud DESC
        ''', (current_user.empleado_id,)).fetchall()
    
    conn.close()
    return jsonify([dict(s) for s in solicitudes])

# API: Solicitar vacaciones
@app.route('/api/solicitar', methods=['POST'])
@login_required
def solicitar_vacaciones():
    data = request.json
    
    # Empleado solo puede solicitar para sí mismo
    if current_user.rol == 'empleado':
        empleado_id = current_user.empleado_id
    else:
        empleado_id = data.get('empleado_id')
    
    fecha_inicio = data['fecha_inicio']
    fecha_fin = data['fecha_fin']
    motivo = data.get('motivo', '')
    
    inicio = datetime.strptime(fecha_inicio, '%Y-%m-%d')
    fin = datetime.strptime(fecha_fin, '%Y-%m-%d')
    dias_solicitados = (fin - inicio).days + 1
    
    conn = get_connection()
    
    try:
        empleado = conn.execute(
            'SELECT dias_disponibles FROM empleados WHERE id = ?',
            (empleado_id,)
        ).fetchone()
        
        if not empleado:
            return jsonify({'error': 'Empleado no encontrado'}), 404
        
        if empleado['dias_disponibles'] < dias_solicitados:
            return jsonify({'error': f'No tienes suficientes días. Disponibles: {empleado["dias_disponibles"]}'}), 400
        
        # Verificar solapamiento
        solapamiento = conn.execute('''
            SELECT COUNT(*) as count FROM solicitudes 
            WHERE empleado_id = ? 
            AND estado != 'rechazado'
            AND ((fecha_inicio BETWEEN ? AND ?) OR (fecha_fin BETWEEN ? AND ?))
        ''', (empleado_id, fecha_inicio, fecha_fin, fecha_inicio, fecha_fin)).fetchone()
        
        if solapamiento['count'] > 0:
            return jsonify({'error': 'Ya tienes vacaciones solicitadas en esas fechas'}), 400
        
        # Estado inicial: pendiente (requiere aprobación de admin)
        conn.execute('''
            INSERT INTO solicitudes (empleado_id, fecha_inicio, fecha_fin, dias_solicitados, motivo, estado)
            VALUES (?, ?, ?, ?, ?, 'pendiente')
        ''', (empleado_id, fecha_inicio, fecha_fin, dias_solicitados, motivo))
        
        # NO actualizar días disponibles hasta que sea aprobado
        conn.commit()
        return jsonify({'mensaje': 'Solicitud registrada exitosamente. Esperando aprobación.', 'dias': dias_solicitados})
    
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# API: Aprobar/Rechazar solicitud (solo admin)
@app.route('/api/solicitudes/<int:solicitud_id>/estado', methods=['PUT'])
@login_required
def cambiar_estado(solicitud_id):
    if current_user.rol != 'admin':
        return jsonify({'error': 'No autorizado'}), 403
    
    data = request.json
    nuevo_estado = data['estado']
    
    conn = get_connection()
    
    try:
        solicitud = conn.execute('SELECT * FROM solicitudes WHERE id = ?', (solicitud_id,)).fetchone()
        
        if nuevo_estado == 'aprobado' and solicitud['estado'] == 'pendiente':
            # Restar días disponibles solo cuando se aprueba
            conn.execute('''
                UPDATE empleados 
                SET dias_disponibles = dias_disponibles - ?
                WHERE id = ?
            ''', (solicitud['dias_solicitados'], solicitud['empleado_id']))
        elif nuevo_estado == 'rechazado' and solicitud['estado'] == 'aprobado':
            # Devolver días si se rechaza una ya aprobada
            conn.execute('''
                UPDATE empleados 
                SET dias_disponibles = dias_disponibles + ?
                WHERE id = ?
            ''', (solicitud['dias_solicitados'], solicitud['empleado_id']))
        
        conn.execute('UPDATE solicitudes SET estado = ? WHERE id = ?', (nuevo_estado, solicitud_id))
        conn.commit()
        return jsonify({'mensaje': f'Solicitud {nuevo_estado}'})
    
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# API: Obtener todos los empleados (para admin)
@app.route('/api/todos_empleados', methods=['GET'])
@login_required
def get_todos_empleados():
    if current_user.rol != 'admin':
        return jsonify({'error': 'No autorizado'}), 403
    
    conn = get_connection()
    empleados = conn.execute('SELECT id, nombre, email, departamento, dias_disponibles FROM empleados').fetchall()
    conn.close()
    return jsonify([dict(e) for e in empleados])

if __name__ == '__main__':
    app.run(debug=True, port=5000)