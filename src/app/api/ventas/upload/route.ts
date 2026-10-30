import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { parseVentasTxtContent, guardarVentasEnBaseDeDatos } from '@/services/ventasParserService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let textContent = '';
    let fileName = 'ventas.txt';
    let isPreview = false;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ ok: false, error: 'No se envió ningún archivo' }, { status: 400 });
      }
      fileName = file.name || 'ventas.txt';
      isPreview = formData.get('preview') === 'true';

      const arrayBuffer = await file.arrayBuffer();
      // Decodificar preferentemente en latin1 / ISO-8859-1 para caracteres POS de caja
      const decoder = new TextDecoder('latin1');
      textContent = decoder.decode(arrayBuffer);
    } else {
      const body = await req.json();
      textContent = body.content || '';
      fileName = body.fileName || 'ventas.txt';
      isPreview = Boolean(body.preview);
    }

    if (!fileName.toLowerCase().endsWith('.txt')) {
      return NextResponse.json({
        ok: false,
        error: 'Extensión no permitida: el archivo de ventas POS debe tener extensión .txt.',
      }, { status: 400 });
    }

    // 1. Parsear el archivo con validaciones de negocio
    const parsed = parseVentasTxtContent(textContent, fileName);

    // 2. Si es solo vista previa (pre-validación antes de confirmar)
    if (isPreview) {
      const { data: existente } = await supabase
        .from('ventas_diarias')
        .select('fecha, gran_total, total_articulos, archivo_origen')
        .eq('fecha', parsed.fecha)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        preview: {
          fecha: parsed.fecha,
          dia_semana: parsed.dia_semana,
          archivo_origen: parsed.archivo_origen,
          total_articulos: parsed.total_articulos,
          venta_neta: parsed.venta_neta,
          impuesto: parsed.impuesto,
          gran_total: parsed.gran_total,
          total_platos_distintos: parsed.total_platos_distintos,
          ticket_promedio: parsed.ticket_promedio,
          muestra_items: parsed.items.slice(0, 5),
          yaExiste: Boolean(existente),
          datosExistentes: existente || null,
        },
      });
    }

    // 3. Guardado en firme
    const resultado = await guardarVentasEnBaseDeDatos(parsed);

    return NextResponse.json({
      ok: true,
      mensaje: `Ventas del día ${parsed.fecha} guardadas exitosamente.`,
      resultado,
    });
  } catch (err: any) {
    console.error('Error procesando archivo de ventas:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
  }
}
