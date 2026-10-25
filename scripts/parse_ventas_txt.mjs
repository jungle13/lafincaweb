import fs from 'fs';
import path from 'path';

function parseVentasTxt(filePath) {
  const content = fs.readFileSync(filePath, 'latin1');
  const lines = content.split('\n');

  let fecha = null;
  const matchFecha = content.match(/Del:\s*(\d{2})\/(\d{2})\/(\d{2})/);
  if (matchFecha) {
    fecha = `20${matchFecha[3]}-${matchFecha[2]}-${matchFecha[1]}`;
  }

  const items = [];
  let inData = false;

  for (const line of lines) {
    if (line.includes('=====')) {
      inData = true;
      continue;
    }
    if (!inData || !line.trim()) continue;
    if (line.includes('TOTALES') || line.includes('Total :') || line.includes('TOTAL :')) break;

    // Line format:
    // 73    Agua tarro           ud              8.0      20,741           0      20,741       1,659      22,400       2,593    0.41%
    const trimmed = line.trim();
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length >= 7) {
      const codigo = parts[0].trim();
      const producto = parts[1].trim();
      
      // Encontrar números al final
      const nums = trimmed.match(/[\d\.\,]+/g);
      if (nums && nums.length >= 7) {
        const nLen = nums.length;
        // Últimos 8 valores típicos: cant, v_bruta, desc, v_neta, imp, gran_tot, v_unit, pct
        const cant = parseFloat(nums[nLen - 8]?.replace(/,/g, '')) || parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
        const vBruta = parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
        const desc = parseFloat(nums[nLen - 6]?.replace(/,/g, '')) || 0;
        const vNeta = parseFloat(nums[nLen - 5]?.replace(/,/g, '')) || 0;
        const imp = parseFloat(nums[nLen - 4]?.replace(/,/g, '')) || 0;
        const granTot = parseFloat(nums[nLen - 3]?.replace(/,/g, '')) || 0;
        const vUnit = parseFloat(nums[nLen - 2]?.replace(/,/g, '')) || 0;

        if (granTot > 0 || cant > 0) {
          items.push({
            codigo,
            producto,
            cant,
            vBruta,
            desc,
            vNeta,
            imp,
            granTot,
            vUnit
          });
        }
      }
    }
  }

  return { fecha, items };
}

for (let d = 21; d <= 30; d++) {
  const p = `./DOCUMENTOS BASE/ventas/${d}.txt`;
  if (fs.existsSync(p)) {
    const res = parseVentasTxt(p);
    const sumTot = res.items.reduce((acc, x) => acc + x.granTot, 0);
    console.log(`Día ${d} (${res.fecha}): ${res.items.length} platos vendidos | Gran Total: $${sumTot.toLocaleString('es-CO')}`);
  }
}
