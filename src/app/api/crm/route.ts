import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [{ data: clientes, error: errC }, { data: pedidos, error: errP }] = await Promise.all([
      supabase.from('crm_clientes_b2b').select('*').order('created_at', { ascending: false }),
      supabase
        .from('crm_pedidos_b2b')
        .select('*, cliente:crm_clientes_b2b(id, codigo, empresa, contacto_nombre, telefono)')
        .order('created_at', { ascending: false }),
    ]);

    if (errC) throw errC;
    if (errP) throw errP;

    let maxCli = 0;
    for (const c of (clientes || [])) {
      const m = String(c.codigo || '').match(/(\d+)$/);
      if (m) maxCli = Math.max(maxCli, Number(m[1]));
    }
    let maxPed = 0;
    for (const p of (pedidos || [])) {
      const m = String(p.codigo_pedido || '').match(/(\d+)$/);
      if (m) maxPed = Math.max(maxPed, Number(m[1]));
    }

    return NextResponse.json({
      success: true,
      clientes: clientes || [],
      pedidos: pedidos || [],
      siguienteCodigoCliente: `B2B-${String(maxCli + 1).padStart(3, '0')}`,
      siguienteCodigoPedido: `PED-${String(maxPed + 1).padStart(3, '0')}`,
    });
  } catch (err: any) {
    console.error('Error en GET /api/crm:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error consultando CRM B2B' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'CREAR_CLIENTE') {
      const { empresa, contacto_nombre, telefono, correo, ciudad_direccion, etapa, notas } = body;
      if (!empresa || !contacto_nombre || !telefono) {
        return NextResponse.json(
          { success: false, error: 'Empresa, nombre de contacto y teléfono son obligatorios.' },
          { status: 400 }
        );
      }

      const { data: allCli } = await supabase.from('crm_clientes_b2b').select('codigo');
      let maxCli = 0;
      for (const c of (allCli || [])) {
        const m = String(c.codigo || '').match(/(\d+)$/);
        if (m) maxCli = Math.max(maxCli, Number(m[1]));
      }
      const codigo = `B2B-${String(maxCli + 1).padStart(3, '0')}`;

      const { data, error } = await supabase
        .from('crm_clientes_b2b')
        .insert({
          codigo,
          empresa: String(empresa).trim(),
          contacto_nombre: String(contacto_nombre).trim(),
          telefono: String(telefono).trim(),
          correo: correo ? String(correo).trim() : null,
          ciudad_direccion: ciudad_direccion ? String(ciudad_direccion).trim() : null,
          etapa: etapa || 'PROSPECTO',
          notas: notas ? String(notas).trim() : null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, cliente: data });
    }

    if (action === 'REGISTRAR_ENVIO_MENU') {
      const { cliente_id } = body;
      if (!cliente_id) {
        return NextResponse.json({ success: false, error: 'cliente_id obligatorio.' }, { status: 400 });
      }
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('crm_clientes_b2b')
        .update({
          ultimo_envio_menu: today,
          etapa: 'MENU_ENVIADO',
          updated_at: new Date().toISOString(),
        })
        .eq('id', cliente_id)
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, cliente: data });
    }

    if (action === 'ACTUALIZAR_ETAPA_CLIENTE') {
      const { cliente_id, etapa } = body;
      const { data, error } = await supabase
        .from('crm_clientes_b2b')
        .update({ etapa, updated_at: new Date().toISOString() })
        .eq('id', cliente_id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, cliente: data });
    }

    if (action === 'CREAR_PEDIDO') {
      const { cliente_id, fecha_entrega, descripcion_pedido, cantidad_platos, valor_total, observaciones } = body;
      if (!cliente_id || !descripcion_pedido) {
        return NextResponse.json(
          { success: false, error: 'Cliente y descripción del pedido son obligatorios.' },
          { status: 400 }
        );
      }

      const { data: allPed } = await supabase.from('crm_pedidos_b2b').select('codigo_pedido');
      let maxPed = 0;
      for (const p of (allPed || [])) {
        const m = String(p.codigo_pedido || '').match(/(\d+)$/);
        if (m) maxPed = Math.max(maxPed, Number(m[1]));
      }
      const codigo_pedido = `PED-${String(maxPed + 1).padStart(3, '0')}`;

      const { data: pedido, error } = await supabase
        .from('crm_pedidos_b2b')
        .insert({
          codigo_pedido,
          cliente_id,
          fecha_entrega: fecha_entrega || new Date().toISOString().slice(0, 10),
          descripcion_pedido: String(descripcion_pedido).trim(),
          cantidad_platos: Math.max(1, Number(cantidad_platos || 1)),
          valor_total: Number(valor_total || 0),
          estado: 'COTIZADO',
          observaciones: observaciones ? String(observaciones).trim() : null,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Promover cliente a CLIENTE_ACTIVO
      await supabase
        .from('crm_clientes_b2b')
        .update({ etapa: 'CLIENTE_ACTIVO', updated_at: new Date().toISOString() })
        .eq('id', cliente_id);

      return NextResponse.json({ success: true, pedido });
    }

    if (action === 'ACTUALIZAR_ESTADO_PEDIDO') {
      const { pedido_id, estado } = body;
      const { data, error } = await supabase
        .from('crm_pedidos_b2b')
        .update({ estado, updated_at: new Date().toISOString() })
        .eq('id', pedido_id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, pedido: data });
    }

    return NextResponse.json({ success: false, error: 'Acción no reconocida.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en POST /api/crm:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error en CRM B2B' },
      { status: 500 }
    );
  }
}
