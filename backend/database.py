import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

# Obtener la ruta de la carpeta principal
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'vacaciones.db')

def get_connection():
    """Retorna una conexión a la base de datos SQLite"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Crea las tablas si no existen"""
    conn = get_connection()
    cursor = conn.cursor()
    
    # Tabla de usuarios (para autenticación)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT NOT NULL,  -- 'admin' o 'empleado'
            empleado_id INTEGER,
            FOREIGN KEY (empleado_id) REFERENCES empleados (id)
        )
    ''')
    
    # Tabla de empleados
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS empleados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            departamento TEXT,
            dias_disponibles INTEGER DEFAULT 20,
            fecha_contrato DATE
        )
    ''')
    
    # Tabla de solicitudes de vacaciones
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS solicitudes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empleado_id INTEGER NOT NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            dias_solicitados INTEGER NOT NULL,
            estado TEXT DEFAULT 'pendiente',
            motivo TEXT,
            fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empleado_id) REFERENCES empleados (id)
        )
    ''')
    
    # Insertar empleados de ejemplo si no existen
    cursor.execute("SELECT COUNT(*) FROM empleados")
    if cursor.fetchone()[0] == 0:
        empleados_ejemplo = [
            ('Ana García', 'ana@empresa.com', 'Ventas', 20, '2023-01-15'),
            ('Carlos López', 'carlos@empresa.com', 'TI', 25, '2023-03-10'),
            ('María Rodríguez', 'maria@empresa.com', 'RRHH', 20, '2023-02-01'),
        ]
        cursor.executemany('''
            INSERT INTO empleados (nombre, email, departamento, dias_disponibles, fecha_contrato)
            VALUES (?, ?, ?, ?, ?)
        ''', empleados_ejemplo)
        
        # Obtener los IDs de los empleados insertados
        cursor.execute("SELECT id, nombre FROM empleados")
        empleados = cursor.fetchall()
        
        # Crear usuarios para cada empleado (contraseña: 123456)
        usuarios_ejemplo = [
            ('ana.garcia', generate_password_hash('123456'), 'empleado', empleados[0]['id']),
            ('carlos.lopez', generate_password_hash('123456'), 'empleado', empleados[1]['id']),
            ('maria.rodriguez', generate_password_hash('123456'), 'empleado', empleados[2]['id']),
            ('admin', generate_password_hash('admin123'), 'admin', None),
        ]
        cursor.executemany('''
            INSERT INTO usuarios (username, password, rol, empleado_id)
            VALUES (?, ?, ?, ?)
        ''', usuarios_ejemplo)
    
    conn.commit()
    conn.close()
    print("✅ Base de datos SQLite inicializada correctamente")
    print("📝 Usuarios creados:")
    print("   - ana.garcia / 123456 (empleado)")
    print("   - carlos.lopez / 123456 (empleado)")
    print("   - maria.rodriguez / 123456 (empleado)")
    print("   - admin / admin123 (administrador)")

if __name__ == '__main__':
    init_db()