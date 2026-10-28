#!/usr/bin/env node
/**
 * Antigravity Skill Converter
 * Inspirado en shaashiekumha/antigravity-skill-converter.
 * Convierte archivos de reglas externas (.cursorrules, .mdc, CLAUDE.md)
 * al formato estándar de Antigravity (.agents/skills/<name>/SKILL.md).
 *
 * Uso:
 *   node scripts/antigravity-skill-converter.mjs <archivo-origen> [nombre-del-skill]
 *
 * Ejemplo:
 *   node scripts/antigravity-skill-converter.mjs .cursorrules cursor-project-rules
 */

import fs from 'fs';
import path from 'path';

const [,, sourcePath, customName] = process.argv;

if (!sourcePath) {
  console.log(`
Uso: node scripts/antigravity-skill-converter.mjs <archivo-origen> [nombre-del-skill]

Ejemplos:
  node scripts/antigravity-skill-converter.mjs .cursorrules general-rules
  node scripts/antigravity-skill-converter.mjs path/to/tailwind.mdc tailwind-patterns
`);
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Error: El archivo "${sourcePath}" no existe.`);
  process.exit(1);
}

const rawContent = fs.readFileSync(sourcePath, 'utf-8');
const baseName = customName || path.basename(sourcePath, path.extname(sourcePath)).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
const targetSkillDir = path.resolve(process.cwd(), '.agents', 'skills', baseName);
const targetSkillFile = path.join(targetSkillDir, 'SKILL.md');

// Limpiar frontmatter previo si existía en archivos .mdc
let body = rawContent;
let detectedDescription = `Reglas convertidas automáticamente desde ${path.basename(sourcePath)}.`;

if (rawContent.startsWith('---')) {
  const parts = rawContent.split('---');
  if (parts.length >= 3) {
    const yamlHeader = parts[1];
    body = parts.slice(2).join('---').trim();
    
    // Intentar extraer descripción previa
    const descMatch = yamlHeader.match(/description:\s*(.+)/i);
    if (descMatch && descMatch[1]) {
      detectedDescription = descMatch[1].trim();
    }
  }
}

const skillContent = `---
name: ${baseName}
description: ${detectedDescription}
risk: none
source_type: converted
original_file: ${path.basename(sourcePath)}
date_converted: ${new Date().toISOString().split('T')[0]}
---

# ${baseName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}

${body}
`;

fs.mkdirSync(targetSkillDir, { recursive: true });
fs.writeFileSync(targetSkillFile, skillContent, 'utf-8');

console.log(`✅ Skill convertido exitosamente:`);
console.log(`   📂 Carpeta: .agents/skills/${baseName}/`);
console.log(`   📄 Archivo: .agents/skills/${baseName}/SKILL.md`);
