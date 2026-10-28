import os
import json
import urllib.request
import uuid
from datetime import datetime

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

def api_patch(endpoint, data):
    url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/{endpoint}"
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, headers=HEADERS, method='PATCH', data=body)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def api_delete(endpoint):
    url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/{endpoint}"
    req = urllib.request.Request(url, headers=HEADERS, method='DELETE')
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8')

print("=" * 80)
print("PROCESO DE CIERRE DE SEPTIEMBRE 2026 Y APERTURA DE OCTUBRE 2026 (CARNES)")
print("Basado en: INFORME_INVENTARIO_CIERRE_CON_BEBIDAS_SEPTIEMBRE_2026.pdf")
print("=" * 80)

# 1. Obtener catálogo completo
catalogo = api_get("catalogo_insumos?select=*&order=nombre")
cat_by_code = {c['codigo'].strip(): c for c in catalogo if c.get('codigo')}
cat_by_id = {c['id']: c for c in catalogo}

# Definición de los 28 ítems auditados en el informe físico de cierre
# (idx, nombre_informe, codigo, sin_porc_kg, porc_und, peso_porc_kg, tot_kg, costo_u, valor_total, obs)
items_informe = [
    (1, "Filete de Pollo", "CAR-041", 0.0, 84, 28.56, 28.56, 18500.0, 528360.0, "84 und (28.56 kg)"),
    (2, "Chorizo Paisa Tradicional", "EMB-050", 0.0, 120, 12.00, 12.00, 3200.0, 384000.0, "120 und (12.00 kg)"),
    (3, "Chorizo Grande de Cerdo", "EMB-054", 0.0, 0, 0.0, 0.0, 4500.0, 0.0, "0 und (0.00 kg)"),
    (4, "Costilla Ahumada", "CAR-003", 36.0, 0, 0.0, 36.0, 24500.0, 882000.0, "36.00 kg entero"),
    (5, "Carne Asada de Res", "RES-072", 0.0, 10, 1.0, 1.0, 26900.0, 26900.0, "10 und (1.00 kg)"),
    (6, "Tocino Junior", "CER-075", 6.0, 0, 0.0, 6.0, 21900.0, 131400.0, "6.00 kg entero"),
    (7, "Tocino Barril", "CER-075", 0.0, 46, 17.17, 17.17, 21900.0, 376023.0, "46 und (17.17 kg)"),
    (8, "Papa Francesa Precocida", "VER-074", 0.0, 1, 2.5, 2.5, 17500.0, 17500.0, "1 paq (2.50 kg)"),
    (9, "Punta de Anca", "CAR-033", 0.0, 18, 7.425, 7.43, 44000.0, 326700.0, "18 und (7.43 kg)"),
    (10, "Baby Beef", "RES-071", 0.0, 3, 1.2, 1.2, 53000.0, 63600.0, "3 und (1.20 kg)"),
    (11, "Lomo de Cerdo", "CAR-010", 0.0, 63, 21.68, 21.68, 19000.0, 411920.0, "63 und (21.68 kg)"),
    (12, "Costilla San Luis", "CAR-006", 4.0, 0, 0.0, 4.0, 22900.0, 91600.0, "4.00 kg entero"),
    (13, "Bagre de Mar", "PES-061", 20.0, 0, 0.0, 20.0, 16500.0, 330000.0, "20.00 kg entero"),
    (14, "Gallina Criolla", "CAR-042", 65.4, 32, 7.5, 72.9, 11360.0823, 828150.0, "65.40 kg can + 32 presas (7.50 kg)"),
    (15, "Hígado de Res", "CAR-028", 0.0, 51, 5.1, 5.1, 21500.0, 109650.0, "51 und (5.10 kg)"),
    (16, "Alguacil de Res", "PES-065", 0.0, 40, 20.0, 20.0, 28500.0, 570000.0, "40 und (20.00 kg)"),
    (17, "Churrasco de Res", "CAR-026", 0.0, 20, 8.1, 8.1, 38000.0, 307800.0, "20 und (8.10 kg)"),
    (18, "Lomo Viche Entero de Res", "CAR-030", 2.5, 0, 0.0, 2.5, 53000.0, 132500.0, "2.50 kg entero"),
    (19, "Sobaco de Res", "CAR-034", 21.0, 0, 0.0, 21.0, 25900.0, 543900.0, "21.00 kg entero"),
    (20, "Callo de Res (Mondongo)", "CAR-021", 4.4, 0, 0.0, 4.4, 19000.0, 83600.0, "4.40 kg entero"),
    (21, "Panceta de Cerdo", "CAR-011", 4.5, 0, 0.0, 4.5, 24000.0, 108000.0, "4.50 kg entero"),
    (22, "Pezuña de Cerdo", "CAR-013", 0.0, 0, 0.0, 0.0, 9699.0, 0.0, "0.00 kg"),
    (23, "Sobrebarriga (Cocida y Esp.)", "CAR-035", 7.3, 7, 2.1, 9.4, 34500.0, 324300.0, "7.30 kg cocida + 7 und (2.10 kg)"),
    (24, "Tilapia Roja", "PES-067", 0.0, 23, 11.18, 11.18, 18000.0, 201240.0, "23 und (11.18 kg)"),
    (25, "Salmón Premium", "PES-066", 0.0, 10, 3.6, 3.6, 55000.0, 198000.0, "10 und (3.60 kg)"),
    (26, "Trucha Arcoíris", "PES-069", 0.0, 14, 5.35, 5.35, 23000.0, 123050.0, "14 und (5.35 kg)"),
    (27, "Mix de Verduras Precocido", "VER-084", 0.0, 5, 2.5, 2.5, 5200.0, 26000.0, "5 paq (2.50 kg)"),
    (28, "Leche de Coco Natural", "INS-085", 0.0, 4, 4.0, 4.0, 21000.0, 84000.0, "4 Litros")
]

# Verificación de valor total
total_val_check = sum(r[8] for r in items_informe)
print(f"Total ítems informe: {len(items_informe)} | Valor consolidado: ${total_val_check:,.2f}")
assert abs(total_val_check - 7210193.0) < 1.0, f"Error en suma: {total_val_check}"

# Consolidado por insumo (para stock_actual e inventario_inicial)
# Note: Tocino tiene dos renglones (Junior y Barril) que se suman en CER-075
insumo_consolidado = {}
for item in items_informe:
    idx, nombre, codigo, sin_kg, porc_und, peso_porc_kg, tot_kg, costo_u, valor_total, obs = item
    cat_ins = cat_by_code[codigo]
    cid = cat_ins['id']
    if cid not in insumo_consolidado:
        insumo_consolidado[cid] = {
            'insumo_id': cid,
            'codigo': codigo,
            'nombre': cat_ins['nombre'],
            'categoria': cat_ins['categoria'],
            'tipo_medida': cat_ins['tipo_medida'],
            'costo_unitario_kg': float(cat_ins['costo_unitario_kg'] or costo_u),
            'sin_porcionar_kg': 0.0,
            'porciones_und': 0,
            'peso_porciones_kg': 0.0,
            'valor_total': 0.0,
            'observaciones': []
        }
    insumo_consolidado[cid]['sin_porcionar_kg'] += sin_kg
    insumo_consolidado[cid]['porciones_und'] += porc_und
    insumo_consolidado[cid]['peso_porciones_kg'] += peso_porc_kg
    insumo_consolidado[cid]['valor_total'] += valor_total
    insumo_consolidado[cid]['observaciones'].append(f"{nombre}: {obs}")

print(f"Insumos únicos consolidados: {len(insumo_consolidado)}")

# 2. Registrar sesión oficial de conteo físico del 30 de Septiembre
print("\n[Paso 1] Registrando conteo físico oficial de cierre al 30 de Septiembre...")
existing_conteos = api_get("conteos_fisicos?fecha=eq.2026-09-30")
for ec in existing_conteos:
    print(f"  Limpiando conteo existente ID {ec['id']}...")
    api_delete(f"conteos_fisicos_detalle?conteo_id=eq.{ec['id']}")
    api_delete(f"conteos_fisicos?id=eq.{ec['id']}")

conteo_30_id = str(uuid.uuid4())
fecha_cierre_str = '2026-09-30'
timestamp_cierre = '2026-09-30T23:59:59.000Z'

nueva_sesion = api_post('conteos_fisicos', [{
    'id': conteo_30_id,
    'fecha': fecha_cierre_str,
    'usuario': 'Auditor / Bodega (Cierre 30-Sep)',
    'estado': 'APLICADO',
    'created_at': timestamp_cierre,
    'updated_at': timestamp_cierre
}])[0]
print(f"  -> Conteo físico creado y APROBADO (APLICADO) con ID: {conteo_30_id}")

# Insertar los 28 renglones en conteos_fisicos_detalle
detalles_payload = []
for item in items_informe:
    idx, nombre, codigo, sin_kg, porc_und, peso_porc_kg, tot_kg, costo_u, valor_total, obs = item
    cat_ins = cat_by_code[codigo]
    det_id = str(uuid.uuid4())
    detalles_payload.append({
        'id': det_id,
        'conteo_id': conteo_30_id,
        'insumo_id': cat_ins['id'],
        'ubicacion': 'BODEGA',
        'cant_sin_porcionar_kg': round(sin_kg, 2),
        'porciones_und': porc_und,
        'peso_porciones_kg': round(peso_porc_kg, 3),
        'costo_unitario_kg': round(costo_u, 2),
        'valor_total': round(valor_total, 2),
        'created_at': timestamp_cierre
    })

api_post('conteos_fisicos_detalle', detalles_payload)
print(f"  -> Insertados {len(detalles_payload)} renglones en conteos_fisicos_detalle.")

# 3. Actualizar stock_actual en base de datos
print("\n[Paso 2] Sincronizando stock_actual con el conteo físico aprobado...")
stock_rows = api_get("stock_actual?select=*")
for st in stock_rows:
    cid = st['insumo_id']
    st_id = st['id']
    if cid in insumo_consolidado:
        data = insumo_consolidado[cid]
        b_sin = round(data['sin_porcionar_kg'], 2)
        b_und = data['porciones_und']
        b_pkg = round(data['peso_porciones_kg'], 3)
        b_tot = round(b_sin + b_pkg, 3)
    else:
        # Si es una carne no contada, queda en 0 en bodega al cierre
        cat_item = cat_by_id.get(cid, {})
        if cat_item.get('es_carne', False):
            b_sin = 0.0
            b_und = 0
            b_pkg = 0.0
            b_tot = 0.0
        else:
            # Mantener no cárnicos
            b_sin = float(st.get('bodega_sin_porcionar_kg') or 0)
            b_und = int(st.get('bodega_porcionado_und') or 0)
            b_pkg = float(st.get('bodega_porcionado_kg') or 0)
            b_tot = round(b_sin + b_pkg, 3)

    # En cierre mensual, cocina se cierra o reintegra a bodega
    c_sin = 0.0
    c_und = 0
    c_pkg = 0.0

    update_payload = {
        'bodega_sin_porcionar_kg': b_sin,
        'bodega_porcionado_und': b_und,
        'bodega_porcionado_kg': b_pkg,
        'cocina_sin_porcionar_kg': c_sin,
        'cocina_porcionado_und': c_und,
        'cocina_porcionado_kg': c_pkg,
        'updated_at': timestamp_cierre
    }
    api_patch(f"stock_actual?id=eq.{st_id}", update_payload)

print("  -> stock_actual actualizado exitosamente.")

# 4. Construir snapshots para periodos
# Conteo cierre físico snapshot
conteo_cierre_snapshot = {}
for cid, d in insumo_consolidado.items():
    conteo_cierre_snapshot[cid] = {
        'bodega_kg': round(d['sin_porcionar_kg'], 2),
        'bodega_und': d['porciones_und'],
        'bodega_porc_kg': round(d['peso_porciones_kg'], 3),
        'cocina_und': 0,
        'cocina_porc_kg': 0.0,
        'costo_unitario_kg': d['costo_unitario_kg'],
        'valor_total': d['valor_total']
    }

# Inventario inicial para Octubre 2026
inventario_inicial_octubre = {}
for c in catalogo:
    cid = c['id']
    if cid in insumo_consolidado:
        d = insumo_consolidado[cid]
        inventario_inicial_octubre[cid] = {
            'insumo_id': cid,
            'nombre': c['nombre'],
            'categoria': c['categoria'],
            'bodega_sin_porc_kg': round(d['sin_porcionar_kg'], 2),
            'bodega_porc_und': d['porciones_und'],
            'bodega_porc_kg': round(d['peso_porciones_kg'], 3),
            'cocina_sin_porc_kg': 0.0,
            'cocina_porc_und': 0,
            'cocina_porc_kg': 0.0,
            'costo_unitario_kg': float(c['costo_unitario_kg'] or 0)
        }
    else:
        inventario_inicial_octubre[cid] = {
            'insumo_id': cid,
            'nombre': c['nombre'],
            'categoria': c['categoria'],
            'bodega_sin_porc_kg': 0.0,
            'bodega_porc_und': 0,
            'bodega_porc_kg': 0.0,
            'cocina_sin_porc_kg': 0.0,
            'cocina_porc_und': 0,
            'cocina_porc_kg': 0.0,
            'costo_unitario_kg': float(c['costo_unitario_kg'] or 0)
        }

# 5. Cerrar Septiembre 2026 en Supabase
print("\n[Paso 3] Cerrando formalmente Septiembre 2026 en Supabase...")
sept_close_payload = {
    'estado': 'CERRADO',
    'conteo_cierre_fisico': conteo_cierre_snapshot,
    'fecha_cierre': timestamp_cierre,
    'usuario_cierre': 'Auditor / Gerencia',
    'observaciones_cierre': 'Cierre auditado con base en INFORME_INVENTARIO_CIERRE_CON_BEBIDAS_SEPTIEMBRE_2026 (Valor Carnes: $7.210.193)',
    'updated_at': timestamp_cierre
}
api_patch("periodos?codigo=eq.2026-09", sept_close_payload)
print("  -> Periodo 2026-09 marcado como CERRADO.")

# 6. Aperturar Octubre 2026 en Supabase
print("\n[Paso 4] Aperturando Octubre 2026 en Supabase...")
oct_open_payload = {
    'id': 'per-2026-10',
    'codigo': '2026-10',
    'nombre': 'Octubre 2026',
    'fecha_inicio': '2026-10-01',
    'fecha_fin': '2026-10-31',
    'estado': 'ABIERTO',
    'inicial_registrado': True,
    'inventario_inicial': inventario_inicial_octubre,
    'conteo_cierre_fisico': {},
    'ajustes_aprobados': {},
    'updated_at': '2026-10-01T00:00:00.000Z'
}

# Verificar si ya existe Octubre
existing_oct = api_get("periodos?codigo=eq.2026-10")
if existing_oct:
    api_patch("periodos?codigo=eq.2026-10", oct_open_payload)
    print("  -> Periodo 2026-10 actualizado como ABIERTO con inventario inicial.")
else:
    api_post("periodos", [oct_open_payload])
    print("  -> Periodo 2026-10 creado y aperturado como ABIERTO con inventario inicial.")

# Registrar movimientos de INVENTARIO_INICIAL para Octubre 01
print("\n[Paso 5] Registrando transacciones de INVENTARIO_INICIAL al 01-Oct-2026...")
api_delete("movimientos_inventario?fecha=eq.2026-10-01&tipo_movimiento=eq.INVENTARIO_INICIAL")

movs_inicial_octubre = []
for cid, d in insumo_consolidado.items():
    if d['sin_porcionar_kg'] > 0 or d['porciones_und'] > 0:
        c_item = cat_by_id[cid]
        movs_inicial_octubre.append({
            'fecha': '2026-10-01',
            'fecha_hora': '2026-10-01T06:00:00.000Z',
            'tipo_movimiento': 'INVENTARIO_INICIAL',
            'insumo_id': cid,
            'origen': 'SALDO_ANTERIOR',
            'destino': 'BODEGA_Y_COCINA',
            'cant_sin_porcionar_kg': round(d['sin_porcionar_kg'], 2),
            'porciones_und': d['porciones_und'],
            'peso_porciones_kg': round(d['peso_porciones_kg'], 3),
            'costo_unitario_kg': d['costo_unitario_kg'],
            'valor_total_movimiento': round(d['valor_total']),
            'observaciones': 'Inventario Inicial Apertura Octubre 2026 (Cierre Físico 30-Sep)',
            'usuario': 'Auditor / Gerencia'
        })

api_post("movimientos_inventario", movs_inicial_octubre)
print(f"  -> Insertados {len(movs_inicial_octubre)} movimientos de apertura en movimientos_inventario.")

# 7. Actualizar data/periodos.json local
print("\n[Paso 6] Actualizando archivo local data/periodos.json...")
json_path = os.path.join(os.getcwd(), 'data', 'periodos.json')
all_periods_db = api_get("periodos?select=*&order=codigo")
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(all_periods_db, f, indent=2, ensure_ascii=False)
print(f"  -> Guardado data/periodos.json con {len(all_periods_db)} periodos.")

print("\n" + "=" * 80)
print("¡CIERRE DE SEPTIEMBRE Y APERTURA DE OCTUBRE COMPLETADOS EXITOSAMENTE!")
print("=" * 80)
