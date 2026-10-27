const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/USUARIO/Desktop/Proyectos/Costos_Finca/OCTUBRE 2026/VENTAS';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') && !f.includes('(1)')).sort();

const productsMap = new Map();

files.forEach(file => {
  const content = fs.readFileSync(path.join(dir, file), 'latin1');
  const lines = content.split('\n');
  let inData = false;
  for (const line of lines) {
    if (line.includes('=====')) { inData = true; continue; }
    if (!inData || !line.trim()) continue;
    if (line.includes('TOTALES') || line.includes('Total :') || line.includes('TOTAL :')) break;
    const trimmed = line.trim();
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length >= 7) {
      const codigo = parts[0].trim();
      const producto = parts[1].trim();
      const nums = trimmed.match(/[\d\.\,]+/g);
      if (nums && nums.length >= 7) {
        const nLen = nums.length;
        const cant = parseFloat(nums[nLen - 8]?.replace(/,/g, '')) || parseFloat(nums[nLen - 7]?.replace(/,/g, '')) || 0;
        const vNeta = parseFloat(nums[nLen - 5]?.replace(/,/g, '')) || 0;
        const imp = parseFloat(nums[nLen - 4]?.replace(/,/g, '')) || 0;
        const granTot = parseFloat(nums[nLen - 3]?.replace(/,/g, '')) || 0;

        if (cant > 0 || granTot > 0) {
          if (!productsMap.has(codigo)) {
            productsMap.set(codigo, {
              codigo,
              producto,
              cant: 0,
              granTot: 0,
              vNeta: 0,
              imp: 0,
              preciosUnit: []
            });
          }
          const p = productsMap.get(codigo);
          p.cant += cant;
          p.granTot += granTot;
          p.vNeta += vNeta;
          p.imp += imp;
          if (cant > 0) {
            p.preciosUnit.push({
              totUnit: Math.round(granTot / cant),
              netoUnit: Math.round(vNeta / cant),
              impUnit: Math.round(imp / cant)
            });
          }
        }
      }
    }
  }
});

function classify(nombre, codigo) {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // BEBIDAS
  if (
    n.includes('cerv') || n.includes('cerveza') || n.includes('poker') || n.includes('aguila') || n.includes('corona') || n.includes('stella') || n.includes('costenita') || n.includes('club') ||
    n.includes('gaseosa') || n.includes('coca cola') || n.includes('postobon') || n.includes('quatro') || n.includes('sprite') || n.includes('bretana') || n.includes('soda') || n.includes('hit') ||
    n.includes('agua') || n.includes('jugo') || n.includes('limonada') || n.includes('guarapo') || n.includes('mr tea') || n.includes('pony malta') || n.includes('vive 100') || n.includes('gatorade') || n.includes('h2oh') || n.includes('del valle') ||
    n.includes('cafe') || n.includes('tinto') || n.includes('chocolate') || n.includes('milo') || n.includes('aromatica') || n.includes('jarra')
  ) {
    return { categoria: 'BEBIDAS', subcategoria: 'BEBIDAS', es_receta: false };
  }

  // DESECHABLES / OTROS
  if (n.includes('desechable') || n.includes('bano') || n.includes('actigest') || n.includes('cigarro') || n.includes('dulce') || n.includes('chicle')) {
    return { categoria: 'OTROS', subcategoria: 'OTROS', es_receta: false };
  }

  // ACOMPAÑAMIENTOS
  if (
    n.includes('aguacate') || n.includes('porc') || n.includes('porcion') || n.includes('adicional') || n.includes('arepa') || (n.includes('huevo') && !n.includes('perico') && !n.includes('desayuno')) ||
    n.includes('papas fritas') || n.includes('papa porc') || n.includes('arroz porc') || n.includes('patacon') || n.includes('tajadas') || n.includes('platano') || n.includes('chicharron porc')
  ) {
    return { categoria: 'ACOMPAÑAMIENTOS', subcategoria: 'ACOMPAÑAMIENTOS', es_receta: false };
  }

  // PLATOS
  // 1. MENU DEL DIA (Ejecutivos)
  if (n.includes('ejecutiv') || n.includes('menu del dia')) {
    return { categoria: 'PLATOS', subcategoria: 'MENU DEL DIA', es_receta: true };
  }

  // 2. DESAYUNOS
  if (n.includes('calentado') || n.includes('perico') || n.includes('desayuno') || n.includes('cacerola') || n.includes('huevos al gusto')) {
    return { categoria: 'PLATOS', subcategoria: 'DESAYUNOS', es_receta: true };
  }

  // 3. FRIJOLADAS
  if (n.includes('frijolada') || n.includes('cazuela frijol')) {
    return { categoria: 'PLATOS', subcategoria: 'FRIJOLADAS', es_receta: true };
  }

  // 4. BANDEJAS PAISAS
  if (n.includes('bandeja') || n.includes('paisa')) {
    return { categoria: 'PLATOS', subcategoria: 'BANDEJAS PAISAS', es_receta: true };
  }

  // 5. TAMALES
  if (n.includes('tamal')) {
    return { categoria: 'PLATOS', subcategoria: 'TAMALES', es_receta: true };
  }

  // 6. PLATOS A LA CARTA (Fallback para platos preparados)
  return { categoria: 'PLATOS', subcategoria: 'PLATOS A LA CARTA', es_receta: true };
}

const classified = [];
productsMap.forEach(p => {
  const c = classify(p.producto, p.codigo);

  // Precio unitario típico (más frecuente)
  const priceCounts = {};
  p.preciosUnit.forEach(pr => {
    priceCounts[pr.totUnit] = (priceCounts[pr.totUnit] || 0) + 1;
  });
  const bestTotUnit = Number(Object.keys(priceCounts).sort((a,b) => priceCounts[b] - priceCounts[a])[0]) || 0;
  const netoUnit = Math.round(bestTotUnit / 1.08);
  const impUnit = bestTotUnit - netoUnit;

  classified.push({
    codigo: p.codigo,
    nombre: p.producto,
    categoria: c.categoria,
    subcategoria: c.subcategoria,
    es_receta: c.es_receta,
    precioNeto: netoUnit,
    impoconsumo: impUnit,
    precioTotal: bestTotUnit,
    cantVendida: p.cant,
    granTotVentas: p.granTot
  });
});

const groups = {};
classified.forEach(c => {
  const k = c.categoria + ' -> ' + c.subcategoria;
  groups[k] = (groups[k] || 0) + 1;
});

console.log('Distribución por Categoría -> Subcategoría:');
console.log(groups);

console.log('\nMuestra de PLATOS:');
classified.filter(c => c.categoria === 'PLATOS').forEach(c => {
  console.log(`[${c.subcategoria}] Cod: ${c.codigo} | ${c.nombre} | Total: $${c.precioTotal.toLocaleString('es-CO')} (Neto: $${c.precioNeto.toLocaleString('es-CO')} + Imp: $${c.impoconsumo.toLocaleString('es-CO')})`);
});
