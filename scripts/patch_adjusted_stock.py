import urllib.request
import json

API_KEY = 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO'
HEADERS = {
    'apikey': API_KEY,
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Obtener catálogo para mapear nombres
req_cat = urllib.request.Request('https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/catalogo_insumos?select=id,nombre', headers=HEADERS)
with urllib.request.urlopen(req_cat) as resp:
    cats = json.loads(resp.read().decode('utf-8'))

nom_to_id = {c['nombre'].lower().strip(): c['id'] for c in cats}

adjustments = [
    ('tocineta barril', {'bodega_sin_porcionar_kg': 89.00, 'bodega_porcionado_und': 0, 'bodega_porcionado_kg': 0}),
    ('panceta de cerdo', {'bodega_sin_porcionar_kg': 32.00, 'bodega_porcionado_und': 0, 'bodega_porcionado_kg': 0}),
    ('sobaco', {'bodega_sin_porcionar_kg': 24.00, 'bodega_porcionado_und': 0, 'bodega_porcionado_kg': 0}),
    ('sobrebarriga delgada', {'bodega_sin_porcionar_kg': 19.50, 'bodega_porcionado_und': 0, 'bodega_porcionado_kg': 0})
]

for nom, payload in adjustments:
    iid = nom_to_id.get(nom)
    if iid:
        url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/stock_actual?insumo_id=eq.{iid}"
        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, headers=HEADERS, method='PATCH', data=body)
        with urllib.request.urlopen(req) as resp:
            print(f"Patched {nom}: {payload}")
    else:
        print(f"Insumo no encontrado: {nom}")

print("Ajustes sincronizados en stock_actual exitosamente.")
