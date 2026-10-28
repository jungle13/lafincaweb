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

print("=== INICIANDO REGISTRO Y APROBACIÓN DE CONTEO FÍSICO (24-SEP-2026) ===")

with open('scratch/verified_conteo_24.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

print(f"Items a registrar: {len(items)}")

# 1. Limpiar cualquier conteo previo de septiembre para evitar duplicidad
try:
    existing = api_get("conteos_fisicos?fecha=eq.2026-09-24")
    for s in existing:
        api_delete(f"conteos_fisicos_detalle?conteo_id=eq.{s['id']}")
        api_delete(f"conteos_fisicos?id=eq.{s['id']}")
    print(f"Limpiados {len(existing)} conteos previos del 24-Sep.")
except Exception as e:
    print(f"Aviso limpieza: {e}")

# 2. Crear sesión de Conteo Físico APROBADO / APLICADO al 24 de Septiembre
conteo_id = str(uuid.uuid4())
fecha_conteo = '2026-09-24'
created_at_time = '2026-09-24T17:45:00.000Z' # 05:45 p. m. como indica el documento oficial

sesion_payload = {
    'id': conteo_id,
    'fecha': fecha_conteo,
    'usuario': 'Auditor / Administración',
    'estado': 'APLICADO',
    'created_at': created_at_time,
    'updated_at': created_at_time
}

nueva_sesion = api_post('conteos_fisicos', [sesion_payload])
print(f"[OK] Sesión de conteo creada con ID: {conteo_id} (Estado: APLICADO)")

# 3. Insertar los 26 detalles en conteos_fisicos_detalle
detalles_payload = []
snapshot_conteo = {}

for it in items:
    cid = it['insumo_id']
    det_id = str(uuid.uuid4())
    detalles_payload.append({
        'id': det_id,
        'conteo_id': conteo_id,
        'insumo_id': cid,
        'ubicacion': 'BODEGA',
        'cant_sin_porcionar_kg': it['cant_sin_porcionar_kg'],
        'porciones_und': it['porciones_und'],
        'peso_porciones_kg': it['peso_porciones_kg'],
        'costo_unitario_kg': it['costo_unitario_kg'],
        'valor_total': it['valor_total'],
        'created_at': created_at_time
    })
    
    snapshot_conteo[cid] = {
        'bodega_kg': it['cant_sin_porcionar_kg'],
        'bodega_und': it['porciones_und'],
        'bodega_porc_kg': it['peso_porciones_kg'],
        'cocina_und': 0,
        'cocina_porc_kg': 0.0,
        'costo_unitario_kg': it['costo_unitario_kg'],
        'valor_total': it['valor_total']
    }

api_post('conteos_fisicos_detalle', detalles_payload)
print(f"[OK] {len(detalles_payload)} líneas de detalle insertadas en conteos_fisicos_detalle.")

# 4. Actualizar stock_actual para fijar las existencias físicas en bodega aprobadas
stock_actual_all = api_get('stock_actual?select=*')
print(f"Actualizando {len(stock_actual_all)} registros en stock_actual...")

insumos_contados_set = {it['insumo_id']: it for it in items}

for st in stock_actual_all:
    cid = st['insumo_id']
    st_id = st['id']
    cocina_sin_kg = float(st.get('cocina_sin_porcionar_kg') or 0)
    cocina_und = int(st.get('cocina_porcionado_und') or 0)
    cocina_porc_kg = float(st.get('cocina_porcionado_kg') or 0)
    tot_c_kg = cocina_sin_kg + cocina_porc_kg
    
    if cid in insumos_contados_set:
        it = insumos_contados_set[cid]
        b_sin_kg = float(it['cant_sin_porcionar_kg'])
        b_und = int(it['porciones_und'])
        b_porc_kg = float(it['peso_porciones_kg'])
        tot_b_kg = b_sin_kg + b_porc_kg
    else:
        # No está en el inventario físico de carnes -> 0 en bodega
        b_sin_kg = 0.0
        b_und = 0
        b_porc_kg = 0.0
        tot_b_kg = 0.0
        
    tot_gen_kg = round(tot_b_kg + tot_c_kg, 2)
    
    update_data = {
        'bodega_sin_porcionar_kg': round(b_sin_kg, 2),
        'bodega_porcionado_und': b_und,
        'bodega_porcionado_kg': round(b_porc_kg, 2),
        'peso_total_bodega_kg': round(tot_b_kg, 2),
        'peso_total_general_kg': tot_gen_kg,
        'updated_at': created_at_time
    }
    api_patch(f"stock_actual?id=eq.{st_id}", update_data)

print("[OK] stock_actual sincronizado exactamente con el inventario físico.")

# 5. Actualizar periodo 2026-09 con conteo_cierre_fisico
try:
    api_patch("periodos?codigo=eq.2026-09", {
        'conteo_cierre_fisico': snapshot_conteo,
        'updated_at': created_at_time
    })
    print("[OK] Snapshot de conteo físico guardado en periodos (2026-09).")
except Exception as e:
    print(f"Nota en periodos: {e}")

print("\n=== CONTEO FÍSICO DEL 24 DE SEPTIEMBRE APROBADO EXITOSAMENTE ===")
