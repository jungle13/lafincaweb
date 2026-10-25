import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    let pdfFileName = 'ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf';

    // Consultar sesión de conteo para determinar el archivo PDF correspondiente
    const { data: conteo } = await supabase
      .from('conteos_fisicos')
      .select('id, fecha')
      .eq('id', params.id)
      .maybeSingle();

    if (conteo?.fecha === '2026-09-30' || params.id.startsWith('8daf1353')) {
      pdfFileName = 'ACTA_OFICIAL_CONTEO_FISICO_30_SEP_2026.pdf';
    } else if (conteo?.fecha === '2026-09-24' || params.id.startsWith('04745026')) {
      pdfFileName = 'ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf';
    }

    const pdfPath = path.join(process.cwd(), pdfFileName);

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ success: false, error: 'Archivo PDF no encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdfFileName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
