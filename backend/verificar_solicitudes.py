import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'vacaciones.db')

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=" * 60)
print("SOLICITUDES REGISTRADAS:")
print("=" * 60)

cursor.execute('''
    SELECT s.*, e.nombre as empleado_nombre 
    FROM solicitudes s
    JOIN empleados e ON s.empleado_id = e.id
    ORDER BY s.fecha_solicitud DESC
''')

solicitudes = cursor.fetchall()

if len(solicitudes) == 0:
    print("\n❌ No hay solicitudes registradas")
else:
    for sol in solicitudes:
        print(f"\n📋 Solicitud ID: {sol['id']}")
        print(f"   Empleado: {sol['empleado_nombre']}")
        print(f"   Fechas: {sol['fecha_inicio']} → {sol['fecha_fin']}")
        print(f"   Días: {sol['dias_solicitados']}")
        print(f"   Estado: {sol['estado']}")
        print(f"   Motivo: {sol['motivo'] or 'Sin motivo'}")

conn.close()