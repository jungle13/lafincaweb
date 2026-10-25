import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function simulate() {
  console.log('--- Iniciando Simulación de Ingesta Histórica (02 a 23 Sep) ---');

  // 1. Cargar catálogo de insumos
  const { data: catalogo, error: errCat } = await supabase
    .from('catalogo_insumos')
    .select('id, codigo, nombre, categoria, tipo_medida, costo_unitario_kg, peso_estandar_porcion_kg');
  if (errCat || !catalogo) throw errCat;

  const catMap = new Map();
  catalogo.forEach(c => {
    catMap.set(c.nombre.toLowerCase().trim(), c);
  });

  // 2. Cargar periodo y saldo inicial
  const { data: periodo } = await supabase.from('periodos').select('*').eq('id', 'per-2026-09').single();
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
    });
  });

  // 3. Aplicar movimientos del 01-Sep (Línea Base ya aprobada)
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

  console.log('Stock listo al final de 01-Sep. Leyendo Excel...');

  // 4. Leer Excel de movimientos históricos
  const wb = xlsx.readFile('./DOCUMENTOS BASE/MOVIMIENTOS_HISTORICOS_SEPTIEMBRE_2026.xlsx');
  const s = wb.Sheets['CONSOLIDADO_TODO_EL_MES'];
  const rawRows = xlsx.utils.sheet_to_json(s, { header: 1 });

  // Filas de datos (saltando filas 0 y 1 de cabecera)
  const excelMovs = [];
  for (let i = 2; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || !r[1]) continue;
    const fecha = String(r[1]).trim();
    if (fecha < '2026-09-02' || fecha > '2026-09-23') continue;

    const hora = r[2] ? String(r[2]).trim() : '12:00';
    const tipo = String(r[3]).trim();
    const insumoNom = String(r[4]).trim();
    const origen = r[6] ? String(r[6]).trim() : '';
    const destino = r[7] ? String(r[7]).trim() : '';
    const cantKg = parseFloat(r[8]) || 0;
    const porcUnd = parseInt(r[9]) || 0;
    const pesoPorcKg = parseFloat(r[10]) || 0;
    const costoUnit = parseFloat(r[11]) || 0;
    const costoTotal = parseFloat(r[12]) || 0;
    const obs = r[13] ? String(r[13]).trim() : '';

    const insumoObj = catMap.get(insumoNom.toLowerCase());
    if (!insumoObj) {
      console.error(`ERROR: Insumo "${insumoNom}" no encontrado en catálogo!`);
      continue;
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
      costoTotal,
      obs,
    });
  }

  console.log(`Total movimientos leídos del Excel (02 a 23 Sep): ${excelMovs.length}`);

  // Agrupar por fecha
  const days = Array.from(new Set(excelMovs.map(m => m.fecha))).sort();

  let totalAdjustments = 0;
  let totalAutoPorcionados = 0;
  const adjustmentsSummary = [];

  for (const day of days) {
    const dayMovs = excelMovs.filter(m => m.fecha === day);

    // Prioridad operativa dentro del mismo día:
    // 1: ENTRADA_COMPRA
    // 2: PORCIONADO
    // 3: DEVOLUCION_COCINA
    // 4: TRASLADO_COCINA
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

    let dayAdjustments = 0;
    let dayAutoPorc = 0;

    for (const mov of dayMovs) {
      const st = stock.get(mov.insumoId);
      const isContable = st.tipo_medida === 'UNIDADES' || st.tipo_medida === 'PAQUETES';

      if (mov.tipo === 'ENTRADA_COMPRA' || mov.tipo === 'COMPRA') {
        if (isContable) {
          st.bPorcUnd += (mov.porcUnd || mov.cantKg);
        } else {
          st.bSinPorc += mov.cantKg;
        }
      } else if (mov.tipo === 'PORCIONADO') {
        if (st.bSinPorc < mov.cantKg) {
          const neededKg = parseFloat((mov.cantKg - st.bSinPorc).toFixed(2));
          dayAdjustments++;
          adjustmentsSummary.push({
            fecha: day,
            insumo: st.nombre,
            tipo: 'BODEGA_ENTERO',
            faltante: `${neededKg} Kg`,
            motivo: `Faltante para porcionado de ${mov.cantKg} Kg`
          });
          st.bSinPorc += neededKg;
        }
        st.bSinPorc = Math.max(0, parseFloat((st.bSinPorc - mov.cantKg).toFixed(2)));
        st.bPorcUnd += mov.porcUnd;
        st.bPorcKg += (mov.pesoPorcKg || (mov.porcUnd * st.peso_std));
      } else if (mov.tipo === 'DEVOLUCION_COCINA') {
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
            adjustmentsSummary.push({
              fecha: day,
              insumo: st.nombre,
              tipo: 'BODEGA_PORCIONADO',
              faltante: `${neededUnd} und`,
              motivo: `Faltante para traslado de ${req} und`
            });
            st.bPorcUnd += neededUnd;
          }
          st.bPorcUnd -= req;
        } else if (mov.porcUnd > 0) {
          // Traslado de porciones de carne
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

            // Revisamos si en entero (Kg) alcanza para auto-porcionar
            const neededKg = parseFloat((missingPorc * st.peso_std).toFixed(2));
            if (st.bSinPorc >= neededKg) {
              // Alcanza en entero! El sistema lo auto-porciona
              st.bSinPorc = parseFloat((st.bSinPorc - neededKg).toFixed(2));
              dayAutoPorc++;
            } else {
              // No alcanza ni en porcionado ni en entero!
              // Usamos lo que haya en entero
              const coveredByEntero = st.bSinPorc;
              const coveredUndByEntero = Math.floor(coveredByEntero / st.peso_std);
              const remainingUnd = missingPorc - coveredUndByEntero;
              st.bSinPorc = Math.max(0, parseFloat((st.bSinPorc - (coveredUndByEntero * st.peso_std)).toFixed(2)));

              if (coveredUndByEntero > 0) dayAutoPorc++;

              // Ajustamos el faltante real
              dayAdjustments++;
              adjustmentsSummary.push({
                fecha: day,
                insumo: st.nombre,
                tipo: 'BODEGA_PORCIONADO',
                faltante: `${remainingUnd} und (${(remainingUnd * st.peso_std).toFixed(2)} Kg)`,
                motivo: `Faltante real para traslado a cocina de ${mov.porcUnd} porciones`
              });
            }
          }
        } else if (mov.cantKg > 0) {
          // Traslado en Kg entero
          if (st.bSinPorc < mov.cantKg) {
            const neededKg = parseFloat((mov.cantKg - st.bSinPorc).toFixed(2));
            dayAdjustments++;
            adjustmentsSummary.push({
              fecha: day,
              insumo: st.nombre,
              tipo: 'BODEGA_ENTERO',
              faltante: `${neededKg} Kg`,
              motivo: `Faltante para traslado de ${mov.cantKg} Kg`
            });
            st.bSinPorc += neededKg;
          }
          st.bSinPorc = parseFloat((st.bSinPorc - mov.cantKg).toFixed(2));
        }
      }
    }

    totalAdjustments += dayAdjustments;
    totalAutoPorcionados += dayAutoPorc;
    console.log(`Día ${day}: ${dayMovs.length} movs | Auto-porcionados: ${dayAutoPorc} | Ajustes requeridos: ${dayAdjustments}`);
  }

  console.log('\n--- RESUMEN DE SIMULACIÓN ---');
  console.log(`Días simulados: ${days.length}`);
  console.log(`Movimientos originales: ${excelMovs.length}`);
  console.log(`Auto-porcionados resueltos con carne entera en bodega: ${totalAutoPorcionados}`);
  console.log(`Ajustes estrictamente necesarios generados: ${totalAdjustments}`);
}

simulate().catch(console.error);
