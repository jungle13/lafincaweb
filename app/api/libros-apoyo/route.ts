import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  obtenerDatosLibroCaja,
  recalcularHojaDiaria,
  extractResponsableFromSoporte,
} from '@/services/libroCajaService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodoId = searchParams.get('periodo_id') || 'per-2026-10';
    const tipoLibro = searchParams.get('tipo_libro') || 'CAJA_MENOR';

    const data = await obtenerDatosLibroCaja(periodoId, tipoLibro);

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error('[GET /api/libros-apoyo] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error cargando Libro de Caja Menor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 0. Autenticar Usuario de Caja / Administradora
    if (action === 'LOGIN_CAJERO') {
      const { username = '', password_pin = '' } = body;
      const cleanUser = String(username).trim().toLowerCase();
      const cleanPin = String(password_pin).trim();

      const { data: user, error } = await supabase
        .from('libro_caja_usuarios')
        .select('*')
        .eq('username', cleanUser)
        .eq('password_pin', cleanPin)
        .eq('activo', true)
        .maybeSingle();

      if (error) throw error;
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Usuario o contraseña incorrectos. Verifica tus credenciales.' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        usuario: {
          id: user.id,
          username: user.username,
          nombre_cajero: user.nombre_cajero,
          rol: user.rol,
          caja_predeterminada: user.caja_predeterminada,
        },
      });
    }

    // 1. Abrir Flujo de Caja o Recibir Turno tras Cierre Parcial (1 solo flujo por día)
    if (action === 'OPEN_FLUJO_CAJA') {
      const {
        fecha,
        caja_nombre = 'CAJA PRINCIPAL',
        cajero_nombre = 'JOHANNA',
        usuario_username = 'johanna',
        efectivo_inicial = 200000,
        tipo_libro = 'CAJA_MENOR',
      } = body;

      if (!fecha) {
        return NextResponse.json(
          { success: false, error: 'La fecha es obligatoria para abrir o recibir el flujo de caja' },
          { status: 400 }
        );
      }

      const cleanUsername = String(usuario_username || cajero_nombre).toLowerCase().trim();
      const cleanCajero = String(cajero_nombre).toUpperCase().trim();

      // Consultar todas las sesiones de ese día ordenadas por turno
      const { data: sesionesDia, error: errSes } = await supabase
        .from('libro_caja_sesiones')
        .select('*')
        .eq('fecha', fecha)
        .order('numero_turno', { ascending: true })
        .order('hora_apertura', { ascending: true });

      if (errSes) throw errSes;
      const listaSesiones = sesionesDia || [];

      // Verificar si ya hay una sesión ABIERTA en este día
      const sesionAbierta = listaSesiones.find((s: any) => s.estado === 'ABIERTA');
      if (sesionAbierta) {
        if (
          sesionAbierta.usuario_username?.toLowerCase() !== cleanUsername &&
          sesionAbierta.cajero_nombre?.toUpperCase() !== cleanCajero
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `El Flujo de Caja del día ${fecha} ya está ABIERTO y en uso por ${sesionAbierta.cajero_nombre}. Para que puedas ingresar y recibir el turno, ${sesionAbierta.cajero_nombre} debe realizar primero un Cierre Parcial.`,
            },
            { status: 409 }
          );
        }

        // Si es del mismo usuario que ya lo tiene abierto, retornar su sesión activa
        return NextResponse.json({
          success: true,
          sesion: sesionAbierta,
          resumed: true,
        });
      }

      // Verificar si el flujo del día ya tuvo un CIERRE TOTAL definitivo
      const sesionCierreTotal = listaSesiones.find(
        (s: any) => s.estado === 'CERRADA_TOTAL' || s.estado === 'CERRADA' || (s.estado !== 'ABIERTA' && s.tipo_cierre === 'TOTAL')
      );
      if (sesionCierreTotal) {
        return NextResponse.json(
          {
            success: false,
            error: `El Flujo de Caja del día ${fecha} ya fue CERRADO TOTALMENTE por ${sesionCierreTotal.cajero_nombre}. No se pueden abrir más turnos ni ingresar egresos regulares (solo ajustes si eres el titular o administrador).`,
          },
          { status: 409 }
        );
      }

      // Si no hay sesiones (Turno 1) o la última sesión está en CERRADA_PARCIAL (Relevo de Turno N+1)
      const siguienteTurno = listaSesiones.length + 1;

      const { data: nuevaSesion, error: errInsert } = await supabase
        .from('libro_caja_sesiones')
        .insert({
          fecha,
          caja_nombre: caja_nombre || 'CAJA PRINCIPAL',
          cajero_nombre: cleanCajero,
          usuario_username: cleanUsername,
          efectivo_inicial: Number(efectivo_inicial || 0),
          efectivo_cierre: 0,
          valor_datafonos: 0,
          total_salidas: 0,
          total_ajustes: 0,
          estado: 'ABIERTA',
          numero_turno: siguienteTurno,
          tipo_cierre: 'PARCIAL',
        })
        .select('*')
        .single();

      if (errInsert) throw errInsert;

      await recalcularHojaDiaria(fecha, tipo_libro);

      return NextResponse.json({
        success: true,
        sesion: nuevaSesion,
        numero_turno: siguienteTurno,
      });
    }

    // 2. Cerrar Flujo de Caja: soporta CIERRE PARCIAL (solo efectivo, cambio de turno) o CIERRE TOTAL (efectivo + datáfonos + revela POS)
    if (action === 'CLOSE_FLUJO_CAJA') {
      const {
        sesion_id,
        fecha,
        usuario_username,
        cajero_nombre,
        is_admin = false,
        tipo_cierre = 'TOTAL', // 'PARCIAL' | 'TOTAL'
        efectivo_cierre = 0,
        valor_datafonos = 0,
        observaciones = '',
        tipo_libro = 'CAJA_MENOR',
      } = body;

      // Buscar la sesión abierta que se desea cerrar
      let targetSesion: any = null;
      if (sesion_id) {
        const { data } = await supabase
          .from('libro_caja_sesiones')
          .select('*')
          .eq('id', sesion_id)
          .maybeSingle();
        targetSesion = data;
      } else if (fecha) {
        const { data } = await supabase
          .from('libro_caja_sesiones')
          .select('*')
          .eq('fecha', fecha)
          .eq('estado', 'ABIERTA')
          .maybeSingle();
        targetSesion = data;
      }

      if (!targetSesion) {
        return NextResponse.json(
          { success: false, error: 'No se encontró una sesión abierta para cerrar en esta fecha.' },
          { status: 404 }
        );
      }

      // Validar que solo el dueño de la sesión abierta (o Admin) pueda cerrarla
      const reqUser = String(usuario_username || '').toLowerCase().trim();
      const reqCajero = String(cajero_nombre || '').toUpperCase().trim();
      const isOwner =
        (reqUser && targetSesion.usuario_username?.toLowerCase() === reqUser) ||
        (reqCajero && targetSesion.cajero_nombre?.toUpperCase() === reqCajero);

      if (!is_admin && !isOwner) {
        return NextResponse.json(
          {
            success: false,
            error: `Solo ${targetSesion.cajero_nombre} (quien abrió este turno) o un Administrador puede realizar el cierre de esta sesión.`,
          },
          { status: 403 }
        );
      }

      const esParcial = String(tipo_cierre).toUpperCase() === 'PARCIAL';
      const nuevoEstado = esParcial ? 'CERRADA_PARCIAL' : 'CERRADA_TOTAL';

      const { data: updatedSesion, error } = await supabase
        .from('libro_caja_sesiones')
        .update({
          efectivo_cierre: Number(efectivo_cierre || 0),
          valor_datafonos: esParcial ? 0 : Number(valor_datafonos || 0),
          estado: nuevoEstado,
          tipo_cierre: esParcial ? 'PARCIAL' : 'TOTAL',
          hora_cierre: new Date().toISOString(),
          observaciones: observaciones
            ? `[CIERRE ${esParcial ? 'PARCIAL' : 'TOTAL'}] ${observaciones}`
            : `Cierre ${esParcial ? 'Parcial (Entrega de Turno)' : 'Total del Día'}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetSesion.id)
        .select('*')
        .single();

      if (error) throw error;

      const targetFecha = fecha || updatedSesion?.fecha;
      if (targetFecha) {
        await recalcularHojaDiaria(targetFecha, tipo_libro);
      }

      return NextResponse.json({
        success: true,
        sesion: updatedSesion,
      });
    }

    // 3. Reabrir Flujo de Caja (Exclusivo Administradora)
    if (action === 'REOPEN_FLUJO_CAJA') {
      const { sesion_id, fecha, tipo_libro = 'CAJA_MENOR' } = body;
      const { data: updated, error } = await supabase
        .from('libro_caja_sesiones')
        .update({
          estado: 'ABIERTA',
          tipo_cierre: 'PARCIAL',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sesion_id)
        .select('*')
        .single();

      if (error) throw error;
      if (fecha || updated?.fecha) {
        await recalcularHojaDiaria(fecha || updated.fecha, tipo_libro);
      }
      return NextResponse.json({ success: true, sesion: updated });
    }

    // 4. Crear nuevo registro individual o AJUSTE post-cierre en una hoja de fecha
    if (action === 'CREATE_ITEM') {
      const {
        fecha,
        clasificacion = 'Gasto Operativo',
        categoria = 'Gastos Generales',
        concepto,
        descripcion_beneficiario = '',
        valor_pagado = 0,
        soporte_factura = '',
        responsable_caja = 'JOHANNA',
        proveedor_fuente = 'Gastos Menores / Caja Menor',
        usuario_registro = 'JOHANNA',
        caja_nombre = 'CAJA PRINCIPAL',
        es_ajuste = false,
        sesion_id = null,
        is_admin = false,
        tipo_libro = 'CAJA_MENOR',
      } = body;

      if (!fecha || !concepto) {
        return NextResponse.json(
          { success: false, error: 'Fecha y concepto son obligatorios' },
          { status: 400 }
        );
      }

      const reqUser = String(usuario_registro || '').toLowerCase().trim();
      const reqCajero = String(responsable_caja || '').toUpperCase().trim();

      // Consultar las sesiones del día para aplicar reglas estrictas de negocio
      const { data: sesionesDia } = await supabase
        .from('libro_caja_sesiones')
        .select('*')
        .eq('fecha', fecha)
        .order('numero_turno', { ascending: true });

      const listaSes = sesionesDia || [];
      const sesionAbierta = listaSes.find((s: any) => s.estado === 'ABIERTA');
      const sesionCerradaTotal = listaSes.find(
        (s: any) => s.estado === 'CERRADA_TOTAL' || s.estado === 'CERRADA' || (s.estado !== 'ABIERTA' && s.tipo_cierre === 'TOTAL')
      );

      let sesionIdAsignada = sesion_id;

      // Si NO es administrador, validar estrictamente propiedad de la sesión y estado del flujo
      if (!is_admin) {
        if (!es_ajuste) {
          // Para registrar un EGRESO NORMAL:
          // Debe existir una sesión ABIERTA hoy y debe pertenecer a este usuario
          if (!sesionAbierta) {
            return NextResponse.json(
              {
                success: false,
                error: 'No tienes una sesión de Flujo de Caja ABIERTA en este día. Debes abrir el flujo o recibir el turno primero ingresando tu efectivo inicial.',
              },
              { status: 403 }
            );
          }

          const esDuenioAbierta =
            sesionAbierta.usuario_username?.toLowerCase() === reqUser ||
            sesionAbierta.cajero_nombre?.toUpperCase() === reqCajero;

          if (!esDuenioAbierta) {
            return NextResponse.json(
              {
                success: false,
                error: `No puedes ingresar egresos en una sesión abierta por otro usuario (${sesionAbierta.cajero_nombre}).`,
              },
              { status: 403 }
            );
          }

          sesionIdAsignada = sesionAbierta.id;
        } else {
          // Para registrar un AJUSTE POST-CIERRE:
          // El flujo del día debe haberse cerrado totalmente y el usuario debe haber participado / cerrado ese flujo
          if (!sesionCerradaTotal) {
            return NextResponse.json(
              {
                success: false,
                error: 'Solo se pueden registrar Ajustes posteriores cuando el Flujo de Caja del día se ha cerrado completamente.',
              },
              { status: 403 }
            );
          }

          const participoEnFlujo = listaSes.some(
            (s: any) =>
              s.usuario_username?.toLowerCase() === reqUser ||
              s.cajero_nombre?.toUpperCase() === reqCajero
          );

          if (!participoEnFlujo) {
            return NextResponse.json(
              {
                success: false,
                error: 'No puedes registrar ajustes en un flujo de caja en el que no tuviste una sesión abierta.',
              },
              { status: 403 }
            );
          }

          sesionIdAsignada = sesionCerradaTotal.id;
        }
      } else {
        // Si es Administrador y hay sesión, vincular a la sesión activa o última
        if (!sesionIdAsignada && listaSes.length > 0) {
          sesionIdAsignada = (sesionAbierta || listaSes[listaSes.length - 1]).id;
        }
      }

      const diaMes = Number(fecha.split('-')[2] || 1);
      const prefijoAjuste = es_ajuste ? 'AJUSTE CAJA / ' : 'CUADERNO CAJA / ';
      const soporteFinal = soporte_factura || `${prefijoAjuste}${responsable_caja.toUpperCase()}`;

      const { data: inserted, error } = await supabase
        .from('libro_caja_registros')
        .insert({
          fecha,
          dia_mes: diaMes,
          orden_item: 999,
          tipo_libro,
          periodo_id: `per-${fecha.slice(0, 7)}`,
          clasificacion,
          categoria,
          concepto: es_ajuste && !concepto.toUpperCase().startsWith('[AJUSTE]')
            ? `[AJUSTE] ${concepto.trim()}`
            : concepto.trim(),
          descripcion_beneficiario: descripcion_beneficiario.trim() || concepto.trim(),
          valor_pagado: Number(valor_pagado || 0),
          soporte_factura: soporteFinal,
          responsable_caja: responsable_caja.toUpperCase().trim(),
          proveedor_fuente: es_ajuste ? 'Ajuste Posterior al Cierre de Caja' : proveedor_fuente,
          usuario_registro: usuario_registro.toUpperCase().trim(),
          caja_nombre: caja_nombre || 'CAJA PRINCIPAL',
          es_ajuste: Boolean(es_ajuste),
          sesion_id: sesionIdAsignada || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      await recalcularHojaDiaria(fecha, tipo_libro);

      return NextResponse.json({
        success: true,
        registro: inserted,
      });
    }

    // 5. Actualizar Cuadre / Arqueo de Caja del Día (Vista Administradora o General)
    if (action === 'UPDATE_ARQUEO') {
      const {
        fecha,
        base_inicial = 200000,
        venta_efectivo_pos = 0,
        venta_pos_total = 0,
        total_datafonos = 0,
        efectivo_fisico_cierre = 0,
        estado = 'CERRADA',
        observaciones = '',
        tipo_libro = 'CAJA_MENOR',
      } = body;

      const { data: existing } = await supabase
        .from('libro_caja_diario')
        .select('*')
        .eq('fecha', fecha)
        .eq('tipo_libro', tipo_libro)
        .maybeSingle();

      const totalSalidas = Number(existing?.total_salidas || 0);
      const posFinal = Number(venta_pos_total || venta_efectivo_pos || existing?.venta_pos_total || 0);
      const datafonosFinal = Number(total_datafonos || 0);
      const fisicoFinal = Number(efectivo_fisico_cierre || 0);
      const baseFinal = Number(base_inicial || 0);

      // Cuadre real: (Efectivo Cierre + Datafonos + Salidas - Base Inicial) - Venta POS
      const recaudado = fisicoFinal + datafonosFinal + totalSalidas - baseFinal;
      const diferencia = recaudado - posFinal;

      if (existing) {
        const { error } = await supabase
          .from('libro_caja_diario')
          .update({
            base_inicial: baseFinal,
            venta_efectivo_pos: posFinal,
            venta_pos_total: posFinal,
            total_datafonos: datafonosFinal,
            efectivo_fisico_cierre: fisicoFinal,
            diferencia_cuadre: diferencia,
            estado,
            observaciones,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const diaMes = Number(fecha.split('-')[2] || 1);
        const { error } = await supabase.from('libro_caja_diario').insert({
          fecha,
          dia_mes: diaMes,
          tipo_libro,
          periodo_id: `per-${fecha.slice(0, 7)}`,
          base_inicial: baseFinal,
          venta_efectivo_pos: posFinal,
          venta_pos_total: posFinal,
          total_datafonos: datafonosFinal,
          total_costos_insumos: 0,
          total_gastos_operativos: 0,
          total_turnos_nomina: 0,
          total_salidas: 0,
          efectivo_fisico_cierre: fisicoFinal,
          diferencia_cuadre: diferencia,
          responsables_dia: 'GENERAL',
          estado,
          observaciones,
        });
        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    // 6. Crear nueva hoja diaria vacía
    if (action === 'CREATE_SHEET') {
      const { fecha, responsable_caja = 'JOHANNA', base_inicial = 200000, tipo_libro = 'CAJA_MENOR' } = body;
      await recalcularHojaDiaria(fecha, tipo_libro);
      await supabase
        .from('libro_caja_diario')
        .update({
          responsables_dia: responsable_caja.toUpperCase(),
          base_inicial: Number(base_inicial || 200000),
          estado: 'ABIERTA',
        })
        .eq('fecha', fecha)
        .eq('tipo_libro', tipo_libro);

      return NextResponse.json({ success: true });
    }

    // 7. Importación Masiva desde Excel / TXT / IA
    if (action === 'BULK_IMPORT') {
      const { items = [], replaceDates = true, tipo_libro = 'CAJA_MENOR' } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No se recibieron registros válidos para importar' },
          { status: 400 }
        );
      }

      const fechasAfectadas = new Set<string>();
      const payload = items.map((it: any, idx: number) => {
        const fecha = String(it.fecha || '2026-10-01').trim();
        fechasAfectadas.add(fecha);
        const diaMes = Number(fecha.split('-')[2] || it.dia_mes || 1);
        const soporte = String(it.soporte_factura || `CUADERNO CAJA / ${it.responsable_caja || 'JOHANNA'}`).trim();
        const resp = it.responsable_caja
          ? String(it.responsable_caja).toUpperCase().trim()
          : extractResponsableFromSoporte(soporte);

        return {
          fecha,
          dia_mes: diaMes,
          orden_item: idx + 1,
          tipo_libro,
          periodo_id: `per-${fecha.slice(0, 7)}`,
          clasificacion: String(it.clasificacion || 'Gasto Operativo').trim(),
          categoria: String(it.categoria || 'Gastos Generales').trim(),
          concepto: String(it.concepto || 'Registro Caja').trim(),
          descripcion_beneficiario: String(it.descripcion_beneficiario || it.concepto || '').trim(),
          valor_pagado: Number(it.valor_pagado || 0),
          soporte_factura: soporte,
          responsable_caja: resp,
          proveedor_fuente: String(it.proveedor_fuente || 'Gastos Menores / Caja Menor').trim(),
          usuario_registro: resp,
          caja_nombre: it.caja_nombre || 'CAJA 1 (PRINCIPAL)',
          es_ajuste: Boolean(it.es_ajuste),
        };
      });

      if (replaceDates) {
        const fechasArr = Array.from(fechasAfectadas);
        await supabase
          .from('libro_caja_registros')
          .delete()
          .eq('tipo_libro', tipo_libro)
          .in('fecha', fechasArr);
      }

      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error } = await supabase.from('libro_caja_registros').insert(chunk);
        if (error) throw error;
      }

      for (const f of Array.from(fechasAfectadas)) {
        await recalcularHojaDiaria(f, tipo_libro);
      }

      return NextResponse.json({
        success: true,
        importedCount: payload.length,
        fechasActualizadas: Array.from(fechasAfectadas).length,
      });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('[POST /api/libros-apoyo] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error procesando solicitud' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fecha = searchParams.get('fecha');
    const tipoLibro = searchParams.get('tipo_libro') || 'CAJA_MENOR';
    const isAdmin = searchParams.get('is_admin') === 'true';
    const usuario = (searchParams.get('usuario') || '').toLowerCase().trim();

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });
    }

    const { data: item } = await supabase
      .from('libro_caja_registros')
      .select('fecha, sesion_id, usuario_registro, responsable_caja')
      .eq('id', id)
      .maybeSingle();

    if (!isAdmin && item) {
      // Si no es administrador, solo puede eliminar si la sesión sigue ABIERTA y es su propia sesión
      if (item.sesion_id) {
        const { data: ses } = await supabase
          .from('libro_caja_sesiones')
          .select('estado, usuario_username, cajero_nombre')
          .eq('id', item.sesion_id)
          .maybeSingle();

        if (!ses || ses.estado !== 'ABIERTA') {
          return NextResponse.json(
            { success: false, error: 'No se pueden eliminar registros de una sesión de caja que ya fue cerrada.' },
            { status: 403 }
          );
        }

        if (
          usuario &&
          ses.usuario_username?.toLowerCase() !== usuario &&
          ses.cajero_nombre?.toLowerCase() !== usuario
        ) {
          return NextResponse.json(
            { success: false, error: 'Solo el usuario titular de la sesión abierta puede eliminar sus registros.' },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Solo un administrador puede eliminar registros históricos.' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase.from('libro_caja_registros').delete().eq('id', id);
    if (error) throw error;

    const targetFecha = fecha || item?.fecha;
    if (targetFecha) {
      await recalcularHojaDiaria(targetFecha, tipoLibro);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/libros-apoyo] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error eliminando registro' },
      { status: 500 }
    );
  }
}
