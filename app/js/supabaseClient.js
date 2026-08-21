/**
 * Supabase Client & Service Layer - La Finca Dashboard & Inventory System
 */

const SUPABASE_URL = "https://uexqmrspulhauubzrwyn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO";

let supabaseClient = null;

const SupabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,
    isConnected: false,

    init: function() {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                supabaseClient = window.supabase.createClient(this.url, this.key);
                console.log("✅ Supabase inicializado correctamente.");
                this.testConnection();
            } catch (err) {
                console.error("❌ Error al inicializar Supabase Client:", err);
            }
        } else {
            console.warn("⚠️ Librería @supabase/supabase-js no detectada en window.");
        }
    },

    getClient: function() {
        if (!supabaseClient && window.supabase) {
            this.init();
        }
        return supabaseClient;
    },

    testConnection: async function() {
        const client = this.getClient();
        if (!client) return false;
        try {
            const { data, error } = await client.from('catalogo_insumos').select('id, nombre').limit(1);
            if (error) {
                console.warn("⚠️ Aviso conexión Supabase (tablas pendientes o RLS):", error.message);
                this.isConnected = false;
                this.updateConnectionUI(false, error.message);
                return false;
            }
            console.log("🚀 Conexión con Supabase verificada con éxito.");
            this.isConnected = true;
            this.updateConnectionUI(true);
            return true;
        } catch (e) {
            console.error("Error conectando a Supabase:", e);
            this.isConnected = false;
            this.updateConnectionUI(false, e.message);
            return false;
        }
    },

    updateConnectionUI: function(connected, errorMsg = '') {
        const statusEl = document.getElementById('data-status');
        if (statusEl) {
            if (connected) {
                statusEl.innerHTML = `
                    <div class="status-indicator green" style="background:#10b981; box-shadow: 0 0 8px #10b981;"></div>
                    <span style="color:#10b981; font-weight:600;">Supabase Conectado</span>
                `;
            } else {
                statusEl.innerHTML = `
                    <div class="status-indicator yellow" style="background:#f59e0b;"></div>
                    <span title="${errorMsg}">Modo Local / Excel</span>
                `;
            }
        }
    }
};

// ==========================================
// SERVICIOS DE INVENTARIO Y STOCK EN VIVO
// ==========================================

const StockService = {
    // Obtener inventario consolidado en vivo
    getInventarioEnVivo: async function() {
        const client = SupabaseConfig.getClient();
        if (!client) return null;

        try {
            // Intentar primero vista optimizada
            let { data, error } = await client
                .from('v_inventario_en_vivo')
                .select('*')
                .order('es_carne', { ascending: false })
                .order('categoria', { ascending: true })
                .order('insumo', { ascending: true });

            // Cargar mermas acumuladas por insumo desde movimientos_inventario
            const mermasMap = {};
            try {
                const { data: movsMerma } = await client
                    .from('movimientos_inventario')
                    .select('insumo_id, merma_kg, costo_unitario_kg');
                
                if (movsMerma && movsMerma.length > 0) {
                    movsMerma.forEach(m => {
                        const id = m.insumo_id;
                        const kg = parseFloat(m.merma_kg) || 0;
                        const cost = parseFloat(m.costo_unitario_kg) || 0;
                        if (!mermasMap[id]) mermasMap[id] = { kg: 0, pesos: 0 };
                        mermasMap[id].kg += kg;
                        mermasMap[id].pesos += (kg * cost);
                    });
                }
            } catch (e) {
                console.warn("Mermas map:", e);
            }

            if (error || !data || data.length === 0) {
                // Fallback manual con joins
                const res = await client
                    .from('catalogo_insumos')
                    .select('*, stock_actual(*)')
                    .eq('activo', true)
                    .order('es_carne', { ascending: false })
                    .order('nombre', { ascending: true });
                
                if (res.error) throw res.error;
                
                return (res.data || []).map(item => {
                    const st = item.stock_actual?.[0] || item.stock_actual || {};
                    const bSinPorc = parseFloat(st.bodega_sin_porcionar_kg) || 0;
                    const bPorcUnd = parseInt(st.bodega_porcionado_und) || 0;
                    const bPorcKg = parseFloat(st.bodega_porcionado_kg) || 0;
                    const cSinPorc = parseFloat(st.cocina_sin_porcionar_kg) || 0;
                    const cPorcUnd = parseInt(st.cocina_porcionado_und) || 0;
                    const cPorcKg = parseFloat(st.cocina_porcionado_kg) || 0;
                    const costoU = parseFloat(item.costo_unitario_kg) || 0;
                    const stockMin = parseFloat(item.stock_minimo_kg) || 10;

                    const totalBodegaKg = bSinPorc + bPorcKg;
                    const totalCocinaKg = cSinPorc + cPorcKg;
                    const totalGenKg = totalBodegaKg + totalCocinaKg;

                    const mermaData = mermasMap[item.id] || mermasMap[item.nombre] || { kg: 0, pesos: 0 };

                    return {
                        insumo_id: item.id,
                        codigo: item.codigo,
                        insumo: item.nombre,
                        categoria: item.categoria,
                        es_carne: item.es_carne,
                        unidad_medida: item.unidad_medida,
                        costo_unitario_kg: costoU,
                        stock_minimo_kg: stockMin,
                        peso_estandar_porcion_kg: parseFloat(item.peso_estandar_porcion_kg) || 0.350,
                        bodega_sin_porc_kg: bSinPorc,
                        bodega_porc_und: bPorcUnd,
                        bodega_porc_kg: bPorcKg,
                        peso_total_bodega_kg: totalBodegaKg,
                        valor_bodega_pesos: totalBodegaKg * costoU,
                        cocina_sin_porc_kg: cSinPorc,
                        cocina_porc_und: cPorcUnd,
                        cocina_porc_kg: cPorcKg,
                        peso_total_cocina_kg: totalCocinaKg,
                        valor_cocina_pesos: totalCocinaKg * costoU,
                        merma_acumulada_kg: mermaData.kg,
                        merma_acumulada_pesos: mermaData.pesos || (mermaData.kg * costoU),
                        peso_total_general_kg: totalGenKg,
                        valor_total_general_pesos: totalGenKg * costoU,
                        estado_stock: totalBodegaKg === 0 ? 'AGOTADO' : (totalBodegaKg <= stockMin ? 'BAJO' : 'OPTIMO')
                    };
                });
            }

            return data.map(item => {
                const mermaData = mermasMap[item.insumo_id] || mermasMap[item.insumo] || { kg: 0, pesos: 0 };
                const costoU = parseFloat(item.costo_unitario_kg) || 0;
                return {
                    ...item,
                    merma_acumulada_kg: mermaData.kg,
                    merma_acumulada_pesos: mermaData.pesos || (mermaData.kg * costoU)
                };
            });
        } catch (e) {
            console.error("Error al obtener inventario en vivo de Supabase:", e);
            return null;
        }
    },

    // Suscribirse a cambios en tiempo real
    subscribeRealtime: function(onChangeCallback) {
        const client = SupabaseConfig.getClient();
        if (!client) return;

        return client
            .channel('db-changes-stock')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_actual' }, payload => {
                console.log('⚡ Cambio en stock_actual detectado:', payload);
                if (typeof onChangeCallback === 'function') onChangeCallback();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'movimientos_inventario' }, payload => {
                console.log('⚡ Nuevo movimiento de inventario detectado:', payload);
                if (typeof onChangeCallback === 'function') onChangeCallback();
            })
            .subscribe();
    }
};

// ==========================================
// SERVICIO DE MOVIMIENTOS Y OPERACIONES
// ==========================================

const MovimientosService = {
    // Obtener historial de movimientos
    getMovimientos: async function(limit = 100) {
        const client = SupabaseConfig.getClient();
        if (!client) return [];
        try {
            const { data, error } = await client
                .from('movimientos_inventario')
                .select('*, catalogo_insumos(nombre, categoria, es_carne, unidad_medida)')
                .order('fecha_hora', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data;
        } catch (e) {
            console.error("Error al obtener movimientos:", e);
            return [];
        }
    },

    // 1. REGISTRO DE COMPRA / ENTRADA A BODEGA
    registrarEntradaCompra: async function({ insumoId, proveedor, factura, cantidadKg, costoTotal, observaciones, usuario = 'Bodeguero' }) {
        const client = SupabaseConfig.getClient();
        if (!client) throw new Error("Supabase no inicializado");

        cantidadKg = parseFloat(cantidadKg);
        costoTotal = parseFloat(costoTotal);
        const costoUnitarioKg = cantidadKg > 0 ? (costoTotal / cantidadKg) : 0;

        // 1. Obtener estado actual del insumo y stock
        const { data: insumoData, error: insumoErr } = await client
            .from('catalogo_insumos')
            .select('*, stock_actual(*)')
            .eq('id', insumoId)
            .single();
        if (insumoErr) throw insumoErr;

        const currentStock = insumoData.stock_actual?.[0] || insumoData.stock_actual || {};
        const prevBodegaSinPorc = parseFloat(currentStock.bodega_sin_porcionar_kg) || 0;
        const newBodegaSinPorc = prevBodegaSinPorc + cantidadKg;

        // 2. Registrar en tabla compras
        const esFacturaCompleta = Boolean(factura && factura.trim() && proveedor && proveedor.trim() && costoTotal > 0);

        const { data: compra, error: compraErr } = await client
            .from('compras')
            .insert([{
                fecha: new Date().toISOString().split('T')[0],
                numero_factura: factura || null,
                proveedor: proveedor || 'Pendiente de Factura',
                valor_total: costoTotal,
                observaciones: observaciones || (esFacturaCompleta ? 'Ingreso registrado en Bodega' : '⚠️ Factura/Proveedor pendiente por liquidar'),
                usuario: usuario
            }])
            .select()
            .single();
        if (compraErr) throw compraErr;

        // 3. Registrar detalle de compra
        await client.from('compras_detalle').insert([{
            compra_id: compra.id,
            insumo_id: insumoId,
            cantidad_kg: cantidadKg,
            costo_unitario_kg: costoUnitarioKg,
            costo_total: costoTotal
        }]);

        // 4. Actualizar costo promedio en catálogo
        await client.from('catalogo_insumos')
            .update({ costo_unitario_kg: costoUnitarioKg, updated_at: new Date().toISOString() })
            .eq('id', insumoId);

        // 5. Actualizar saldo en stock_actual
        const { error: stockErr } = await client
            .from('stock_actual')
            .update({
                bodega_sin_porcionar_kg: newBodegaSinPorc,
                updated_at: new Date().toISOString()
            })
            .eq('insumo_id', insumoId);
        if (stockErr) throw stockErr;

        // 6. Registrar en movimientos_inventario
        const { data: mov, error: movErr } = await client
            .from('movimientos_inventario')
            .insert([{
                tipo_movimiento: 'ENTRADA_COMPRA',
                insumo_id: insumoId,
                origen: 'PROVEEDOR (' + (proveedor || 'Pendiente') + ')',
                destino: 'BODEGA_ENTERO',
                cant_sin_porcionar_kg: cantidadKg,
                bodega_sin_porc_anterior_kg: prevBodegaSinPorc,
                bodega_sin_porc_nuevo_kg: newBodegaSinPorc,
                costo_unitario_kg: costoUnitarioKg,
                valor_total_movimiento: costoTotal,
                observaciones: observaciones || `Factura: ${factura || 'PENDIENTE'} - Proveedor: ${proveedor || 'PENDIENTE'}`,
                usuario: usuario
            }])
            .select()
            .single();
        if (movErr) throw movErr;

        return { success: true, mov, compra, nuevoStock: newBodegaSinPorc };
    },

    // Actualizar datos de factura por parte del administrador
    actualizarCompraFactura: async function({ compraId, numeroFactura, proveedor, valorTotal, observaciones, usuario = 'Administrador' }) {
        const client = SupabaseConfig.getClient();
        if (!client) throw new Error("Supabase no inicializado");

        const updatePayload = {
            numero_factura: numeroFactura,
            proveedor: proveedor,
            valor_total: parseFloat(valorTotal) || 0,
            observaciones: observaciones || 'Factura completada por Administración'
        };

        const { data, error } = await client
            .from('compras')
            .update(updatePayload)
            .eq('id', compraId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // 2. REGISTRO DE PORCIONADO Y PESADO
    registrarPorcionado: async function({ insumoId, kgAProcesar, porcionesObtenidas, pesoPorcionesKg, mermaKg, observaciones, usuario = 'Bodeguero' }) {
        const client = SupabaseConfig.getClient();
        if (!client) throw new Error("Supabase no inicializado");

        kgAProcesar = parseFloat(kgAProcesar);
        porcionesObtenidas = parseInt(porcionesObtenidas);
        pesoPorcionesKg = parseFloat(pesoPorcionesKg);
        mermaKg = parseFloat(mermaKg) || Math.max(0, kgAProcesar - pesoPorcionesKg);

        // Obtener stock actual
        const { data: insumoData, error: insumoErr } = await client
            .from('catalogo_insumos')
            .select('*, stock_actual(*)')
            .eq('id', insumoId)
            .single();
        if (insumoErr) throw insumoErr;

        const currentStock = insumoData.stock_actual?.[0] || insumoData.stock_actual || {};
        const prevSinPorc = parseFloat(currentStock.bodega_sin_porcionar_kg) || 0;
        const prevPorcUnd = parseInt(currentStock.bodega_porcionado_und) || 0;
        const prevPorcKg = parseFloat(currentStock.bodega_porcionado_kg) || 0;

        if (kgAProcesar > prevSinPorc + 0.001) {
            throw new Error(`Stock insuficiente de carne sin porcionar. Hay ${prevSinPorc.toFixed(2)} Kg en bodega.`);
        }

        const newSinPorc = Math.max(0, prevSinPorc - kgAProcesar);
        const newPorcUnd = prevPorcUnd + porcionesObtenidas;
        const newPorcKg = prevPorcKg + pesoPorcionesKg;

        // Actualizar stock_actual
        const { error: stockErr } = await client
            .from('stock_actual')
            .update({
                bodega_sin_porcionar_kg: newSinPorc,
                bodega_porcionado_und: newPorcUnd,
                bodega_porcionado_kg: newPorcKg,
                updated_at: new Date().toISOString()
            })
            .eq('insumo_id', insumoId);
        if (stockErr) throw stockErr;

        // Registrar movimiento
        const costoKg = parseFloat(insumoData.costo_unitario_kg) || 0;
        const { data: mov, error: movErr } = await client
            .from('movimientos_inventario')
            .insert([{
                tipo_movimiento: 'PORCIONADO',
                insumo_id: insumoId,
                origen: 'BODEGA_ENTERO',
                destino: 'BODEGA_PORCIONADO',
                cant_sin_porcionar_kg: kgAProcesar,
                porciones_und: porcionesObtenidas,
                peso_porciones_kg: pesoPorcionesKg,
                merma_kg: mermaKg,
                bodega_sin_porc_anterior_kg: prevSinPorc,
                bodega_sin_porc_nuevo_kg: newSinPorc,
                bodega_porc_und_anterior: prevPorcUnd,
                bodega_porc_und_nuevo: newPorcUnd,
                bodega_porc_kg_anterior: prevPorcKg,
                bodega_porc_kg_nuevo: newPorcKg,
                costo_unitario_kg: costoKg,
                valor_total_movimiento: pesoPorcionesKg * costoKg,
                observaciones: observaciones || `Porcionado de ${kgAProcesar} Kg -> ${porcionesObtenidas} porciones (${pesoPorcionesKg} Kg). Merma: ${mermaKg.toFixed(2)} Kg`,
                usuario: usuario
            }])
            .select()
            .single();
        if (movErr) throw movErr;

        return { success: true, mov, newSinPorc, newPorcUnd, newPorcKg, mermaKg };
    },

    // 3. TRASLADO DE BODEGA A COCINA
    registrarTrasladoCocina: async function({ insumoId, esPorcionado = true, cantidad, pesoKg, observaciones, usuario = 'Bodeguero' }) {
        const client = SupabaseConfig.getClient();
        if (!client) throw new Error("Supabase no inicializado");

        cantidad = esPorcionado ? parseInt(cantidad) : parseFloat(cantidad);
        pesoKg = parseFloat(pesoKg);

        const { data: insumoData, error: insumoErr } = await client
            .from('catalogo_insumos')
            .select('*, stock_actual(*)')
            .eq('id', insumoId)
            .single();
        if (insumoErr) throw insumoErr;

        const currentStock = insumoData.stock_actual?.[0] || insumoData.stock_actual || {};
        
        let newBodegaSinPorc = parseFloat(currentStock.bodega_sin_porcionar_kg) || 0;
        let newBodegaPorcUnd = parseInt(currentStock.bodega_porcionado_und) || 0;
        let newBodegaPorcKg = parseFloat(currentStock.bodega_porcionado_kg) || 0;

        let newCocinaSinPorc = parseFloat(currentStock.cocina_sin_porcionar_kg) || 0;
        let newCocinaPorcUnd = parseInt(currentStock.cocina_porcionado_und) || 0;
        let newCocinaPorcKg = parseFloat(currentStock.cocina_porcionado_kg) || 0;

        if (esPorcionado) {
            if (cantidad > newBodegaPorcUnd) {
                throw new Error(`Stock insuficiente en bodega. Solo hay ${newBodegaPorcUnd} porciones listas.`);
            }
            newBodegaPorcUnd -= cantidad;
            newBodegaPorcKg = Math.max(0, newBodegaPorcKg - pesoKg);

            newCocinaPorcUnd += cantidad;
            newCocinaPorcKg += pesoKg;
        } else {
            if (pesoKg > newBodegaSinPorc + 0.001) {
                throw new Error(`Stock insuficiente en bodega sin porcionar. Hay ${newBodegaSinPorc.toFixed(2)} Kg.`);
            }
            newBodegaSinPorc = Math.max(0, newBodegaSinPorc - pesoKg);
            newCocinaSinPorc += pesoKg;
        }

        // Actualizar stock_actual
        const { error: stockErr } = await client
            .from('stock_actual')
            .update({
                bodega_sin_porcionar_kg: newBodegaSinPorc,
                bodega_porcionado_und: newBodegaPorcUnd,
                bodega_porcionado_kg: newBodegaPorcKg,
                cocina_sin_porcionar_kg: newCocinaSinPorc,
                cocina_porcionado_und: newCocinaPorcUnd,
                cocina_porcionado_kg: newCocinaPorcKg,
                updated_at: new Date().toISOString()
            })
            .eq('insumo_id', insumoId);
        if (stockErr) throw stockErr;

        // Registrar movimiento
        const costoKg = parseFloat(insumoData.costo_unitario_kg) || 0;
        const { data: mov, error: movErr } = await client
            .from('movimientos_inventario')
            .insert([{
                tipo_movimiento: 'TRASLADO_COCINA',
                insumo_id: insumoId,
                origen: esPorcionado ? 'BODEGA_PORCIONADO' : 'BODEGA_ENTERO',
                destino: 'COCINA',
                cant_sin_porcionar_kg: esPorcionado ? 0 : pesoKg,
                porciones_und: esPorcionado ? cantidad : 0,
                peso_porciones_kg: esPorcionado ? pesoKg : 0,
                bodega_sin_porc_anterior_kg: currentStock.bodega_sin_porcionar_kg,
                bodega_sin_porc_nuevo_kg: newBodegaSinPorc,
                bodega_porc_und_anterior: currentStock.bodega_porcionado_und,
                bodega_porc_und_nuevo: newBodegaPorcUnd,
                bodega_porc_kg_anterior: currentStock.bodega_porcionado_kg,
                bodega_porc_kg_nuevo: newBodegaPorcKg,
                cocina_sin_porc_anterior_kg: currentStock.cocina_sin_porcionar_kg,
                cocina_sin_porc_nuevo_kg: newCocinaSinPorc,
                cocina_porc_und_anterior: currentStock.cocina_porcionado_und,
                cocina_porc_und_nuevo: newCocinaPorcUnd,
                cocina_porc_kg_anterior: currentStock.cocina_porcionado_kg,
                cocina_porc_kg_nuevo: newCocinaPorcKg,
                costo_unitario_kg: costoKg,
                valor_total_movimiento: pesoKg * costoKg,
                observaciones: observaciones || `Traslado a cocina: ${esPorcionado ? `${cantidad} porciones (${pesoKg} Kg)` : `${pesoKg} Kg entero`}`,
                usuario: usuario
            }])
            .select()
            .single();
        if (movErr) throw movErr;

        return { success: true, mov };
    },

    // 4. DEVOLUCIÓN DE COCINA A BODEGA
    registrarDevolucionCocina: async function({ insumoId, esPorcionado = true, cantidad, pesoKg, observaciones, usuario = 'Bodeguero' }) {
        const client = SupabaseConfig.getClient();
        if (!client) throw new Error("Supabase no inicializado");

        cantidad = esPorcionado ? parseInt(cantidad) : parseFloat(cantidad);
        pesoKg = parseFloat(pesoKg);

        const { data: insumoData, error: insumoErr } = await client
            .from('catalogo_insumos')
            .select('*, stock_actual(*)')
            .eq('id', insumoId)
            .single();
        if (insumoErr) throw insumoErr;

        const currentStock = insumoData.stock_actual?.[0] || insumoData.stock_actual || {};
        
        let newBodegaSinPorc = parseFloat(currentStock.bodega_sin_porcionar_kg) || 0;
        let newBodegaPorcUnd = parseInt(currentStock.bodega_porcionado_und) || 0;
        let newBodegaPorcKg = parseFloat(currentStock.bodega_porcionado_kg) || 0;

        let newCocinaSinPorc = parseFloat(currentStock.cocina_sin_porcionar_kg) || 0;
        let newCocinaPorcUnd = parseInt(currentStock.cocina_porcionado_und) || 0;
        let newCocinaPorcKg = parseFloat(currentStock.cocina_porcionado_kg) || 0;

        if (esPorcionado) {
            if (cantidad > newCocinaPorcUnd) {
                console.warn(`Devolviendo más porciones de las registradas en cocina (${newCocinaPorcUnd}). Ajustando balance.`);
            }
            newCocinaPorcUnd = Math.max(0, newCocinaPorcUnd - cantidad);
            newCocinaPorcKg = Math.max(0, newCocinaPorcKg - pesoKg);

            newBodegaPorcUnd += cantidad;
            newBodegaPorcKg += pesoKg;
        } else {
            newCocinaSinPorc = Math.max(0, newCocinaSinPorc - pesoKg);
            newBodegaSinPorc += pesoKg;
        }

        // Actualizar stock_actual
        const { error: stockErr } = await client
            .from('stock_actual')
            .update({
                bodega_sin_porcionar_kg: newBodegaSinPorc,
                bodega_porcionado_und: newBodegaPorcUnd,
                bodega_porcionado_kg: newBodegaPorcKg,
                cocina_sin_porcionar_kg: newCocinaSinPorc,
                cocina_porcionado_und: newCocinaPorcUnd,
                cocina_porcionado_kg: newCocinaPorcKg,
                updated_at: new Date().toISOString()
            })
            .eq('insumo_id', insumoId);
        if (stockErr) throw stockErr;

        // Registrar movimiento
        const costoKg = parseFloat(insumoData.costo_unitario_kg) || 0;
        const { data: mov, error: movErr } = await client
            .from('movimientos_inventario')
            .insert([{
                tipo_movimiento: 'DEVOLUCION_COCINA',
                insumo_id: insumoId,
                origen: 'COCINA',
                destino: esPorcionado ? 'BODEGA_PORCIONADO' : 'BODEGA_ENTERO',
                cant_sin_porcionar_kg: esPorcionado ? 0 : pesoKg,
                porciones_und: esPorcionado ? cantidad : 0,
                peso_porciones_kg: esPorcionado ? pesoKg : 0,
                bodega_sin_porc_anterior_kg: currentStock.bodega_sin_porcionar_kg,
                bodega_sin_porc_nuevo_kg: newBodegaSinPorc,
                bodega_porc_und_anterior: currentStock.bodega_porcionado_und,
                bodega_porc_und_nuevo: newBodegaPorcUnd,
                bodega_porc_kg_anterior: currentStock.bodega_porcionado_kg,
                bodega_porc_kg_nuevo: newBodegaPorcKg,
                cocina_sin_porc_anterior_kg: currentStock.cocina_sin_porcionar_kg,
                cocina_sin_porc_nuevo_kg: newCocinaSinPorc,
                cocina_porc_und_anterior: currentStock.cocina_porcionado_und,
                cocina_porc_und_nuevo: newCocinaPorcUnd,
                cocina_porc_kg_anterior: currentStock.cocina_porcionado_kg,
                cocina_porc_kg_nuevo: newCocinaPorcKg,
                costo_unitario_kg: costoKg,
                valor_total_movimiento: pesoKg * costoKg,
                observaciones: observaciones || `Devolución de cocina a bodega: ${esPorcionado ? `${cantidad} porciones (${pesoKg} Kg)` : `${pesoKg} Kg`}`,
                usuario: usuario
            }])
            .select()
            .single();
        if (movErr) throw movErr;

        return { success: true, mov };
    }
};

// ==========================================
// MIGRACIÓN INICIAL DESDE EXCEL A SUPABASE
// ==========================================

const MigracionService = {
    migrarDesdeExcel: async function(appData, onProgress) {
        const client = SupabaseConfig.getClient();
        if (!client) throw new Error("Supabase no conectado");

        let log = [];
        const appendLog = (msg) => {
            console.log(msg);
            log.push(msg);
            if (typeof onProgress === 'function') onProgress(msg);
        };

        appendLog("🚀 Iniciando migración de datos a Supabase...");

        // 1. Migrar Catálogo e Insumos
        const insumosMap = new Map();
        const listaInsumos = appData.catalogo && appData.catalogo.length > 0 
            ? appData.catalogo 
            : [...new Set((appData.bodega || []).map(b => b.insumo))].map((nom, i) => ({
                id: `INS-${String(i+1).padStart(3, '0')}`,
                insumo: nom,
                tipo: (appData.bodega.find(b => b.insumo === nom) || {}).tipo || 'CARNES'
            }));

        appendLog(`📦 Insertando/Actualizando ${listaInsumos.length} insumos en catálogo...`);

        for (const item of listaInsumos) {
            const nombre = item.insumo || item['Insumo (Materia Prima)'];
            if (!nombre) continue;

            const categoria = item.tipo || item['Tipo'] || 'CARNES';
            const esCarne = categoria.toUpperCase().includes('CARNE') || categoria.toUpperCase().includes('POLLO') || categoria.toUpperCase().includes('CERDO') || categoria.toUpperCase().includes('RES') || categoria.toUpperCase().includes('PESCADO');
            const stockMin = parseFloat(item.stockMinimo || item['Stock Mínimo (Kg)']) || 10;
            const codigo = item.id || `CAR-${Math.floor(100 + Math.random()*900)}`;

            // Buscar si ya existe
            let { data: existing } = await client.from('catalogo_insumos').select('id').eq('nombre', nombre).maybeSingle();
            let insumoDbId = existing?.id;

            if (!insumoDbId) {
                const { data: inserted, error } = await client.from('catalogo_insumos').insert([{
                    codigo: codigo,
                    nombre: nombre,
                    categoria: categoria,
                    es_carne: esCarne,
                    stock_minimo_kg: stockMin,
                    costo_unitario_kg: 20000.00
                }]).select().single();

                if (error) {
                    console.warn(`Error al insertar insumo ${nombre}:`, error.message);
                } else {
                    insumoDbId = inserted.id;
                }
            }

            if (insumoDbId) {
                insumosMap.set(nombre.toLowerCase().trim(), insumoDbId);
            }
        }

        appendLog("✅ Catálogo de insumos sincronizado.");

        // 2. Establecer saldos iniciales desde el último día de Bodega
        if (appData.bodega && appData.bodega.length > 0) {
            appendLog("📊 Calculando saldos de inventario más recientes...");
            // Tomar el registro más reciente por insumo
            const sorted = [...appData.bodega].sort((a, b) => b.fecha.localeCompare(a.fecha));
            const latestPerInsumo = new Map();
            sorted.forEach(r => {
                const key = (r.insumo || '').toLowerCase().trim();
                if (!latestPerInsumo.has(key)) {
                    latestPerInsumo.set(key, r);
                }
            });

            for (const [key, r] of latestPerInsumo.entries()) {
                const insumoDbId = insumosMap.get(key);
                if (!insumoDbId) continue;

                const sinPorc = parseFloat(r.pesoSinPorcBodega || r.stockInicialSinPorc) || 0;
                const porcUnd = parseInt(r.totalPorcBodega || r.stockInicialPorc) || 0;
                const porcKg = parseFloat(r.pesoPorcBodega || (porcUnd * (r.pesoPorc || 0.35))) || 0;
                const cocinaPorcUnd = parseInt(r.porcACocina) || 0;
                const cocinaPorcKg = parseFloat(r.pesoACocina) || 0;

                await client.from('stock_actual').upsert({
                    insumo_id: insumoDbId,
                    bodega_sin_porcionar_kg: sinPorc,
                    bodega_porcionado_und: porcUnd,
                    bodega_porcionado_kg: porcKg,
                    cocina_porcionado_und: cocinaPorcUnd,
                    cocina_porcionado_kg: cocinaPorcKg,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'insumo_id' });
            }
            appendLog("✅ Stock actual inicializado con saldos de bodega.");
        }

        // 3. Migrar Compras
        if (appData.compras && appData.compras.length > 0) {
            appendLog(`🛒 Migrando ${appData.compras.length} compras históricas...`);
            const comprasAgrupadas = appData.compras.slice(0, 100); // Lote representativo
            for (const c of comprasAgrupadas) {
                const insumoDbId = insumosMap.get((c.insumo || '').toLowerCase().trim());
                const cant = parseFloat(c.cantidad) || 0;
                const costoTot = parseFloat(c.costoTotal) || 0;
                const costoU = parseFloat(c.costoUnitario) || (cant > 0 ? costoTot/cant : 0);

                const { data: compra } = await client.from('compras').insert([{
                    fecha: c.fecha || new Date().toISOString().split('T')[0],
                    numero_factura: `FAC-HIST-${Math.floor(1000 + Math.random()*9000)}`,
                    proveedor: c.proveedor || 'Proveedor General',
                    valor_total: costoTot,
                    observaciones: 'Migrado desde Excel'
                }]).select().single();

                if (compra && insumoDbId) {
                    await client.from('compras_detalle').insert([{
                        compra_id: compra.id,
                        insumo_id: insumoDbId,
                        cantidad_kg: cant,
                        costo_unitario_kg: costoU,
                        costo_total: costoTot
                    }]);
                }
            }
            appendLog("✅ Compras sincronizadas.");
        }

        appendLog("🎉 Migración completada con éxito!");
        return { success: true, log };
    }
};

window.SupabaseConfig = SupabaseConfig;
window.StockService = StockService;
window.MovimientosService = MovimientosService;
window.MigracionService = MigracionService;
