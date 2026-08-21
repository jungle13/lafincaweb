const ExcelParser = {
    formatDate: function(dateStr) {
        if (!dateStr) return '';
        // Si ya es string
        if (typeof dateStr === 'string') {
            // Manejar 2026-07-31 00:00:00 -> 2026-07-31
            return dateStr.split(' ')[0];
        }
        // Si es objeto Date de JS
        if (dateStr instanceof Date) {
            return dateStr.toISOString().split('T')[0];
        }
        return String(dateStr).split(' ')[0];
    },

    parseBodega: function(workbook) {
        const sheetName = "6. Conteo Bodega";
        if(!workbook.Sheets[sheetName]) return [];
        
        // raw true ensures dates are parsed as numbers/strings, but we used cellDates:true
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: 'yyyy-mm-dd' });
        
        return rows.map(r => ({
            fecha: this.formatDate(r['Fecha']),
            tipo: r['Tipo'] || '',
            insumo: r['Insumo'] || '',
            esCorte: r['EsCorte'] || '',
            stockInicialPorc: parseFloat(r['STOCK INICIAL (Porciones)']) || 0,
            pesoPorc: parseFloat(r['PESO DE LAS PORCIONES (Kg)']) || 0,
            stockInicialSinPorc: parseFloat(r['Stock Inicial Sin Porcionar (Kg)']) || 0,
            ingresoFactura: parseFloat(r['Ingreso Factura Dia (Kg)']) || 0,
            cantBodega: parseFloat(r['Cant. Insumo en Bodega (Kg)']) || 0,
            porcDevueltas: parseFloat(r['Porciones Devueltas a Bodega']) || 0,
            pesoDevueltas: parseFloat(r['Peso Porciones Devueltas (Kgs)']) || 0,
            porcACocina: parseFloat(r['Cant. Porcion. Entreg. a Cocina (Unds)']) || 0,
            pesoACocina: parseFloat(r['Peso de Unidades Porcionadas (Kgs)']) || 0,
            totalPorcBodega: parseFloat(r['Total Porciones Bodega (Unds)']) || 0,
            pesoPorcBodega: parseFloat(r['Peso Porciones Bodega Kgs']) || 0,
            pesoSinPorcBodega: parseFloat(r['Peso Insumo Sin Porcionar Bodega Kg']) || 0,
            pesoTotalBodega: parseFloat(r['Peso Total Insumo Bodega Kg']) || 0,
            merma: parseFloat(r['CONSUMO/PERDIDA/MERMA']) || 0
        })).filter(r => r.fecha && r.insumo); // Remover filas vacías
    },

    parseBodegaRaw: function(workbook) {
        const sheetName = "6. Conteo Bodega";
        if(!workbook.Sheets[sheetName]) return [];
        // Extract directly, preserving the original keys
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: 'yyyy-mm-dd' });
        // Format dates where necessary but keep original column names
        return rows.map(r => {
            const newObj = { ...r };
            if (newObj['Fecha']) newObj['Fecha'] = this.formatDate(newObj['Fecha']);
            return newObj;
        });
    },

    parseCatalogo: function(workbook) {
        const sheetName = "2. Catálogo";
        if(!workbook.Sheets[sheetName]) return [];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
        return rows.map(r => ({
            id: r['ID'] || '',
            tipo: r['Tipo'] || '',
            insumo: r['Insumo (Materia Prima)'] || '',
            stockMinimo: parseFloat(r['Stock Mínimo (Kg)']) || 0
        })).filter(r => r.insumo);
    },

    parseCompras: function(workbook) {
        const sheetName = "3. Compras";
        if(!workbook.Sheets[sheetName]) return [];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: 'yyyy-mm-dd' });
        
        return rows.map(r => ({
            fecha: this.formatDate(r['Fecha']),
            insumo: r['Insumo Comprado'] || '',
            cantidad: parseFloat(r['Cantidad (Kg)']) || 0,
            costoTotal: parseFloat(r['Costo Total (Factura)']) || 0,
            costoUnitario: parseFloat(r['Costo Unitario (Calculado)']) || 0
        })).filter(r => r.fecha && r.insumo);
    },

    parseVentas: function(workbook) {
        const sheetName = "5. Ventas";
        if(!workbook.Sheets[sheetName]) return [];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: 'yyyy-mm-dd' });
        
        return rows.map(r => ({
            fecha: this.formatDate(r['Fecha']),
            idPlato: r['Id Plato'] || '',
            cantPlatos: parseFloat(r['Cant. Platos Vendidos']) || 0,
            ingreso: parseFloat(r['Ingreso ']) || 0,
            costoInsumo: parseFloat(r['Costo de Insumo']) || 0
        })).filter(r => r.fecha && r.idPlato);
    },

    parseRecetas: function(workbook) {
        const sheetName = "7. Recetas";
        if(!workbook.Sheets[sheetName]) return [];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        return rows.map(r => ({
            idPlato: r['ID Plato'] || '',
            plato: r['Plato a la Carta'] || '',
            idInsumo: r['ID Insumo'] || '',
            insumo: r['Insumo (Materia Prima)'] || '',
            tipoCarne: r['Tipo de Carne'] || '',
            porcionesPorPlato: parseFloat(r['Porciones por Plato']) || 0,
            cantidadPorPorcion: parseFloat(r['Cantidad por Porción (Kg)']) || 0,
            costoInsumoKg: parseFloat(r['Costo del Insumo por Kg']) || 0,
            precioVenta: parseFloat(r['Precio de Venta del Plato']) || 0
        })).filter(r => r.idPlato);
    }
};
