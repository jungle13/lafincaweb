const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient('https://uexqmrspulhauubzrwyn.supabase.co', 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO');

async function recalibrate() {
  const periodosData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'periodos.json'), 'utf8'));
  const activePeriodo = periodosData.find(p => p.id === 'per-2026-09') || periodosData[0];
  const initialMap = activePeriodo.inventario_inicial || {};

  console.log(`Recalibrando para periodo: ${activePeriodo.nombre} (${activePeriodo.fecha_inicio} a ${activePeriodo.fecha_fin})...`);

  const { data: catalogo } = await supabase.from('catalogo_insumos').select('*').order('nombre');
  if (!catalogo) return console.error('No se pudo cargar catalogo');

  let allMovs = [];
  let from = 0;
  const step = 1000;
  while (true) {
    let query = supabase.from('movimientos_inventario').select('*')
      .order('fecha', { ascending: true })
      .order('fecha_hora', { ascending: true })
      .range(from, from + step - 1);

    if (activePeriodo.fecha_inicio) query = query.gte('fecha', activePeriodo.fecha_inicio);
    if (activePeriodo.fecha_fin) query = query.lte('fecha', activePeriodo.fecha_fin);

    const { data: movs, error: movErr } = await query;
    if (movErr || !movs || movs.length === 0) break;
    allMovs = allMovs.concat(movs);
    if (movs.length < step) break;
    from += step;
  }

  const approvedMovs = allMovs.filter((m) => {
    const isPending = m.observaciones && m.observaciones.includes('[PENDIENTE_APROBAR]');
    if (isPending) return false;
    if (m.tipo_movimiento === 'INVENTARIO_INICIAL') return false;
    return true;
  });

  console.log(`Total movimientos aprobados en el periodo: ${approvedMovs.length}`);

  const stockMap = {};
  catalogo.forEach((c) => {
    const init = initialMap[c.id] || {};
    const pesoStd = Number(c.peso_estandar_porcion_kg) || 0.35;
    const bSin = Number(init.bodega_sin_porc_kg) || 0;
    const bUnd = Number(init.bodega_porc_und) || 0;
    const bKg = Number(init.bodega_porc_kg) || (bUnd * pesoStd);

    const cSin = Number(init.cocina_sin_porc_kg) || 0;
    const cUnd = Number(init.cocina_porc_und) || 0;
    const cKg = Number(init.cocina_porc_kg) || (cUnd * pesoStd);

    stockMap[c.id] = {
      insumo_id: c.id,
      peso_std: pesoStd,
      bSinPorc: bSin,
      bPorcUnd: bUnd,
      bPorcKg: bKg,
      cSinPorc: cSin,
      cPorcUnd: cUnd,
      cPorcKg: cKg,
    };
  });

  approvedMovs.forEach((m) => {
    const st = stockMap[m.insumo_id];
    if (!st) return;

    const cantKg = Number(m.cant_sin_porcionar_kg) || 0;
    const porcUnd = Number(m.porciones_und) || 0;
    const porcKg = Number(m.peso_porciones_kg) || (porcUnd * st.peso_std);
    const tipo = (m.tipo_movimiento || '').toUpperCase();
    const origen = (m.origen || '').toUpperCase();
    const destino = (m.destino || '').toUpperCase();

    if (tipo === 'ENTRADA_COMPRA' || tipo === 'COMPRA' || tipo === 'ENTRADA') {
      if (destino.includes('PORCIONADO') || porcUnd > 0) {
        st.bPorcUnd += porcUnd;
        st.bPorcKg += (porcKg || (porcUnd * st.peso_std));
      } else {
        st.bSinPorc += cantKg;
      }
    } else if (tipo === 'PORCIONADO') {
      st.bSinPorc = Math.max(0, st.bSinPorc - cantKg);
      st.bPorcUnd += porcUnd;
      st.bPorcKg += (porcKg || (porcUnd * st.peso_std));
    } else if (tipo === 'TRASLADO_COCINA' || tipo === 'TRASLADO_A_COCINA' || tipo === 'TRASLADO') {
      if (porcUnd > 0) {
        const u = porcUnd;
        const k = porcKg || (u * st.peso_std);
        st.bPorcUnd = Math.max(0, st.bPorcUnd - u);
        st.bPorcKg = Math.max(0, st.bPorcKg - k);
        st.cPorcUnd += u;
        st.cPorcKg += k;
      } else if (cantKg > 0) {
        st.bSinPorc = Math.max(0, st.bSinPorc - cantKg);
        st.cSinPorc += cantKg;
      }
    } else if (tipo === 'DEVOLUCION_COCINA' || tipo === 'DEVOLUCION_A_BODEGA') {
      if (porcUnd > 0) {
        const u = porcUnd;
        const k = porcKg || (u * st.peso_std);
        st.cPorcUnd = Math.max(0, st.cPorcUnd - u);
        st.cPorcKg = Math.max(0, st.cPorcKg - k);
        st.bPorcUnd += u;
        st.bPorcKg += k;
      } else if (cantKg > 0) {
        st.cSinPorc = Math.max(0, st.cSinPorc - cantKg);
        st.bSinPorc += cantKg;
      }
    }
  });

  const nowIso = new Date().toISOString();
  const upsertRows = Object.values(stockMap).map((st) => ({
    insumo_id: st.insumo_id,
    bodega_sin_porcionar_kg: Number(st.bSinPorc.toFixed(2)),
    bodega_porcionado_und: Math.round(st.bPorcUnd),
    bodega_porcionado_kg: Number(st.bPorcKg.toFixed(2)),
    cocina_sin_porcionar_kg: Number(st.cSinPorc.toFixed(2)),
    cocina_porcionado_und: Math.round(st.cPorcUnd),
    cocina_porcionado_kg: Number(st.cPorcKg.toFixed(2)),
    updated_at: nowIso,
  }));

  for (let i = 0; i < upsertRows.length; i += 50) {
    const chunk = upsertRows.slice(i, i + 50);
    const { error: upErr } = await supabase.from('stock_actual').upsert(chunk, { onConflict: 'insumo_id' });
    if (upErr) console.error('Error al actualizar chunk stock_actual:', upErr);
  }

  console.log('✅ Recalibración completada y sincronizada en stock_actual.');
}

recalibrate();
