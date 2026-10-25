import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seedMovimientosHistoricos() {
  console.log('================================================================');
  console.log(' INGESTA Y APROBACIÓN DE MOVIMIENTOS HISTÓRICOS (02 A 23 DE SEP)');
  console.log('================================================================');

  // 1. Cargar catálogo de insumos
  const { data: catalogo, error: errCat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, tipo_medida, costo_unitario_kg, peso_estandar_porcion_kg');
  if (errCat || !catalogo) {
    console.error('Error cargando catalogo:', errCat);
    process.exit(1);
  }

  const catMap = new Map();
  catalogo.forEach(c => {
    catMap.set(c.nombre.toLowerCase().trim(), c);
  });

  // 2. Cargar periodo activo e inventario inicial
  const { data: periodo, error: errPer } = await supabase
    .from('periodos')
    .select('*')
    .eq('id', 'per-2026-09')
    .single();
  if (errPer || !periodo) {
    console.error('Error cargando periodo:', errPer);
    process.exit(1);
  }

  const stock = new Map();
  catalogo.forEach(c => {
    const ini = periodo.inventario_inicial?.[c.id] || {};
    stock.set(c.id, {
      id: c.id,
      nombre: c.nombre,
      tipo_medida: c.tipo_medida,
      peso_std: c.peso_estandar_porcion_kg || 0.35,
      costo_unit: c.costo_unitario_kg || 0,
      bSinPorc: parseFloat(ini.bodega_sin_porc_kg) || 0,
      bPorcUnd: parseInt(ini.bodega_porc_und) || 0,
      bPorcKg: parseFloat(ini.bodega_porc_kg) || 0,
      cSinPorc: parseFloat(ini.cocina_sin_porc_kg) || 0,
      cPorcUnd: parseInt(ini.cocina_porc_und) || 0,
      cPorcKg: parseFloat(ini.cocina_porc_kg) || 0,
    });
  });

  // 3. Replay de movimientos del 01-Sep (Línea Base ya aprobada)
  const { data: movs01 } = await supabase
    .from('movimientos_inventario')
    .select('*')
    .eq('fecha', '2026-09-01')
    .order('fecha_hora', { ascending: true });

  (movs01 || []).forEach(m => {
    const st = stock.get(m.insumo_id);
    if (!st) return;
    const cKg = parseFloat(m.cant_sin_porcionar_kg) || 0;
    const pUnd = parseInt(m.porciones_und) || 0;
    const pKg = parseFloat(m.peso_porciones_kg) || 0;
    const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';

    if (m.tipo_movimiento === 'ENTRADA_COMPRA' || m.tipo_movimiento === 'COMPRA') {
      if (isContable) st.bPorcUnd += (pUnd || cKg);
      else st.bSinPorc += cKg;
    } else if (m.tipo_movimiento === 'PORCIONADO') {
      st.bSinPorc = Math.max(0, st.bSinPorc - cKg);
      st.bPorcUnd += pUnd;
      st.bPorcKg += (pKg || (pUnd * st.peso_std));
    } else if (m.tipo_movimiento === 'TRASLADO_COCINA') {
      if (isContable) {
        st.bPorcUnd = Math.max(0, st.bPorcUnd - (pUnd || cKg));
      } else if (pUnd > 0) {
        const fromListas = Math.min(st.bPorcUnd, pUnd);
        const missing = pUnd - fromListas;
        const neededKg = missing > 0 ? parseFloat((missing * st.peso_std).toFixed(2)) : 0;
        st.bPorcUnd -= fromListas;
        st.bSinPorc = Math.max(0, st.bSinPorc - neededKg);
      } else if (cKg > 0) {
        st.bSinPorc = Math.max(0, st.bSinPorc - cKg);
      }
    } else if (m.tipo_movimiento === 'DEVOLUCION_COCINA') {
      if (isContable) st.bPorcUnd += (pUnd || cKg);
      else if (pUnd > 0) st.bPorcUnd += pUnd;
      else if (cKg > 0) st.bSinPorc += cKg;
    }
  });

  console.log(`Línea base al final del 01-Sep establecida con ${movs01?.length || 0} movimientos.`);

  // 4. Verificar si ya existen movimientos entre 02 y 23 Sep
  const { data: existingMovs, count: existingCount } = await supabase
    .from('movimientos_inventario')
    .select('id', { count: 'exact' })
    .gte('fecha', '2026-09-02')
    .lte('fecha', '2026-09-23');

  if (existingCount && existingCount > 0) {
    console.log(`⚠️ Se encontraron ${existingCount} movimientos previos entre 02 y 23 Sep. Limpiando para inserción limpia...`);
    const { error: delErr } = await supabase
      .from('movimientos_inventario')
      .delete()
      .gte('fecha', '2026-09-02')
      .lte('fecha', '2026-09-23');
    if (delErr) {
      console.error('Error eliminando movimientos previos:', delErr);
      process.exit(1);
    }
    console.log('✅ Rango 02 a 23 Sep limpiado con éxito.');
  }

  // 5. Leer Excel consolidado
  const wb = xlsx.readFile('./DOCUMENTOS BASE/MOVIMIENTOS_HISTORICOS_SEPTIEMBRE_2026.xlsx');
  const s = wb.Sheets['CONSOLIDADO_TODO_EL_MES'];
  const rawRows = xlsx.utils.sheet_to_json(s, { header: 1 });

  const excelMovs = [];
  for (let i = 2; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || !r[1]) continue;
    const fecha = String(r[1]).trim();
    if (fecha < '2026-09-02' || fecha > '2026-09-23') continue;

    const hora = r[2] ? String(r[2]).trim() : '12:00';
    let tipo = String(r[3]).trim();
    if (tipo === 'AJUSTE_ENTRADA') tipo = 'AJUSTE_INVENTARIO'; // Normalizar tipo

    const insumoNom = String(r[4]).trim();
    const origen = r[6] ? String(r[6]).trim() : 'BODEGA_ENTERO';
    const destino = r[7] ? String(r[7]).trim() : 'COCINA';
    const cantKg = parseFloat(r[8]) || 0;
    const porcUnd = parseInt(r[9]) || 0;
    const pesoPorcKg = parseFloat(r[10]) || 0;
    const costoUnit = parseFloat(r[11]) || 0;
    const costoTotal = parseFloat(r[12]) || 0;
    const obs = r[13] ? String(r[13]).trim() : '';

    const insumoObj = catMap.get(insumoNom.toLowerCase());
    if (!insumoObj) {
      console.error(`ERROR: Insumo "${insumoNom}" no encontrado en catálogo!`);
      process.exit(1);
    }

    excelMovs.push({
      fecha,
      hora,
      tipo,
      insumoId: insumoObj.id,
      insumoNombre: insumoObj.nombre,
      insumoObj,
      origen,
      destino,
      cantKg,
      porcUnd,
      pesoPorcKg,
      costoUnit: costoUnit || insumoObj.costo_unitario_kg || 0,
      costoTotal: costoTotal || (cantKg > 0 ? cantKg * (costoUnit || insumoObj.costo_unitario_kg || 0) : pesoPorcKg * (costoUnit || insumoObj.costo_unitario_kg || 0)),
      obs,
    });
  }

  console.log(`Movimientos leídos del Excel (02 a 23 Sep): ${excelMovs.length}`);

  // 6. Procesar día por día cronológicamente, generando ajustes estrictos cuando sea necesario
  const days = Array.from(new Set(excelMovs.map(m => m.fecha))).sort();

  const allRecordsToInsert = [];
  let totalAutoPorcCount = 0;
  let totalAdjustmentsCount = 0;
  const dayStats = [];

  for (const day of days) {
    const dayMovs = excelMovs.filter(m => m.fecha === day);

    // Orden operativo estricto:
    // 1: ENTRADA_COMPRA (ingreso de compras del proveedor)
    // 2: PORCIONADO (cortes de carne)
    // 3: DEVOLUCION_COCINA (reintegros a bodega)
    // 4: TRASLADO_COCINA (despacho a cocina para servicio)
    const orderScore = (tipo) => {
      if (tipo === 'ENTRADA_COMPRA' || tipo === 'COMPRA') return 1;
      if (tipo === 'PORCIONADO') return 2;
      if (tipo === 'DEVOLUCION_COCINA') return 3;
      if (tipo === 'TRASLADO_COCINA') return 4;
      return 5;
    };

    dayMovs.sort((a, b) => {
      const sA = orderScore(a.tipo);
      const sB = orderScore(b.tipo);
      if (sA !== sB) return sA - sB;
      return a.hora.localeCompare(b.hora);
    });

    let dayAutoPorc = 0;
    let dayAdjustments = 0;

    let timeCounter = 0;

    for (const mov of dayMovs) {
      const st = stock.get(mov.insumoId);
      const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';

      if (mov.tipo === 'ENTRADA_COMPRA' || mov.tipo === 'COMPRA') {
        const hOffset = Math.floor(timeCounter / 60);
        const mOffset = timeCounter % 60;
        const horaStr = `08:${String(mOffset).padStart(2, '0')}`;
        timeCounter += 3;

        allRecordsToInsert.push({
          fecha: day,
          fecha_hora: `${day}T${horaStr}:00.000Z`,
          tipo_movimiento: 'ENTRADA_COMPRA',
          insumo_id: mov.insumoId,
          origen: mov.origen || 'PROVEEDOR',
          destino: isContable ? 'BODEGA_PORCIONADO' : 'BODEGA_ENTERO',
          cant_sin_porcionar_kg: isContable ? 0 : mov.cantKg,
          porciones_und: isContable ? (mov.porcUnd || mov.cantKg) : 0,
          peso_porciones_kg: 0,
          merma_kg: 0,
          costo_unitario_kg: mov.costoUnit,
          valor_total_movimiento: mov.costoTotal,
          observaciones: mov.obs || `Entrada de compra ${st.nombre}`,
          usuario: 'Administrador (Histórico)'
        });

        if (isContable) {
          st.bPorcUnd += (mov.porcUnd || mov.cantKg);
        } else {
          st.bSinPorc += mov.cantKg;
        }

      } else if (mov.tipo === 'PORCIONADO') {
        // Verificar si hay suficiente carne entera en bodega para porcionar
        if (st.bSinPorc < mov.cantKg) {
          const neededKg = parseFloat((mov.cantKg - st.bSinPorc).toFixed(2));
          dayAdjustments++;
          totalAdjustmentsCount++;

          // Inyectar ajuste justo antes del porcionado
          allRecordsToInsert.push({
            fecha: day,
            fecha_hora: `${day}T07:15:00.000Z`,
            tipo_movimiento: 'AJUSTE_INVENTARIO',
            insumo_id: mov.insumoId,
            origen: 'AJUSTE_ENTRADA',
            destino: 'BODEGA_ENTERO',
            cant_sin_porcionar_kg: neededKg,
            porciones_und: 0,
            peso_porciones_kg: 0,
            merma_kg: 0,
            costo_unitario_kg: mov.costoUnit,
            valor_total_movimiento: Math.round(neededKg * mov.costoUnit),
            observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_ENTERO | Motivo: Conciliación automática para porcionado de jornada ${day} (Faltante ${neededKg} Kg)`,
            usuario: 'Administrador (Auto)'
          });
          st.bSinPorc += neededKg;
        }

        const horaStr = `09:${String(timeCounter % 60).padStart(2, '0')}`;
        timeCounter += 3;

        allRecordsToInsert.push({
          fecha: day,
          fecha_hora: `${day}T${horaStr}:00.000Z`,
          tipo_movimiento: 'PORCIONADO',
          insumo_id: mov.insumoId,
          origen: 'BODEGA_ENTERO',
          destino: 'BODEGA_PORCIONADO',
          cant_sin_porcionar_kg: mov.cantKg,
          porciones_und: mov.porcUnd,
          peso_porciones_kg: mov.pesoPorcKg || parseFloat((mov.porcUnd * st.peso_std).toFixed(2)),
          merma_kg: Math.max(0, parseFloat((mov.cantKg - (mov.pesoPorcKg || (mov.porcUnd * st.peso_std))).toFixed(2))),
          costo_unitario_kg: mov.costoUnit,
          valor_total_movimiento: mov.costoTotal,
          observaciones: mov.obs || `Porcionado de ${st.nombre}`,
          usuario: 'Administrador (Histórico)'
        });

        st.bSinPorc = Math.max(0, parseFloat((st.bSinPorc - mov.cantKg).toFixed(2)));
        st.bPorcUnd += mov.porcUnd;
        st.bPorcKg += (mov.pesoPorcKg || (mov.porcUnd * st.peso_std));

      } else if (mov.tipo === 'DEVOLUCION_COCINA') {
        const horaStr = `10:${String(timeCounter % 60).padStart(2, '0')}`;
        timeCounter += 3;

        allRecordsToInsert.push({
          fecha: day,
          fecha_hora: `${day}T${horaStr}:00.000Z`,
          tipo_movimiento: 'DEVOLUCION_COCINA',
          insumo_id: mov.insumoId,
          origen: 'COCINA',
          destino: isContable ? 'BODEGA_PORCIONADO' : (mov.porcUnd > 0 ? 'BODEGA_PORCIONADO' : 'BODEGA_ENTERO'),
          cant_sin_porcionar_kg: (!isContable && mov.porcUnd === 0) ? mov.cantKg : 0,
          porciones_und: isContable ? (mov.porcUnd || mov.cantKg) : mov.porcUnd,
          peso_porciones_kg: (!isContable && mov.porcUnd > 0) ? (mov.pesoPorcKg || parseFloat((mov.porcUnd * st.peso_std).toFixed(2))) : 0,
          merma_kg: 0,
          costo_unitario_kg: mov.costoUnit,
          valor_total_movimiento: mov.costoTotal,
          observaciones: mov.obs || `Devolución de cocina ${st.nombre}`,
          usuario: 'Administrador (Histórico)'
        });

        if (isContable) {
          st.bPorcUnd += (mov.porcUnd || mov.cantKg);
        } else if (mov.porcUnd > 0) {
          st.bPorcUnd += mov.porcUnd;
          st.bPorcKg += (mov.pesoPorcKg || (mov.porcUnd * st.peso_std));
        } else if (mov.cantKg > 0) {
          st.bSinPorc += mov.cantKg;
        }

      } else if (mov.tipo === 'TRASLADO_COCINA') {
        if (isContable) {
          const req = mov.porcUnd || mov.cantKg;
          if (st.bPorcUnd < req) {
            const neededUnd = req - st.bPorcUnd;
            dayAdjustments++;
            totalAdjustmentsCount++;

            allRecordsToInsert.push({
              fecha: day,
              fecha_hora: `${day}T07:20:00.000Z`,
              tipo_movimiento: 'AJUSTE_INVENTARIO',
              insumo_id: mov.insumoId,
              origen: 'AJUSTE_ENTRADA',
              destino: 'BODEGA_PORCIONADO',
              cant_sin_porcionar_kg: 0,
              porciones_und: neededUnd,
              peso_porciones_kg: 0,
              merma_kg: 0,
              costo_unitario_kg: mov.costoUnit,
              valor_total_movimiento: Math.round(neededUnd * mov.costoUnit),
              observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_PORCIONADO | Motivo: Conciliación automática para traslado de jornada ${day} (Faltante ${neededUnd} und)`,
              usuario: 'Administrador (Auto)'
            });
            st.bPorcUnd += neededUnd;
          }
          st.bPorcUnd -= req;

        } else if (mov.porcUnd > 0) {
          // Traslado de porciones
          const availablePorc = st.bPorcUnd;
          if (availablePorc >= mov.porcUnd) {
            // Se cubre 100% de porciones listas
            st.bPorcUnd -= mov.porcUnd;
            st.bPorcKg = Math.max(0, parseFloat((st.bPorcKg - (mov.pesoPorcKg || (mov.porcUnd * st.peso_std))).toFixed(2)));
          } else {
            // Tomamos las disponibles
            const fromPorc = availablePorc;
            const missingPorc = mov.porcUnd - fromPorc;
            st.bPorcUnd = 0;
            st.bPorcKg = 0;

            // Revisamos si en carne entera en bodega alcanza para auto-porcionar
            const neededKg = parseFloat((missingPorc * st.peso_std).toFixed(2));
            if (st.bSinPorc >= neededKg) {
              // Alcanza en entero! Se auto-porciona
              st.bSinPorc = parseFloat((st.bSinPorc - neededKg).toFixed(2));
              dayAutoPorc++;
              totalAutoPorcCount++;
            } else {
              // No alcanza en entero completamente
              const coveredByEntero = st.bSinPorc;
              const coveredUndByEntero = Math.floor(coveredByEntero / st.peso_std);
              const remainingUnd = missingPorc - coveredUndByEntero;
              st.bSinPorc = Math.max(0, parseFloat((st.bSinPorc - (coveredUndByEntero * st.peso_std)).toFixed(2)));

              if (coveredUndByEntero > 0) {
                dayAutoPorc++;
                totalAutoPorcCount++;
              }

              // Ajustamos el faltante real
              dayAdjustments++;
              totalAdjustmentsCount++;
              const adjKg = parseFloat((remainingUnd * st.peso_std).toFixed(2));

              allRecordsToInsert.push({
                fecha: day,
                fecha_hora: `${day}T07:25:00.000Z`,
                tipo_movimiento: 'AJUSTE_INVENTARIO',
                insumo_id: mov.insumoId,
                origen: 'AJUSTE_ENTRADA',
                destino: 'BODEGA_PORCIONADO',
                cant_sin_porcionar_kg: 0,
                porciones_und: remainingUnd,
                peso_porciones_kg: adjKg,
                merma_kg: 0,
                costo_unitario_kg: mov.costoUnit,
                valor_total_movimiento: Math.round(adjKg * mov.costoUnit),
                observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_PORCIONADO | Motivo: Conciliación automática para traslado de jornada ${day} (Faltante ${remainingUnd} porciones)`,
                usuario: 'Administrador (Auto)'
              });
            }
          }
        } else if (mov.cantKg > 0) {
          // Traslado en Kg entero
          if (st.bSinPorc < mov.cantKg) {
            const neededKg = parseFloat((mov.cantKg - st.bSinPorc).toFixed(2));
            dayAdjustments++;
            totalAdjustmentsCount++;

            allRecordsToInsert.push({
              fecha: day,
              fecha_hora: `${day}T07:30:00.000Z`,
              tipo_movimiento: 'AJUSTE_INVENTARIO',
              insumo_id: mov.insumoId,
              origen: 'AJUSTE_ENTRADA',
              destino: 'BODEGA_ENTERO',
              cant_sin_porcionar_kg: neededKg,
              porciones_und: 0,
              peso_porciones_kg: 0,
              merma_kg: 0,
              costo_unitario_kg: mov.costoUnit,
              valor_total_movimiento: Math.round(neededKg * mov.costoUnit),
              observaciones: `[AJUSTE: ERROR_CONTEO_PREVIO] Ubicación: BODEGA_ENTERO | Motivo: Conciliación automática para traslado entero de jornada ${day} (Faltante ${neededKg} Kg)`,
              usuario: 'Administrador (Auto)'
            });
            st.bSinPorc += neededKg;
          }
          st.bSinPorc = parseFloat((st.bSinPorc - mov.cantKg).toFixed(2));
        }

        const horaStr = `11:${String(timeCounter % 60).padStart(2, '0')}`;
        timeCounter += 2;

        allRecordsToInsert.push({
          fecha: day,
          fecha_hora: `${day}T${horaStr}:00.000Z`,
          tipo_movimiento: 'TRASLADO_COCINA',
          insumo_id: mov.insumoId,
          origen: isContable ? 'BODEGA_PORCIONADO' : (mov.porcUnd > 0 ? 'BODEGA_PORCIONADO' : 'BODEGA_ENTERO'),
          destino: 'COCINA',
          cant_sin_porcionar_kg: (!isContable && mov.porcUnd === 0) ? mov.cantKg : 0,
          porciones_und: isContable ? (mov.porcUnd || mov.cantKg) : mov.porcUnd,
          peso_porciones_kg: (!isContable && mov.porcUnd > 0) ? (mov.pesoPorcKg || parseFloat((mov.porcUnd * st.peso_std).toFixed(2))) : 0,
          merma_kg: 0,
          costo_unitario_kg: mov.costoUnit,
          valor_total_movimiento: mov.costoTotal,
          observaciones: mov.obs || `Traslado a cocina ${st.nombre}`,
          usuario: 'Administrador (Histórico)'
        });

      } else if (mov.tipo === 'AJUSTE_INVENTARIO') {
        // Registro especial de ajuste existente en el Excel (ej. Cordon Blue)
        const horaStr = `07:45:00.000Z`;
        allRecordsToInsert.push({
          fecha: day,
          fecha_hora: `${day}T${horaStr}`,
          tipo_movimiento: 'AJUSTE_INVENTARIO',
          insumo_id: mov.insumoId,
          origen: mov.origen || 'AJUSTE_ENTRADA',
          destino: mov.destino || 'BODEGA_PORCIONADO',
          cant_sin_porcionar_kg: mov.cantKg,
          porciones_und: mov.porcUnd,
          peso_porciones_kg: mov.pesoPorcKg,
          merma_kg: 0,
          costo_unitario_kg: mov.costoUnit,
          valor_total_movimiento: mov.costoTotal,
          observaciones: mov.obs || `Ajuste operativo ${st.nombre}`,
          usuario: 'Administrador (Histórico)'
        });

        if (mov.destino?.includes('PORCIONADO')) {
          st.bPorcUnd += mov.porcUnd;
          st.bPorcKg += (mov.pesoPorcKg || (mov.porcUnd * st.peso_std));
        } else {
          st.bSinPorc += mov.cantKg;
        }
      }
    }

    dayStats.push({
      fecha: day,
      movsExcel: dayMovs.length,
      autoPorc: dayAutoPorc,
      ajustes: dayAdjustments
    });
  }

  console.log(`\nPreparados ${allRecordsToInsert.length} movimientos finales para insertar.`);
  console.log(`- Movimientos históricos originales: ${excelMovs.length}`);
  console.log(`- Auto-porcionados resueltos con carne entera en bodega: ${totalAutoPorcCount}`);
  console.log(`- Ajustes necesarios generados: ${totalAdjustmentsCount}`);

  // 7. Insertar en lotes de 50 en Supabase
  console.log('\nIniciando inserción en Supabase en lotes de 50...');
  const batchSize = 50;
  for (let i = 0; i < allRecordsToInsert.length; i += batchSize) {
    const chunk = allRecordsToInsert.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from('movimientos_inventario').insert(chunk);
    if (insErr) {
      console.error(`Error en lote ${i} a ${i + chunk.length}:`, insErr);
      process.exit(1);
    }
    process.stdout.write(`✅ Insertados ${Math.min(i + batchSize, allRecordsToInsert.length)} / ${allRecordsToInsert.length} movimientos...\r`);
  }
  console.log('\n🎉 Todos los movimientos fueron insertados exitosamente en Supabase!');

  // 8. Verificaciones de integridad
  console.log('\n--- VERIFICACIÓN DE INTEGRIDAD EN SUPABASE ---');

  // A. Movimientos entre 02 y 23 de Sep
  const { data: verifMovs, count: verifCount } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha, observaciones', { count: 'exact' })
    .gte('fecha', '2026-09-02')
    .lte('fecha', '2026-09-23');

  const pendingInRange = (verifMovs || []).filter(m => (m.observaciones || '').includes('[PENDIENTE_APROBAR]'));
  console.log(`Movimientos en BD entre 02 y 23 Sep: ${verifCount}`);
  console.log(`Movimientos pendientes en ese rango: ${pendingInRange.length} (Debe ser estrictamente 0)`);

  // B. Movimientos pendientes en 29 y 30 de Sep
  const { data: pendingAll, count: pendTotal } = await supabase
    .from('movimientos_inventario')
    .select('id, fecha, observaciones', { count: 'exact' })
    .ilike('observaciones', '%[PENDIENTE_APROBAR]%');

  const pendByDate = {};
  (pendingAll || []).forEach(p => pendByDate[p.fecha] = (pendByDate[p.fecha] || 0) + 1);
  console.log(`Total movimientos pendientes en el sistema: ${pendTotal}`);
  console.log('Distribución de pendientes por fecha:', pendByDate);

  console.log('\n--- DETALLE DIARIO DE LA INGESTA ---');
  console.table(dayStats);
}

seedMovimientosHistoricos().catch(err => {
  console.error('Error fatal durante la ingesta:', err);
  process.exit(1);
});
