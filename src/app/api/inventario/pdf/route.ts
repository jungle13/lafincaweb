import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download') === 'true';

    // Prioridad de rutas donde se almacena el PDF oficial
    const candidatePaths = [
      path.join(process.cwd(), 'REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf'),
      path.join(process.cwd(), 'public', 'reports', 'REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf'),
      path.join(process.cwd(), 'DOCUMENTOS BASE', 'REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf')
    ];

    let targetPath = candidatePaths.find((p) => fs.existsSync(p));

    if (!targetPath) {
      return NextResponse.json(
        { success: false, error: 'Reporte oficial de inventario en PDF no encontrado en el servidor' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(targetPath);
    const disposition = download ? 'attachment' : 'inline';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="REPORTE_OFICIAL_INVENTARIO_23_SEP_2026.pdf"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
