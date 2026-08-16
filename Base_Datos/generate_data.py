import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import os

file_path = "SIMULACIÓN CONTEO BODEGA.xlsx"
out_path = "SIMULACIÓN CONTEO BODEGA.xlsx"

# Leer el excel original para extraer insumos y platos
try:
    xl = pd.ExcelFile(file_path)
    df_recetas = xl.parse("7. Recetas")
    df_bodega_orig = xl.parse("6. Conteo Bodega")
except Exception as e:
    print(f"Error al leer: {e}")
    exit(1)

# Extraer insumos únicos
insumos_list = df_recetas[['Insumo (Materia Prima)', 'Tipo de Carne', 'Costo del Insumo por Kg']].drop_duplicates().to_dict('records')
# Platos únicos
platos_list = df_recetas[['ID Plato', 'Plato a la Carta', 'Precio de Venta del Plato', 'Costo del Insumo por Kg']].drop_duplicates().to_dict('records')

# Si insumos_list está vacío por alguna razón, usamos unos por defecto
if not insumos_list:
    insumos_list = [
        {'Insumo (Materia Prima)': 'Gallina', 'Tipo de Carne': 'CARNE POLLO', 'Costo del Insumo por Kg': 8000},
        {'Insumo (Materia Prima)': 'Lomo viche', 'Tipo de Carne': 'CARNE DE RES', 'Costo del Insumo por Kg': 25000},
        {'Insumo (Materia Prima)': 'Panceta de cerdo', 'Tipo de Carne': 'CARNE DE CERDO', 'Costo del Insumo por Kg': 15000},
    ]

if not platos_list:
    platos_list = [
        {'ID Plato': 'PLT-001', 'Plato a la Carta': 'Plato A', 'Precio de Venta del Plato': 45000, 'Costo del Insumo por Kg': 15000},
    ]

start_date = datetime(2026, 7, 1)
end_date = datetime(2026, 7, 31)
date_generated = [start_date + timedelta(days=x) for x in range(0, (end_date-start_date).days + 1)]

# Generar 5. Ventas
ventas_data = []
for d in date_generated:
    num_ventas = random.randint(5, 15)
    for _ in range(num_ventas):
        plato = random.choice(platos_list)
        cant = random.randint(1, 10)
        ventas_data.append({
            "Fecha": d,
            "Id Plato": plato['ID Plato'],
            "Id Concatenado": f"{plato['ID Plato']} {plato['Plato a la Carta']}",
            "Cant. Platos Vendidos": cant,
            "Ingreso ": cant * plato.get('Precio de Venta del Plato', 30000),
            "Costo de Insumo": cant * plato.get('Costo del Insumo por Kg', 10000) * 0.3 # asumiendo 300g por plato
        })
df_ventas = pd.DataFrame(ventas_data)

# Generar 3. Compras
compras_data = []
for d in date_generated:
    if random.random() < 0.4: # 40% de probabilidad de compra cada día
        num_compras = random.randint(1, 4)
        comprados = random.sample(insumos_list, min(num_compras, len(insumos_list)))
        for ins in comprados:
            cant = random.randint(20, 100)
            costo_u = ins.get('Costo del Insumo por Kg', 15000)
            compras_data.append({
                "Fecha": d,
                "Proveedor": "Proveedor Simulado",
                "Insumo Comprado": ins['Insumo (Materia Prima)'],
                "Cantidad (Kg)": cant,
                "Costo Total (Factura)": cant * costo_u,
                "Costo Unitario (Calculado)": costo_u
            })
df_compras = pd.DataFrame(compras_data)


# Generar 1. Conteo Bodega
# Mantenemos un estado de inventario para que tenga algo de coherencia
inventario_actual = {ins['Insumo (Materia Prima)']: {'sin_porc': random.randint(30, 80), 'porc': random.randint(10, 50)} for ins in insumos_list}

bodega_data = []
for d in date_generated:
    # Compras del día
    compras_dia = df_compras[df_compras['Fecha'] == d]
    ingresos_dia = {row['Insumo Comprado']: row['Cantidad (Kg)'] for idx, row in compras_dia.iterrows()}

    for ins in insumos_list:
        nombre = ins['Insumo (Materia Prima)']
        tipo = ins['Tipo de Carne']
        
        estado = inventario_actual[nombre]
        
        peso_por_porcion = 0.35 # 350g por porcion
        
        # 1. Registro Inicial
        bodega_data.append({
            "Fecha": d,
            "Tipo": tipo,
            "Insumo": nombre,
            "EsCorte": "Inicial",
            "STOCK INICIAL (Porciones)": estado['porc'],
            "PESO DE LAS PORCIONES (Kg)": estado['porc'] * peso_por_porcion,
            "Stock Inicial Sin Porcionar (Kg)": estado['sin_porc'],
            "Ingreso Factura Dia (Kg)": 0,
            "Cant. Insumo en Bodega (Kg)": estado['sin_porc'] + (estado['porc'] * peso_por_porcion),
            "Porciones Devueltas a Bodega": 0,
            "Peso Porciones Devueltas (Kgs)": 0,
            "Cant. Porcion. Entreg. a Cocina (Unds)": 0,
            "Peso de Unidades Porcionadas (Kgs)": 0,
            "Total Porciones Bodega (Unds)": estado['porc'],
            "Peso Porciones Bodega Kgs": estado['porc'] * peso_por_porcion,
            "Peso Insumo Sin Porcionar Bodega Kg": estado['sin_porc'],
            "Peso Total Insumo Bodega Kg": estado['sin_porc'] + (estado['porc'] * peso_por_porcion),
            "CONSUMO/PERDIDA/MERMA": 0
        })

        # Ingreso del día (si hay)
        ingreso_kg = ingresos_dia.get(nombre, 0)
        estado['sin_porc'] += ingreso_kg

        # Movimientos del día
        porc_entregadas = random.randint(5, max(10, int(estado['porc'] * 0.8)))
        if porc_entregadas > estado['porc']:
            # Se porcionó más
            nuevas_porc = porc_entregadas - estado['porc'] + 10
            estado['sin_porc'] -= nuevas_porc * peso_por_porcion
            if estado['sin_porc'] < 0: estado['sin_porc'] = 0
            estado['porc'] += nuevas_porc
            
        estado['porc'] -= porc_entregadas
        
        porc_devueltas = random.randint(0, 3)
        estado['porc'] += porc_devueltas
        
        merma = random.uniform(0, 2)
        estado['sin_porc'] -= merma
        if estado['sin_porc'] < 0: estado['sin_porc'] = 0

        # 2. Registro Final/Movimiento
        bodega_data.append({
            "Fecha": d,
            "Tipo": tipo,
            "Insumo": nombre,
            "EsCorte": "Seguimiento",
            "STOCK INICIAL (Porciones)": bodega_data[-1]['Total Porciones Bodega (Unds)'],
            "PESO DE LAS PORCIONES (Kg)": bodega_data[-1]['Total Porciones Bodega (Unds)'] * peso_por_porcion,
            "Stock Inicial Sin Porcionar (Kg)": bodega_data[-1]['Peso Insumo Sin Porcionar Bodega Kg'],
            "Ingreso Factura Dia (Kg)": ingreso_kg,
            "Cant. Insumo en Bodega (Kg)": estado['sin_porc'] + (estado['porc'] * peso_por_porcion) + (porc_entregadas * peso_por_porcion) - (porc_devueltas * peso_por_porcion), # Intermedio
            "Porciones Devueltas a Bodega": porc_devueltas,
            "Peso Porciones Devueltas (Kgs)": porc_devueltas * peso_por_porcion,
            "Cant. Porcion. Entreg. a Cocina (Unds)": porc_entregadas,
            "Peso de Unidades Porcionadas (Kgs)": porc_entregadas * peso_por_porcion,
            "Total Porciones Bodega (Unds)": estado['porc'],
            "Peso Porciones Bodega Kgs": estado['porc'] * peso_por_porcion,
            "Peso Insumo Sin Porcionar Bodega Kg": estado['sin_porc'],
            "Peso Total Insumo Bodega Kg": estado['sin_porc'] + (estado['porc'] * peso_por_porcion),
            "CONSUMO/PERDIDA/MERMA": -merma
        })

df_bodega = pd.DataFrame(bodega_data)

# Guardar en el mismo archivo con múltiples hojas
with pd.ExcelWriter(out_path, engine='openpyxl') as writer:
    df_bodega.to_excel(writer, sheet_name='6. Conteo Bodega', index=False)
    # Conservamos 2. Produccion vacio si queremos, pero lo omitimos
    df_compras.to_excel(writer, sheet_name='3. Compras', index=False)
    # 4. Proveedores omitimos o vacio
    df_ventas.to_excel(writer, sheet_name='5. Ventas', index=False)
    # Escribir 7. Recetas intacto
    df_recetas.to_excel(writer, sheet_name='7. Recetas', index=False)

print(f"Datos generados exitosamente en {out_path}")
