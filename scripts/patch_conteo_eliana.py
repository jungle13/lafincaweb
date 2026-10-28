import urllib.request
import json

API_KEY = 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO'
HEADERS = {
    'apikey': API_KEY,
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

updates = [
    ('3af600eb-b670-416f-b210-cfd9aa80820c', {'cant_sin_porcionar_kg': 89.00, 'valor_total': 89.00 * 17000}), # Tocineta barril (89.60 -> 89.00)
    ('aa15e6a6-0c5d-4480-828b-8559e4e9af39', {'cant_sin_porcionar_kg': 24.00, 'valor_total': 24.00 * 25900}), # Sobaco (26.00 -> 24.00)
    ('1c823e89-e8cd-4b49-99f0-c41e352395ea', {'cant_sin_porcionar_kg': 19.50, 'valor_total': 19.50 * 30000})  # Sobrebarriga (18.00 -> 19.50)
]

for row_id, payload in updates:
    url = f"https://uexqmrspulhauubzrwyn.supabase.co/rest/v1/conteos_fisicos_detalle?id=eq.{row_id}"
    body = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, headers=HEADERS, method='PATCH', data=body)
    with urllib.request.urlopen(req) as resp:
        print(f"Patched {row_id}: {payload}")

print("Conteo físico en Supabase actualizado con los valores de Inventario Eliana!")
