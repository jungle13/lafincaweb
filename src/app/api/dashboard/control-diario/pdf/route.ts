import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0];

    // Directorio temporal para almacenar el PDF
    const tempFileName = `INFORME_CONTROL_CARNES_COCINA_${fecha}.pdf`;
    const tempFilePath = path.join(process.cwd(), 'temp', tempFileName);

    // Asegurar directorio temp
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_daily_control_pdf.py');

    // Ejecutar script python para generar el PDF
    await execFileAsync('python', [scriptPath, '--fecha', fecha, '--output', tempFilePath]);

    if (!fs.existsSync(tempFilePath)) {
      return NextResponse.json({ success: false, error: 'No se pudo generar el archivo PDF' }, { status: 500 });
    }

    const fileBuffer = fs.readFileSync(tempFilePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${tempFileName}"`,
      },
    });

  } catch (error: any) {
    console.error('Error generando PDF de control diario:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
