import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const pdfPath = path.join(process.cwd(), 'ACTA_OFICIAL_CONTEO_FISICO_24_SEP_2026.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ success: false, error: 'Archivo PDF no encontrado' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ACTA_OFICIAL_CONTEO_FISICO_${params.id}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
