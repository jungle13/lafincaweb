import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Lista consolidada de todos los movimientos extraídos de las fotos
data = [
    # --- 1 AGOSTO INICIAL ---
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Llama", "Insumo": "Costilla de Llama", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 70, "Peso_Kg": None, "Observaciones": "Porciones listas iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 87, "Peso_Kg": 34.3, "Observaciones": "Porciones iniciales pesadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 19, "Peso_Kg": 5.5, "Observaciones": "Presas/porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "Paquetes"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 23, "Peso_Kg": 6.9, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 17, "Peso_Kg": 3.9, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 20, "Peso_Kg": 2.1, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Punta", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 36, "Peso_Kg": 16.2, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Baby", "Insumo": "Baby Beef", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 3, "Peso_Kg": 1.2, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Mega Tocino", "Insumo": "Mega Tocino", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 6, "Peso_Kg": 4.6, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 240, "Peso_Kg": None, "Observaciones": "Unidades iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Chorizo Grande", "Insumo": "Chorizo Grande", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 24, "Peso_Kg": None, "Observaciones": "Unidades iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 10, "Peso_Kg": 2.9, "Observaciones": "Filetes iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 8, "Peso_Kg": 3.4, "Observaciones": "Filetes iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 10, "Peso_Kg": 5.5, "Observaciones": "Filetes iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 33, "Peso_Kg": 12.1, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 47, "Peso_Kg": 17.9, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 27, "Peso_Kg": 13.6, "Observaciones": "Porciones lote 2"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Muslos", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": 18, "Peso_Kg": 5.0, "Observaciones": "Porciones iniciales"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Cámara / Congelador en Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Rellena", "Insumo": "Morcilla / Rellena", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 1.5, "Observaciones": "Stock inicial Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Panceta", "Insumo": "Panceta de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 32.0, "Observaciones": "Entero en Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Carne Hamburguesa", "Insumo": "Carne para Hamburguesa", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Stock inicial Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "Entero en Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 51.7, "Observaciones": "Entera en Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Trozo Pechuga", "Insumo": "Pechuga de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 18.8, "Observaciones": "En bloque / trozo"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 12.8, "Observaciones": "Entero en Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Molida Sobaco", "Insumo": "Carne Molida", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 5.5, "Observaciones": "Molida en Kg"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO INICIAL.jpeg", "Insumo_Original": "Costilla San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL", "Cantidad_Und": None, "Peso_Kg": 3.2, "Observaciones": "Entero en Kg"},

    # --- 1 AGOSTO ---
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 19, "Peso_Kg": None, "Observaciones": "19 porciones entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 unidades entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Sobrebarriga", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 13, "Peso_Kg": None, "Observaciones": "10+3 porciones"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Lengua Res", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 27, "Peso_Kg": None, "Observaciones": "27 porciones entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 unidades entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 4.0, "Observaciones": "4.0 Kg entregados"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.7, "Observaciones": "10.7 Kg entregados"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 13.3, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones obtenidas/devueltas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 7.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones obtenidas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 12.7, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 33, "Peso_Kg": None, "Observaciones": "23+4+6 porciones"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 34, "Peso_Kg": None, "Observaciones": "34 porciones obtenidas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 21, "Peso_Kg": None, "Observaciones": "15+6 porciones"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones entregadas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 paquetes"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Marisco", "Insumo": "Mix de Mariscos", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 4.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones obtenidas"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Rellena", "Insumo": "Morcilla / Rellena", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Lomo Viche", "Insumo": "Lomo Viche", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 8.4, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-01", "Foto": "1 AGOSTO.jpeg", "Insumo_Original": "Empanada", "Insumo": "Empanadas", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 unidades"},

    # --- 3 AGOSTO (Bodeguero: Jonathan) ---
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Pezuña", "Insumo": "Pezuña de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 9.5, "Observaciones": "9.5 Kg para frijoles/sancocho"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Pollo - Muslo", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 18, "Peso_Kg": None, "Observaciones": "18 presas"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Picadillo Lengua", "Insumo": "Picadillo de Lengua", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 7.2, "Observaciones": "7.2 Kg picadillo"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 24, "Peso_Kg": 9.3, "Observaciones": "24 unds = 9.3 Kg"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Recorte de Pollo", "Insumo": "Recorte de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 2.2, "Observaciones": "Recorte para caldos/sopas"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Costilla Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Costilla Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 8.4, "Observaciones": "4.2 + 4.2 Kg entregados"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Tocino Barril", "Insumo": "Tocino Barril", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": 8.9, "Observaciones": "20 unds = 8.9 Kg"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Chorizo Grande", "Insumo": "Chorizo Grande", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 unidades"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 unidades"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "TRANSFORMACION / SECADO", "Cantidad_Und": 1, "Peso_Kg": None, "Observaciones": "1 paquete puesto a secar"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 6, "Peso_Kg": None, "Observaciones": "6 porciones"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": 2.5, "Observaciones": "5 unds = 2.5 Kg"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Costilla Res", "Insumo": "Costilla de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 16.0, "Observaciones": "16 Kg puestos a cocinar"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Pernil Pollo", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 45.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Punta", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 7, "Peso_Kg": None, "Observaciones": "7 porciones"},
    {"Fecha": "2026-08-03", "Foto": "3 AGOSTO.jpeg", "Insumo_Original": "Cilindro Molida", "Insumo": "Carne Molida Cilindro", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 4.0, "Observaciones": "4.0 Kg"},

    # --- 5 AGOSTO ---
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Trozo Pechuga", "Insumo": "Pechuga de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 13.4, "Observaciones": "13.4 Kg entregados"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "10.0 Kg entregados"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Sobrebarriga", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 27.1, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Caderita", "Insumo": "Caderita de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.3, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Caderita", "Insumo": "Caderita de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 50, "Peso_Kg": None, "Observaciones": "50 porciones obtenidas"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones obtenidas"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 9.8, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones obtenidas"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 19.8, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 porciones obtenidas"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 unidades devueltas/listas"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 450, "Peso_Kg": None, "Observaciones": "450 unidades / 15 panales"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 160, "Peso_Kg": None, "Observaciones": "160 unidades recibidas"},
    {"Fecha": "2026-08-05", "Foto": "5 AGOSTO.jpeg", "Insumo_Original": "Chorizo Grande", "Insumo": "Chorizo Grande", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 36, "Peso_Kg": None, "Observaciones": "36 unidades recibidas"},

    # --- 6 AGOSTO ---
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Pernil Pollo", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 presas"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Albondiga", "Insumo": "Albóndigas", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 33, "Peso_Kg": None, "Observaciones": "33 unidades"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 150, "Peso_Kg": None, "Observaciones": "150 unidades"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 unidades"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Mix Verdura", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 1, "Peso_Kg": None, "Observaciones": "1 paquete"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "INVENTARIO INICIAL / STOCK", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Stock inicial 20 Kg"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 4.0, "Observaciones": "4.0 Kg entregados"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 12, "Peso_Kg": None, "Observaciones": "12 porciones"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 8, "Peso_Kg": None, "Observaciones": "8 porciones"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 porciones"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 9.5, "Observaciones": "9.5 Kg entregados (Stock: 9.5 Kg)"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.8, "Observaciones": "10.8 Kg entregados (Stock: 10.8 Kg)"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Lengua Res", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 20.3, "Observaciones": "20.3 Kg entregados (Stock: 20.3 Kg)"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 3, "Peso_Kg": None, "Observaciones": "3 porciones"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 14.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 porciones obtenidas"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 16.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-06", "Foto": "6 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 paquetes recibidos"},

    # --- 8 AGOSTO (Parte 1 y 2) ---
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 16, "Peso_Kg": None, "Observaciones": "16 presas"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 unidades"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 80, "Peso_Kg": None, "Observaciones": "80 unidades"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 12, "Peso_Kg": None, "Observaciones": "7+5 porciones"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.4, "Observaciones": "10.4 Kg entregados"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 21.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 59, "Peso_Kg": None, "Observaciones": "59 porciones obtenidas"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 24.7, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 6.9, "Observaciones": "6.9 Kg entregados"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Mix Verdura", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 1, "Peso_Kg": None, "Observaciones": "1 paquete"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 15.6, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 45, "Peso_Kg": None, "Observaciones": "45 porciones obtenidas"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 23.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 58, "Peso_Kg": None, "Observaciones": "58 porciones obtenidas"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 16, "Peso_Kg": None, "Observaciones": "16 paquetes recibidos"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 6, "Peso_Kg": None, "Observaciones": "6 paquetes entregados"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Muchacho", "Insumo": "Muchacho de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 18.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 64.6, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 porciones entregadas"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Costilla Llama", "Insumo": "Costilla de Llama", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 13.3, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 24, "Peso_Kg": None, "Observaciones": "24 porciones"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.jpeg", "Insumo_Original": "Lomo Viche", "Insumo": "Lomo Viche", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 7.8, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.1.jpeg", "Insumo_Original": "Costilla Res", "Insumo": "Costilla de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 22.4, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.1.jpeg", "Insumo_Original": "Gallo", "Insumo": "Gallo Criollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 7.9, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.1.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 3.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.1.jpeg", "Insumo_Original": "Higado", "Insumo": "Hígado de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-08", "Foto": "8 AGOSTO.1.jpeg", "Insumo_Original": "Higado", "Insumo": "Hígado de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones obtenidas"},

    # --- 9 AGOSTO ---
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Sobre Porcion", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Lengua Porcion", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 unidades"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 32, "Peso_Kg": None, "Observaciones": "32 presas"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 53, "Peso_Kg": None, "Observaciones": "53 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Mega Tocino", "Insumo": "Mega Tocino", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 6, "Peso_Kg": None, "Observaciones": "6 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 9, "Peso_Kg": None, "Observaciones": "9 paquetes"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 80, "Peso_Kg": None, "Observaciones": "80 unidades"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "10.0 Kg entregados"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Baby", "Insumo": "Baby Beef", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "8.0 Kg entregados"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 45, "Peso_Kg": None, "Observaciones": "45 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 35, "Peso_Kg": None, "Observaciones": "35 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "Punta", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 porciones"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 14.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-09", "Foto": "9 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 14.0, "Observaciones": "14.0 Kg entregados"},

    # --- 11 AGOSTO ---
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Costilla Res", "Insumo": "Costilla de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 65, "Peso_Kg": None, "Observaciones": "65 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Muchacho", "Insumo": "Muchacho de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 50, "Peso_Kg": None, "Observaciones": "50 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 17.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 52, "Peso_Kg": None, "Observaciones": "52 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 52, "Peso_Kg": None, "Observaciones": "52 porciones obtenidas"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 450, "Peso_Kg": None, "Observaciones": "450 unidades / 15 panales"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 unidades"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 6.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 50, "Peso_Kg": None, "Observaciones": "50 porciones obtenidas"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Costilla Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Costilla Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 12.0, "Observaciones": "12.0 Kg entregados"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 paquetes"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 32, "Peso_Kg": None, "Observaciones": "32 porciones"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 7.6, "Observaciones": "7.6 Kg entregados"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 11.3, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 11.3, "Observaciones": "11.3 Kg entregados"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 28.4, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 80, "Peso_Kg": None, "Observaciones": "80 porciones obtenidas"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 200, "Peso_Kg": None, "Observaciones": "200 unidades recibidas"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Chorizo Grande", "Insumo": "Chorizo Grande", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 12, "Peso_Kg": None, "Observaciones": "12 unidades recibidas"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Pernil Pollo", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 42.6, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Pernil Pollo", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 120, "Peso_Kg": None, "Observaciones": "120 presas obtenidas"},
    {"Fecha": "2026-08-11", "Foto": "11 AGOSTO.jpeg", "Insumo_Original": "Pechuga", "Insumo": "Pechuga de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.3, "Observaciones": "Factura recibida"},

    # --- 12 AGOSTO (Parte 1 y 2) ---
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Pollo Pernil", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 presas"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 6, "Peso_Kg": None, "Observaciones": "6 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 25, "Peso_Kg": None, "Observaciones": "25 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 6.0, "Observaciones": "6.0 Kg entregados"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Mix Verdura", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 1, "Peso_Kg": None, "Observaciones": "1 paquete"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 16, "Peso_Kg": None, "Observaciones": "16 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Costilla Llama", "Insumo": "Costilla de Llama", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 13.9, "Observaciones": "13.9 Kg entregados"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Alguacil", "Insumo": "Alguacil / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Alguacil", "Insumo": "Alguacil / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 49, "Peso_Kg": None, "Observaciones": "49 porciones obtenidas"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 39.6, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 26.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 97.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 26.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 29.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 16, "Peso_Kg": None, "Observaciones": "16 paquetes recibidos"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Costilla Llama", "Insumo": "Costilla de Llama", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 13.9, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-12", "Foto": "12 AGOSTO.1.jpeg", "Insumo_Original": "Costilla San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 57.4, "Observaciones": "Factura recibida"},

    # --- 13 AGOSTO ---
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 25, "Peso_Kg": None, "Observaciones": "25 porciones"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 80, "Peso_Kg": None, "Observaciones": "80 unidades"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 27, "Peso_Kg": None, "Observaciones": "27 porciones"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 6.3, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 6.3, "Observaciones": "6.3 Kg entregados"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.6, "Observaciones": "10.6 Kg entregados"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Rellena", "Insumo": "Morcilla / Rellena", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 6, "Peso_Kg": None, "Observaciones": "6 porciones"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 17.1, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 34, "Peso_Kg": None, "Observaciones": "34 porciones obtenidas"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Gallo", "Insumo": "Gallo Criollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 7.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 10.1, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-13", "Foto": "13 AGOSTO.jpeg", "Insumo_Original": "Costilla Res", "Insumo": "Costilla de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},

    # --- 14 AGOSTO ---
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Alguacil", "Insumo": "Alguacil / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 49, "Peso_Kg": None, "Observaciones": "49 porciones"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Pernil Pollo", "Insumo": "Pernil / Muslos de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 presas"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 6.2, "Observaciones": "6.2 Kg entregados"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Chorizo Grande", "Insumo": "Chorizo Grande", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 12, "Peso_Kg": None, "Observaciones": "12 unidades"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 40.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "8.0 Kg entregados"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 6, "Peso_Kg": None, "Observaciones": "6 porciones"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Baby", "Insumo": "Baby Beef", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 porciones"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Lomo Viche", "Insumo": "Lomo Viche", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Llama", "Insumo": "Costilla de Llama", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 70, "Peso_Kg": None, "Observaciones": "70 porciones listas recibidas"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.3, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 50, "Peso_Kg": None, "Observaciones": "50 porciones obtenidas"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 9.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones obtenidas"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Marisco", "Insumo": "Mix de Mariscos", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 5.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-14", "Foto": "14 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.3, "Observaciones": "10.3 Kg entregados"},

    # --- 15 AGOSTO (Parte 1 y 2) ---
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 29.9, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "Tocino Barril", "Insumo": "Tocino Barril", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 139.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 12, "Peso_Kg": None, "Observaciones": "12 paquetes recibidos"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 39.6, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "Ajo", "Insumo": "Ajo", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.jpeg", "Insumo_Original": "Mix Verduras", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 16, "Peso_Kg": None, "Observaciones": "16 presas"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 24, "Peso_Kg": None, "Observaciones": "24 unidades"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 13, "Peso_Kg": None, "Observaciones": "13 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 7.2, "Observaciones": "7.2 Kg entregados"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 26, "Peso_Kg": None, "Observaciones": "26 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 200, "Peso_Kg": None, "Observaciones": "200 unidades recibidas"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 80, "Peso_Kg": None, "Observaciones": "80 unidades entregadas"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 4.0, "Observaciones": "4.0 Kg entregados"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 13.2, "Observaciones": "13.2 Kg entregados"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 25.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 70, "Peso_Kg": None, "Observaciones": "70 porciones obtenidas"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Chorizo Grande", "Insumo": "Chorizo Grande", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 12, "Peso_Kg": None, "Observaciones": "12 unidades recibidas"},
    {"Fecha": "2026-08-15", "Foto": "15 AGOSTO.1.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 21.1, "Observaciones": "Factura recibida"},

    # --- 16 AGOSTO ---
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 32, "Peso_Kg": None, "Observaciones": "32 presas"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 unidades"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 88, "Peso_Kg": None, "Observaciones": "70+18 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 90, "Peso_Kg": None, "Observaciones": "90 unidades"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 40, "Peso_Kg": None, "Observaciones": "40 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 30, "Peso_Kg": None, "Observaciones": "30 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 15, "Peso_Kg": None, "Observaciones": "15 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Camaron", "Insumo": "Camarón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "8.0 Kg entregados"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Trucha", "Insumo": "Trucha", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 8, "Peso_Kg": None, "Observaciones": "8 paquetes"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Ahumada", "Insumo": "Costilla Ahumada", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "8.0 Kg entregados"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Baby", "Insumo": "Baby Beef", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 13, "Peso_Kg": None, "Observaciones": "13 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Carne Asada", "Insumo": "Carne Asada", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Chorizo Paisa", "Insumo": "Chorizo Paisa", "Categoria": "EMBUTIDOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 80, "Peso_Kg": None, "Observaciones": "80 unidades"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Mix Verdura", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 1, "Peso_Kg": None, "Observaciones": "1 paquete"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 17.2, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-16", "Foto": "16 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 46, "Peso_Kg": None, "Observaciones": "46 porciones obtenidas"},

    # --- 17 AGOSTO ---
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Gallina", "Insumo": "Gallina Criolla", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 24, "Peso_Kg": None, "Observaciones": "24 presas"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Tamal", "Insumo": "Tamal", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 20, "Peso_Kg": None, "Observaciones": "20 unidades"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Lengua", "Insumo": "Lengua de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 81, "Peso_Kg": None, "Observaciones": "81 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Huevos", "Insumo": "Huevos", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 unidades"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Punta", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Churrasco", "Insumo": "Churrasco", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Tilapia", "Insumo": "Tilapia", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Salmon", "Insumo": "Salmón", "Categoria": "PESCADOS Y MARISCOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 10, "Peso_Kg": None, "Observaciones": "10 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Lomo Cerdo", "Insumo": "Lomo de Cerdo", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 25, "Peso_Kg": None, "Observaciones": "25 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 9, "Peso_Kg": None, "Observaciones": "9 porciones"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Costilla Res", "Insumo": "Costilla de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 21.0, "Observaciones": "21.0 Kg entregados"},
    {"Fecha": "2026-08-17", "Foto": "17 AGOSTO.jpeg", "Insumo_Original": "Albondiga", "Insumo": "Albóndigas", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 8.0, "Observaciones": "8.0 Kg entregados"},

    # --- SIN FECHA ---
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Baby", "Insumo": "Baby Beef", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": 5, "Peso_Kg": None, "Observaciones": "5 porciones"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Costilla San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 38.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Costilla San Luis", "Insumo": "Costilla San Luis", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 38.5, "Observaciones": "38.5 Kg entregados"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Sobre", "Insumo": "Sobrebarriga", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 9.6, "Observaciones": "9.6 Kg entregados"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Mix Verdura", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Mix Verdura", "Insumo": "Mix de Verduras", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 10.0, "Observaciones": "10.0 Kg entregados"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 23.7, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Sobaco", "Insumo": "Sobaco / Carne de Res", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTREGA A COCINA", "Cantidad_Und": None, "Peso_Kg": 5.9, "Observaciones": "5.9 Kg entregados"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Francesa", "Insumo": "Papa a la Francesa", "Categoria": "COMPLEMENTOS", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": 4, "Peso_Kg": None, "Observaciones": "4 paquetes recibidos"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Tocino", "Insumo": "Tocino / Chicharrón", "Categoria": "CARNE DE CERDO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 126.1, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 20.5, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Punta Anca", "Insumo": "Punta de Anca", "Categoria": "CARNE DE RES", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 46, "Peso_Kg": None, "Observaciones": "46 porciones obtenidas"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "ENTRADA POR COMPRA", "Cantidad_Und": None, "Peso_Kg": 21.4, "Observaciones": "Factura recibida"},
    {"Fecha": "2026-08-XX", "Foto": "SIN FECHA.jpeg", "Insumo_Original": "Filete Pollo", "Insumo": "Filete de Pollo", "Categoria": "AVES / POLLO", "Tipo_Movimiento": "PORCIONADO / DEVOLUCION", "Cantidad_Und": 60, "Peso_Kg": None, "Observaciones": "60 porciones obtenidas"}
]

df = pd.DataFrame(data)

# Exportar a Excel con formato premium
excel_path = r"c:\Users\Home\Desktop\11_Dashboard_La_Finca\11_Dashboard_La_Finca\CONSOLIDADO_MOVIMIENTOS_CARNES_AGOSTO.xlsx"

wb = openpyxl.Workbook()
# Sheet 1: Detalle de Movimientos
ws1 = wb.active
ws1.title = "Movimientos_Detalle"
ws1.views.sheetView[0].showGridLines = True

# Colors
header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")

fill_compra = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid") # Azul claro
font_compra = Font(name="Segoe UI", size=10, color="1E3A8A", bold=True)

fill_cocina = PatternFill(start_color="FFEDD5", end_color="FFEDD5", fill_type="solid") # Naranja claro
font_cocina = Font(name="Segoe UI", size=10, color="C2410C", bold=True)

fill_porc = PatternFill(start_color="F3E8FF", end_color="F3E8FF", fill_type="solid") # Morado claro
font_porc = Font(name="Segoe UI", size=10, color="6B21A8", bold=True)

fill_inicial = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid") # Gris
font_inicial = Font(name="Segoe UI", size=10, color="334155", bold=True)

thin_border = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

headers = ["Fecha", "Foto Origen", "Insumo Original (Foto)", "Insumo Estandarizado", "Categoría", "Tipo de Movimiento", "Cantidad (Und / Porc)", "Peso (Kg)", "Observaciones"]
ws1.append(headers)

for col_num in range(1, len(headers) + 1):
    cell = ws1.cell(row=1, column=col_num)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")

for r_idx, row in enumerate(data, start=2):
    ws1.append([
        row["Fecha"],
        row["Foto"],
        row["Insumo_Original"],
        row["Insumo"],
        row["Categoria"],
        row["Tipo_Movimiento"],
        row["Cantidad_Und"],
        row["Peso_Kg"],
        row["Observaciones"]
    ])
    
    # Format cells
    for c_idx in range(1, len(headers) + 1):
        c = ws1.cell(row=r_idx, column=c_idx)
        c.border = thin_border
        c.font = Font(name="Segoe UI", size=10)
        
        # Alignment
        if c_idx in [1, 2, 5]:
            c.alignment = Alignment(horizontal="center", vertical="center")
        elif c_idx in [7, 8]:
            c.alignment = Alignment(horizontal="right", vertical="center")
            if c_idx == 8 and c.value is not None:
                c.number_format = '#,##0.0'
            elif c_idx == 7 and c.value is not None:
                c.number_format = '#,##0'
        else:
            c.alignment = Alignment(horizontal="left", vertical="center")

        # Color badges on Tipo Movimiento
        if c_idx == 6:
            c.alignment = Alignment(horizontal="center", vertical="center")
            if row["Tipo_Movimiento"] == "ENTRADA POR COMPRA":
                c.fill = fill_compra
                c.font = font_compra
            elif row["Tipo_Movimiento"] == "ENTREGA A COCINA":
                c.fill = fill_cocina
                c.font = font_cocina
            elif row["Tipo_Movimiento"] == "PORCIONADO / DEVOLUCION":
                c.fill = fill_porc
                c.font = font_porc
            elif row["Tipo_Movimiento"] == "INVENTARIO INICIAL":
                c.fill = fill_inicial
                c.font = font_inicial

# Auto width sheet 1
for col in ws1.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws1.column_dimensions[col_letter].width = max(max_len + 4, 12)

# Sheet 2: Resumen por Insumo
ws2 = wb.create_sheet(title="Resumen_Por_Insumo")
ws2.views.sheetView[0].showGridLines = True

resumen_df = df.groupby(["Insumo", "Categoria", "Tipo_Movimiento"]).agg({
    "Cantidad_Und": "sum",
    "Peso_Kg": "sum"
}).reset_index()

headers2 = ["Insumo Estandarizado", "Categoría", "Tipo de Movimiento", "Total Unidades / Porc.", "Total Peso (Kg)"]
ws2.append(headers2)
for col_num in range(1, len(headers2) + 1):
    cell = ws2.cell(row=1, column=col_num)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")

for r_idx, row in enumerate(resumen_df.itertuples(), start=2):
    ws2.append([
        row.Insumo,
        row.Categoria,
        row.Tipo_Movimiento,
        row.Cantidad_Und if row.Cantidad_Und > 0 else "-",
        row.Peso_Kg if row.Peso_Kg > 0 else "-"
    ])
    for c_idx in range(1, len(headers2) + 1):
        c = ws2.cell(row=r_idx, column=c_idx)
        c.border = thin_border
        c.font = Font(name="Segoe UI", size=10)
        if c_idx in [4, 5]:
            c.alignment = Alignment(horizontal="right", vertical="center")
            if isinstance(c.value, (int, float)):
                c.number_format = '#,##0.0'
        elif c_idx in [2, 3]:
            c.alignment = Alignment(horizontal="center", vertical="center")

for col in ws2.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws2.column_dimensions[col_letter].width = max(max_len + 4, 14)

# Sheet 3: Resumen por Fecha
ws3 = wb.create_sheet(title="Resumen_Por_Fecha")
ws3.views.sheetView[0].showGridLines = True

fecha_df = df.groupby(["Fecha", "Tipo_Movimiento"]).size().unstack(fill_value=0).reset_index()
headers3 = ["Fecha"] + list(fecha_df.columns[1:])
ws3.append(headers3)
for col_num in range(1, len(headers3) + 1):
    cell = ws3.cell(row=1, column=col_num)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")

for r_idx, row in enumerate(fecha_df.itertuples(index=False), start=2):
    ws3.append(list(row))
    for c_idx in range(1, len(headers3) + 1):
        c = ws3.cell(row=r_idx, column=c_idx)
        c.border = thin_border
        c.font = Font(name="Segoe UI", size=10)
        c.alignment = Alignment(horizontal="center", vertical="center")

for col in ws3.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws3.column_dimensions[col_letter].width = max(max_len + 4, 15)

wb.save(excel_path)
print(f"Consolidado exportado exitosamente a: {excel_path}")
print(f"Total registros procesados: {len(data)}")
