import json
import urllib.request
import uuid

API_KEY = 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO'
HEADERS = {
    'apikey': API_KEY,
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def api_get(endpoint):
    url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS, method='GET')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def api_post(endpoint, data):
    url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/{endpoint}"
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, headers=HEADERS, method='POST', data=body)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def api_delete(endpoint):
    url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS, method='DELETE')
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8')

print("=" * 80)
print("REGISTRO DE MOVIMIENTOS EN BORRADOR [PENDIENTE_APROBAR] - OCTUBRE 1 AL 4")
print("=" * 80)

# Cargar catálogo
catalogo = api_get("catalogo_insumos?select=id,codigo,nombre,categoria,costo_unitario_kg,peso_estandar_porcion_kg,tipo_medida")
cat_by_code = {c['codigo'].strip(): c for c in catalogo if c.get('codigo')}

# Limpiar movimientos pendientes existentes de octubre 1 a 4 para idempotencia
print("\nLimpiando movimientos pendientes previos del 1 al 4 de octubre...")
for d in ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']:
    api_delete(f"movimientos_inventario?fecha=eq.{d}&observaciones=ilike.*[PENDIENTE_APROBAR]*")
print("Limpieza completada.")

raw_records = [
    # ==========================================
    # DÍA 1: 1 DE OCTUBRE DE 2026 (1.jpeg)
    # ==========================================
    # Entradas compras
    {'fecha': '2026-10-01', 'hora': '07:00:00', 'code': 'CAR-047', 'tipo': 'ENTRADA_COMPRA', 'und': 450, 'kg': 0, 'obs': 'Compra factura 450 unds Huevos'},
    {'fecha': '2026-10-01', 'hora': '07:05:00', 'code': 'CAR-034', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 27.1, 'obs': 'Compra factura 27.1 Kg Sobaco'},
    {'fecha': '2026-10-01', 'hora': '07:10:00', 'code': 'CER-075', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 120.2, 'obs': 'Compra factura 120.2 Kg Tocino'},
    {'fecha': '2026-10-01', 'hora': '07:15:00', 'code': 'VER-074', 'tipo': 'ENTRADA_COMPRA', 'und': 16, 'kg': 0, 'obs': 'Compra factura 16 paq Papas a la francesa'},
    {'fecha': '2026-10-01', 'hora': '07:20:00', 'code': 'CAR-023', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 8.1, 'obs': 'Compra factura 8.1 Kg Carne para albóndigas'},
    {'fecha': '2026-10-01', 'hora': '07:25:00', 'code': 'CAR-029', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 49.3, 'obs': 'Compra factura 49.3 Kg Lengua de res'},
    {'fecha': '2026-10-01', 'hora': '07:30:00', 'code': 'CAR-043', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 41.5, 'obs': 'Compra factura 41.5 Kg Pernil de pollo'},
    {'fecha': '2026-10-01', 'hora': '07:35:00', 'code': 'PES-062', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 20.0, 'obs': 'Compra factura 20.0 Kg Camarón precocido'},
    {'fecha': '2026-10-01', 'hora': '07:40:00', 'code': 'CAR-035', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 29.3, 'obs': 'Compra factura 29.3 Kg Sobrebarriga'},
    {'fecha': '2026-10-01', 'hora': '07:45:00', 'code': 'CAR-006', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 29.4, 'obs': 'Compra factura 29.4 Kg Costilla San Luis'},
    {'fecha': '2026-10-01', 'hora': '07:50:00', 'code': 'PES-063', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 13.0, 'obs': 'Compra factura 13.0 Kg Lomo de caracho'},
    {'fecha': '2026-10-01', 'hora': '07:55:00', 'code': 'CAR-033', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 20.0, 'obs': 'Compra factura 20.0 Kg Punta de anca'},
    {'fecha': '2026-10-01', 'hora': '08:00:00', 'code': 'CAR-037', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 10.0, 'obs': 'Compra factura 10.0 Kg Alas de pollo'},
    {'fecha': '2026-10-01', 'hora': '08:05:00', 'code': 'CAR-005', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 28.1, 'obs': 'Compra factura 28.1 Kg Costilla tamalera'},
    # Salidas entregas a cocina
    {'fecha': '2026-10-01', 'hora': '09:00:00', 'code': 'CAR-010', 'tipo': 'TRASLADO_COCINA', 'und': 32, 'kg': 0, 'obs': 'Entrega a cocina 32 porciones (23+9) Lomo de cerdo'},
    {'fecha': '2026-10-01', 'hora': '09:05:00', 'code': 'CAR-028', 'tipo': 'TRASLADO_COCINA', 'und': 51, 'kg': 0, 'obs': 'Entrega a cocina 51 porciones Higado'},
    {'fecha': '2026-10-01', 'hora': '09:10:00', 'code': 'EMB-050', 'tipo': 'TRASLADO_COCINA', 'und': 80, 'kg': 0, 'obs': 'Entrega a cocina 80 unds Chorizo paisa'},
    {'fecha': '2026-10-01', 'hora': '09:15:00', 'code': 'CAR-047', 'tipo': 'TRASLADO_COCINA', 'und': 90, 'kg': 0, 'obs': 'Entrega a cocina 90 unds Huevos'},
    {'fecha': '2026-10-01', 'hora': '09:20:00', 'code': 'CAR-003', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 8.0, 'obs': 'Entrega a cocina 8.0 Kg Costilla ahumada'},
    {'fecha': '2026-10-01', 'hora': '09:25:00', 'code': 'CAR-034', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 10.7, 'obs': 'Entrega a cocina 10.7 Kg Sobaco'},
    {'fecha': '2026-10-01', 'hora': '09:30:00', 'code': 'CAR-041', 'tipo': 'TRASLADO_COCINA', 'und': 13, 'kg': 0, 'obs': 'Entrega a cocina 13 porciones Filete de pollo'},
    {'fecha': '2026-10-01', 'hora': '09:35:00', 'code': 'CAR-033', 'tipo': 'TRASLADO_COCINA', 'und': 5, 'kg': 0, 'obs': 'Entrega a cocina 5 porciones Punta de anca'},
    {'fecha': '2026-10-01', 'hora': '09:40:00', 'code': 'CAR-026', 'tipo': 'TRASLADO_COCINA', 'und': 5, 'kg': 0, 'obs': 'Entrega a cocina 5 porciones Churrasco'},
    {'fecha': '2026-10-01', 'hora': '09:45:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 20, 'kg': 0, 'obs': 'Entrega a cocina 20 porciones Tocino'},
    {'fecha': '2026-10-01', 'hora': '09:50:00', 'code': 'VER-074', 'tipo': 'TRASLADO_COCINA', 'und': 1, 'kg': 0, 'obs': 'Entrega a cocina 1 paq Papas a la francesa'},
    {'fecha': '2026-10-01', 'hora': '09:55:00', 'code': 'CAR-023', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 8.1, 'obs': 'Entrega a cocina 8.1 Kg para elaboración de albóndigas'},
    {'fecha': '2026-10-01', 'hora': '10:00:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 8.3, 'obs': 'Entrega a cocina 8.3 Kg Lengua de res'},
    {'fecha': '2026-10-01', 'hora': '10:05:00', 'code': 'CAR-043', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 41.5, 'obs': 'Entrega a cocina 41.5 Kg Pernil de pollo para porcionar'},
    {'fecha': '2026-10-01', 'hora': '10:10:00', 'code': 'CAR-005', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 28.1, 'obs': 'Entrega a cocina 28.1 Kg Costilla tamalera'},
    # Devoluciones / reintegros porcionados
    {'fecha': '2026-10-01', 'hora': '15:00:00', 'code': 'CAR-023', 'tipo': 'DEVOLUCION_COCINA', 'und': 56, 'kg': 0, 'obs': 'Devolución cocina 56 unidades Albóndigas elaboradas'},
    {'fecha': '2026-10-01', 'hora': '15:10:00', 'code': 'CAR-043', 'tipo': 'DEVOLUCION_COCINA', 'und': 130, 'kg': 0, 'obs': 'Devolución cocina 130 porciones Pernil de pollo porcionadas'},

    # ==========================================
    # DÍA 2: 2 DE OCTUBRE DE 2026 (2.jpeg)
    # ==========================================
    {'fecha': '2026-10-02', 'hora': '07:00:00', 'code': 'PES-064', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 7.0, 'obs': 'Compra factura 7.0 Kg Marisco'},
    {'fecha': '2026-10-02', 'hora': '09:00:00', 'code': 'CAR-041', 'tipo': 'TRASLADO_COCINA', 'und': 130, 'kg': 0, 'obs': 'Entrega a cocina 130 porciones Pollo (50 menú / 80 servicio)'},
    {'fecha': '2026-10-02', 'hora': '09:05:00', 'code': 'PES-065', 'tipo': 'TRASLADO_COCINA', 'und': 40, 'kg': 0, 'obs': 'Entrega a cocina 40 porciones Alguacil de res'},
    {'fecha': '2026-10-02', 'hora': '09:10:00', 'code': 'CAR-023', 'tipo': 'TRASLADO_COCINA', 'und': 56, 'kg': 0, 'obs': 'Entrega a cocina 56 porciones Albóndigas'},
    {'fecha': '2026-10-02', 'hora': '09:15:00', 'code': 'PES-062', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 7.1, 'obs': 'Entrega a cocina 7.1 Kg Camarón precocido'},
    {'fecha': '2026-10-02', 'hora': '09:20:00', 'code': 'EMB-050', 'tipo': 'TRASLADO_COCINA', 'und': 80, 'kg': 0, 'obs': 'Entrega a cocina 80 unds Chorizo paisa'},
    {'fecha': '2026-10-02', 'hora': '09:25:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 13.0, 'obs': 'Entrega a cocina 13.0 Kg Tocino Junior entero'},
    {'fecha': '2026-10-02', 'hora': '09:30:00', 'code': 'VER-074', 'tipo': 'TRASLADO_COCINA', 'und': 4, 'kg': 0, 'obs': 'Entrega a cocina 4 paq Papas a la francesa'},
    {'fecha': '2026-10-02', 'hora': '09:35:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 6, 'kg': 0, 'obs': 'Entrega a cocina 6 porciones Lengua de res'},
    {'fecha': '2026-10-02', 'hora': '09:40:00', 'code': 'CAR-006', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 29.4, 'obs': 'Entrega a cocina 29.4 Kg Costilla San Luis para porcionar'},
    {'fecha': '2026-10-02', 'hora': '09:45:00', 'code': 'CAR-034', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 7.5, 'obs': 'Entrega a cocina 7.5 Kg Sobaco'},
    {'fecha': '2026-10-02', 'hora': '09:50:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 14.2, 'obs': 'Entrega a cocina 14.2 Kg Lengua entero'},
    {'fecha': '2026-10-02', 'hora': '09:55:00', 'code': 'CAR-035', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 9.6, 'obs': 'Entrega a cocina 9.6 Kg Sobrebarriga entero'},
    {'fecha': '2026-10-02', 'hora': '10:00:00', 'code': 'CAR-010', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Lomo de cerdo'},
    {'fecha': '2026-10-02', 'hora': '10:05:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 21, 'kg': 17.2, 'obs': 'Entrega a cocina 21 porciones y 17.2 Kg Tocino para corte'},
    {'fecha': '2026-10-02', 'hora': '10:10:00', 'code': 'PES-064', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 7.0, 'obs': 'Entrega a cocina 7.0 Kg Marisco'},
    {'fecha': '2026-10-02', 'hora': '10:15:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 3.6, 'obs': 'Entrega a cocina 3.6 Kg Lengua para corte'},
    {'fecha': '2026-10-02', 'hora': '10:20:00', 'code': 'CAR-035', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 6.0, 'obs': 'Entrega a cocina 6.0 Kg Sobrebarriga para corte'},
    {'fecha': '2026-10-02', 'hora': '10:25:00', 'code': 'RES-071', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 2.2, 'obs': 'Entrega a cocina 2.2 Kg Baby beef para corte'},
    # Devoluciones / reintegros porcionados
    {'fecha': '2026-10-02', 'hora': '15:00:00', 'code': 'CAR-006', 'tipo': 'DEVOLUCION_COCINA', 'und': 70, 'kg': 0, 'obs': 'Devolución cocina 70 porciones Costilla San Luis porcionadas'},
    {'fecha': '2026-10-02', 'hora': '15:05:00', 'code': 'CER-075', 'tipo': 'DEVOLUCION_COCINA', 'und': 45, 'kg': 0, 'obs': 'Devolución cocina 45 porciones Tocino porcionadas'},
    {'fecha': '2026-10-02', 'hora': '15:10:00', 'code': 'CAR-003', 'tipo': 'DEVOLUCION_COCINA', 'und': 80, 'kg': 0, 'obs': 'Devolución cocina 80 porciones Costilla ahumada porcionadas'},
    {'fecha': '2026-10-02', 'hora': '15:15:00', 'code': 'CAR-029', 'tipo': 'DEVOLUCION_COCINA', 'und': 18, 'kg': 0, 'obs': 'Devolución cocina 18 porciones Lengua porcionadas'},
    {'fecha': '2026-10-02', 'hora': '15:20:00', 'code': 'CAR-035', 'tipo': 'DEVOLUCION_COCINA', 'und': 20, 'kg': 0, 'obs': 'Devolución cocina 20 porciones Sobrebarriga porcionadas'},
    {'fecha': '2026-10-02', 'hora': '15:25:00', 'code': 'RES-071', 'tipo': 'DEVOLUCION_COCINA', 'und': 6, 'kg': 0, 'obs': 'Devolución cocina 6 porciones Baby beef porcionadas'},

    # ==========================================
    # DÍA 3: 3 DE OCTUBRE DE 2026 (3a.jpeg y 3b.jpeg)
    # ==========================================
    # Entradas compras
    {'fecha': '2026-10-03', 'hora': '07:00:00', 'code': 'CAR-003', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 20.0, 'obs': 'Compra factura 20.0 Kg Costilla ahumada'},
    {'fecha': '2026-10-03', 'hora': '07:05:00', 'code': 'EMB-050', 'tipo': 'ENTRADA_COMPRA', 'und': 200, 'kg': 0, 'obs': 'Compra factura 200 unds Chorizo paisa'},
    {'fecha': '2026-10-03', 'hora': '07:10:00', 'code': 'EMB-054', 'tipo': 'ENTRADA_COMPRA', 'und': 12, 'kg': 0, 'obs': 'Compra factura 12 unds Chorizo grande'},
    {'fecha': '2026-10-03', 'hora': '07:15:00', 'code': 'EMB-058', 'tipo': 'ENTRADA_COMPRA', 'und': 7, 'kg': 0, 'obs': 'Compra factura 7 unds Chorizo de pollo'},
    {'fecha': '2026-10-03', 'hora': '07:20:00', 'code': 'RES-072', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 41.2, 'obs': 'Compra factura 41.2 Kg Carne asada'},
    {'fecha': '2026-10-03', 'hora': '07:25:00', 'code': 'CAR-027', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 20.4, 'obs': 'Compra factura 20.4 Kg Costilla de res'},
    {'fecha': '2026-10-03', 'hora': '07:30:00', 'code': 'CAR-010', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 20.1, 'obs': 'Compra factura 20.1 Kg Lomo de cerdo'},
    {'fecha': '2026-10-03', 'hora': '07:35:00', 'code': 'CAR-030', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 8.9, 'obs': 'Compra factura 8.9 Kg Lomo viche'},
    {'fecha': '2026-10-03', 'hora': '07:40:00', 'code': 'CAR-041', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 13.7, 'obs': 'Compra factura 13.7 Kg Filete de pollo'},
    {'fecha': '2026-10-03', 'hora': '07:45:00', 'code': 'PES-066', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 7.3, 'obs': 'Compra factura 7.3 Kg Salmón'},
    {'fecha': '2026-10-03', 'hora': '07:50:00', 'code': 'PES-069', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 6.8, 'obs': 'Compra factura 6.8 Kg Trucha'},
    {'fecha': '2026-10-03', 'hora': '07:55:00', 'code': 'PES-067', 'tipo': 'ENTRADA_COMPRA', 'und': 0, 'kg': 15.2, 'obs': 'Compra factura 15.2 Kg Tilapia'},
    # Salidas entregas a cocina
    {'fecha': '2026-10-03', 'hora': '09:00:00', 'code': 'CAR-042', 'tipo': 'TRASLADO_COCINA', 'und': 48, 'kg': 0, 'obs': 'Entrega a cocina 48 porciones Gallina'},
    {'fecha': '2026-10-03', 'hora': '09:05:00', 'code': 'CAR-005', 'tipo': 'TRASLADO_COCINA', 'und': 40, 'kg': 0, 'obs': 'Entrega a cocina 40 porciones Costilla tamalera (Tamal)'},
    {'fecha': '2026-10-03', 'hora': '09:10:00', 'code': 'CAR-035', 'tipo': 'TRASLADO_COCINA', 'und': 15, 'kg': 0, 'obs': 'Entrega a cocina 15 porciones Sobrebarriga'},
    {'fecha': '2026-10-03', 'hora': '09:15:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Lengua de res'},
    {'fecha': '2026-10-03', 'hora': '09:20:00', 'code': 'PES-069', 'tipo': 'TRASLADO_COCINA', 'und': 5, 'kg': 0, 'obs': 'Entrega a cocina 5 porciones Trucha'},
    {'fecha': '2026-10-03', 'hora': '09:25:00', 'code': 'PES-066', 'tipo': 'TRASLADO_COCINA', 'und': 8, 'kg': 0, 'obs': 'Entrega a cocina 8 porciones Salmón'},
    {'fecha': '2026-10-03', 'hora': '09:30:00', 'code': 'PES-062', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 8.0, 'obs': 'Entrega a cocina 8.0 Kg Camarón precocido'},
    {'fecha': '2026-10-03', 'hora': '09:35:00', 'code': 'CAR-047', 'tipo': 'TRASLADO_COCINA', 'und': 90, 'kg': 0, 'obs': 'Entrega a cocina 90 unds Huevos'},
    {'fecha': '2026-10-03', 'hora': '09:40:00', 'code': 'CAR-003', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 8.0, 'obs': 'Entrega a cocina 8.0 Kg Costilla ahumada'},
    {'fecha': '2026-10-03', 'hora': '09:45:00', 'code': 'CAR-006', 'tipo': 'TRASLADO_COCINA', 'und': 20, 'kg': 0, 'obs': 'Entrega a cocina 20 porciones Costilla San Luis'},
    {'fecha': '2026-10-03', 'hora': '09:50:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 60, 'kg': 0, 'obs': 'Entrega a cocina 60 porciones Tocino'},
    {'fecha': '2026-10-03', 'hora': '09:55:00', 'code': 'RES-072', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Carne asada'},
    {'fecha': '2026-10-03', 'hora': '10:00:00', 'code': 'CAR-041', 'tipo': 'TRASLADO_COCINA', 'und': 30, 'kg': 0, 'obs': 'Entrega a cocina 30 porciones Filete de pollo'},
    {'fecha': '2026-10-03', 'hora': '10:05:00', 'code': 'CAR-010', 'tipo': 'TRASLADO_COCINA', 'und': 40, 'kg': 0, 'obs': 'Entrega a cocina 40 porciones Lomo de cerdo'},
    {'fecha': '2026-10-03', 'hora': '10:10:00', 'code': 'CAR-033', 'tipo': 'TRASLADO_COCINA', 'und': 5, 'kg': 0, 'obs': 'Entrega a cocina 5 porciones Punta de anca'},
    {'fecha': '2026-10-03', 'hora': '10:15:00', 'code': 'CAR-026', 'tipo': 'TRASLADO_COCINA', 'und': 5, 'kg': 0, 'obs': 'Entrega a cocina 5 porciones Churrasco'},
    {'fecha': '2026-10-03', 'hora': '10:20:00', 'code': 'RES-071', 'tipo': 'TRASLADO_COCINA', 'und': 6, 'kg': 0, 'obs': 'Entrega a cocina 6 porciones Baby beef'},
    {'fecha': '2026-10-03', 'hora': '10:25:00', 'code': 'VER-074', 'tipo': 'TRASLADO_COCINA', 'und': 5, 'kg': 0, 'obs': 'Entrega a cocina 5 paq Papas a la francesa'},
    {'fecha': '2026-10-03', 'hora': '10:30:00', 'code': 'EMB-050', 'tipo': 'TRASLADO_COCINA', 'und': 40, 'kg': 0, 'obs': 'Entrega a cocina 40 unds Chorizo paisa'},
    {'fecha': '2026-10-03', 'hora': '10:35:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 24.9, 'obs': 'Entrega a cocina 24.9 Kg Tocino para corte'},
    {'fecha': '2026-10-03', 'hora': '10:40:00', 'code': 'CAR-035', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 4.7, 'obs': 'Entrega a cocina 4.7 Kg Sobrebarriga para corte'},
    {'fecha': '2026-10-03', 'hora': '10:45:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 7.1, 'obs': 'Entrega a cocina 7.1 Kg Lengua para corte'},
    {'fecha': '2026-10-03', 'hora': '10:50:00', 'code': 'RES-071', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 3.1, 'obs': 'Entrega a cocina 3.1 Kg Baby beef para corte'},
    # Devoluciones porcionados hoja 3b
    {'fecha': '2026-10-03', 'hora': '15:00:00', 'code': 'RES-072', 'tipo': 'DEVOLUCION_COCINA', 'und': 40, 'kg': 0, 'obs': 'Devolución cocina 40 porciones Carne asada porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:05:00', 'code': 'CAR-010', 'tipo': 'DEVOLUCION_COCINA', 'und': 58, 'kg': 0, 'obs': 'Devolución cocina 58 porciones Lomo de cerdo porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:10:00', 'code': 'CER-075', 'tipo': 'DEVOLUCION_COCINA', 'und': 63, 'kg': 0, 'obs': 'Devolución cocina 63 porciones Tocino porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:15:00', 'code': 'CAR-041', 'tipo': 'DEVOLUCION_COCINA', 'und': 40, 'kg': 0, 'obs': 'Devolución cocina 40 porciones Filete de pollo porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:20:00', 'code': 'PES-066', 'tipo': 'DEVOLUCION_COCINA', 'und': 22, 'kg': 0, 'obs': 'Devolución cocina 22 porciones Salmón porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:25:00', 'code': 'PES-069', 'tipo': 'DEVOLUCION_COCINA', 'und': 15, 'kg': 0, 'obs': 'Devolución cocina 15 porciones Trucha porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:30:00', 'code': 'PES-067', 'tipo': 'DEVOLUCION_COCINA', 'und': 30, 'kg': 0, 'obs': 'Devolución cocina 30 porciones Tilapia porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:35:00', 'code': 'CAR-035', 'tipo': 'DEVOLUCION_COCINA', 'und': 16, 'kg': 0, 'obs': 'Devolución cocina 16 porciones Sobrebarriga porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:40:00', 'code': 'CAR-029', 'tipo': 'DEVOLUCION_COCINA', 'und': 29, 'kg': 0, 'obs': 'Devolución cocina 29 porciones Lengua porcionadas'},
    {'fecha': '2026-10-03', 'hora': '15:45:00', 'code': 'RES-071', 'tipo': 'DEVOLUCION_COCINA', 'und': 9, 'kg': 0, 'obs': 'Devolución cocina 9 porciones Baby beef porcionadas'},

    # ==========================================
    # DÍA 4: 4 DE OCTUBRE DE 2026 (4a.jpeg y 4b.jpeg)
    # ==========================================
    {'fecha': '2026-10-04', 'hora': '09:00:00', 'code': 'CAR-042', 'tipo': 'TRASLADO_COCINA', 'und': 42, 'kg': 0, 'obs': 'Entrega a cocina 42 porciones Gallina'},
    {'fecha': '2026-10-04', 'hora': '09:05:00', 'code': 'CAR-005', 'tipo': 'TRASLADO_COCINA', 'und': 40, 'kg': 0, 'obs': 'Entrega a cocina 40 porciones Costilla tamalera (Tamal)'},
    {'fecha': '2026-10-04', 'hora': '09:10:00', 'code': 'CAR-035', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Sobrebarriga'},
    {'fecha': '2026-10-04', 'hora': '09:15:00', 'code': 'CAR-029', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Lengua de res'},
    {'fecha': '2026-10-04', 'hora': '09:20:00', 'code': 'EMB-050', 'tipo': 'TRASLADO_COCINA', 'und': 80, 'kg': 0, 'obs': 'Entrega a cocina 80 unds Chorizo paisa'},
    {'fecha': '2026-10-04', 'hora': '09:25:00', 'code': 'EMB-054', 'tipo': 'TRASLADO_COCINA', 'und': 12, 'kg': 0, 'obs': 'Entrega a cocina 12 unds Chorizo grande'},
    {'fecha': '2026-10-04', 'hora': '09:30:00', 'code': 'CAR-047', 'tipo': 'TRASLADO_COCINA', 'und': 120, 'kg': 0, 'obs': 'Entrega a cocina 120 unds Huevos'},
    {'fecha': '2026-10-04', 'hora': '09:35:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 19.4, 'obs': 'Entrega a cocina 19.4 Kg Tocino Jr entero'},
    {'fecha': '2026-10-04', 'hora': '09:40:00', 'code': 'CER-075', 'tipo': 'TRASLADO_COCINA', 'und': 83, 'kg': 0, 'obs': 'Entrega a cocina 83 porciones Tocino'},
    {'fecha': '2026-10-04', 'hora': '09:45:00', 'code': 'CAR-033', 'tipo': 'TRASLADO_COCINA', 'und': 20, 'kg': 0, 'obs': 'Entrega a cocina 20 porciones Punta de anca'},
    {'fecha': '2026-10-04', 'hora': '09:50:00', 'code': 'CAR-026', 'tipo': 'TRASLADO_COCINA', 'und': 20, 'kg': 0, 'obs': 'Entrega a cocina 20 porciones Churrasco'},
    {'fecha': '2026-10-04', 'hora': '09:55:00', 'code': 'RES-071', 'tipo': 'TRASLADO_COCINA', 'und': 9, 'kg': 0, 'obs': 'Entrega a cocina 9 porciones Baby beef'},
    {'fecha': '2026-10-04', 'hora': '10:00:00', 'code': 'PES-062', 'tipo': 'TRASLADO_COCINA', 'und': 0, 'kg': 16.2, 'obs': 'Entrega a cocina 16.2 Kg Camarón precocido'},
    {'fecha': '2026-10-04', 'hora': '10:05:00', 'code': 'CAR-010', 'tipo': 'TRASLADO_COCINA', 'und': 39, 'kg': 0, 'obs': 'Entrega a cocina 39 porciones Lomo de cerdo'},
    {'fecha': '2026-10-04', 'hora': '10:10:00', 'code': 'CAR-041', 'tipo': 'TRASLADO_COCINA', 'und': 30, 'kg': 0, 'obs': 'Entrega a cocina 30 porciones Filete de pollo'},
    {'fecha': '2026-10-04', 'hora': '10:15:00', 'code': 'PES-066', 'tipo': 'TRASLADO_COCINA', 'und': 15, 'kg': 0, 'obs': 'Entrega a cocina 15 porciones Salmón'},
    {'fecha': '2026-10-04', 'hora': '10:20:00', 'code': 'PES-069', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Trucha'},
    {'fecha': '2026-10-04', 'hora': '10:25:00', 'code': 'VER-074', 'tipo': 'TRASLADO_COCINA', 'und': 8, 'kg': 0, 'obs': 'Entrega a cocina 8 paq Papas a la francesa'},
    {'fecha': '2026-10-04', 'hora': '10:30:00', 'code': 'PES-067', 'tipo': 'TRASLADO_COCINA', 'und': 20, 'kg': 0, 'obs': 'Entrega a cocina 20 porciones Tilapia'},
    {'fecha': '2026-10-04', 'hora': '10:35:00', 'code': 'CAR-006', 'tipo': 'TRASLADO_COCINA', 'und': 30, 'kg': 0, 'obs': 'Entrega a cocina 30 porciones (20+10) Costilla San Luis'},
    {'fecha': '2026-10-04', 'hora': '10:40:00', 'code': 'VER-084', 'tipo': 'TRASLADO_COCINA', 'und': 1, 'kg': 0, 'obs': 'Entrega a cocina 1 lb Mix de verduras'},
    {'fecha': '2026-10-04', 'hora': '10:45:00', 'code': 'RES-072', 'tipo': 'TRASLADO_COCINA', 'und': 10, 'kg': 0, 'obs': 'Entrega a cocina 10 porciones Carne asada'},
    # Devoluciones día 4
    {'fecha': '2026-10-04', 'hora': '15:00:00', 'code': 'CER-075', 'tipo': 'DEVOLUCION_COCINA', 'und': 0, 'kg': 19.4, 'obs': 'Devolución cocina 19.4 Kg Tocino Jr entero reintegrado'},
    {'fecha': '2026-10-04', 'hora': '15:05:00', 'code': 'CER-075', 'tipo': 'DEVOLUCION_COCINA', 'und': 52, 'kg': 20.8, 'obs': 'Devolución cocina 52 porciones (20.8 Kg) Tocino porcionadas'}
]

print(f"Total registros a preparar: {len(raw_records)}")

payload_list = []
for r in raw_records:
    cat_ins = cat_by_code[r['code']]
    cid = cat_ins['id']
    tipo = r['tipo']
    costo_u = float(cat_ins['costo_unitario_kg'] or 0)
    peso_std = float(cat_ins['peso_estandar_porcion_kg'] or 0.35)
    tipo_med = cat_ins.get('tipo_medida', 'KGS_Y_UNIDADES')

    cant_sin_porc = float(r['kg'])
    porc_und = int(r['und'])
    
    # Calcular peso de porciones si vienen porciones y no viene kg
    if porc_und > 0 and cant_sin_porc == 0:
        if tipo_med in ['UNIDADES', 'PAQUETES']:
            peso_porc = 0.0
        else:
            peso_porc = round(porc_und * peso_std, 3)
    elif r.get('kg') and porc_und > 0:
        peso_porc = float(r['kg'])
        cant_sin_porc = 0.0
    else:
        peso_porc = 0.0

    # Valor total
    if tipo_med in ['UNIDADES', 'PAQUETES']:
        val_total = round(porc_und * costo_u)
    else:
        val_total = round((cant_sin_porc + peso_porc) * costo_u)

    # Origen / Destino
    if tipo == 'ENTRADA_COMPRA':
        origen = 'PROVEEDOR'
        destino = 'BODEGA_PORCIONADO' if tipo_med in ['UNIDADES', 'PAQUETES'] else 'BODEGA_ENTERO'
    elif tipo == 'TRASLADO_COCINA':
        if cant_sin_porc > 0:
            origen = 'BODEGA_ENTERO'
            destino = 'COCINA_ENTERO'
        else:
            origen = 'BODEGA_PORCIONADO'
            destino = 'COCINA_PORCIONADO'
    elif tipo == 'DEVOLUCION_COCINA':
        if cant_sin_porc > 0:
            origen = 'COCINA_ENTERO'
            destino = 'BODEGA_ENTERO'
        else:
            origen = 'COCINA_PORCIONADO'
            destino = 'BODEGA_PORCIONADO'
    else:
        origen = 'BODEGA_ENTERO'
        destino = 'BODEGA_PORCIONADO'

    obs_final = f"[PENDIENTE_APROBAR] {r['obs']}"

    payload_list.append({
        'fecha': r['fecha'],
        'fecha_hora': f"{r['fecha']}T{r['hora']}.000Z",
        'tipo_movimiento': tipo,
        'insumo_id': cid,
        'origen': origen,
        'destino': destino,
        'cant_sin_porcionar_kg': cant_sin_porc,
        'porciones_und': porc_und,
        'peso_porciones_kg': peso_porc,
        'merma_kg': 0.0,
        'costo_unitario_kg': costo_u,
        'valor_total_movimiento': val_total,
        'observaciones': obs_final,
        'usuario': 'Bodeguero (Pendiente)'
    })

print(f"Insertando {len(payload_list)} transacciones en movimientos_inventario...")
# Insertar por lotes de 25
chunk_size = 25
total_inserted = 0
for i in range(0, len(payload_list), chunk_size):
    chunk = payload_list[i:i + chunk_size]
    res = api_post("movimientos_inventario", chunk)
    total_inserted += len(res)
    print(f"  Insertado lote {i//chunk_size + 1}: {len(res)} registros.")

print(f"\n[OK] Insertadas exitosamente {total_inserted} transacciones en estado [PENDIENTE_APROBAR].")

# Verificación de conteo por fecha
print("\n--- RESUMEN DE MOVIMIENTOS PENDIENTES POR FECHA ---")
for d in ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']:
    movs_day = api_get(f"movimientos_inventario?fecha=eq.{d}&observaciones=ilike.*[PENDIENTE_APROBAR]*&select=id,tipo_movimiento,porciones_und,cant_sin_porcionar_kg,valor_total_movimiento")
    compras = len([m for m in movs_day if m['tipo_movimiento'] == 'ENTRADA_COMPRA'])
    traslados = len([m for m in movs_day if m['tipo_movimiento'] == 'TRASLADO_COCINA'])
    devoluciones = len([m for m in movs_day if m['tipo_movimiento'] == 'DEVOLUCION_COCINA'])
    total_val = sum(float(m.get('valor_total_movimiento') or 0) for m in movs_day)
    print(f"Fecha {d}: Total {len(movs_day)} movs | Compras: {compras} | Traslados: {traslados} | Devoluciones: {devoluciones} | Valor Total: ${total_val:,.2f}")

print("\n" + "=" * 80)
print("¡TODOS LOS MOVIMIENTOS CARGADOS EN ESTADO PENDIENTE DE APROBACIÓN!")
print("=" * 80)
