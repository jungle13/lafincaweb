import { describe, it, expect } from 'vitest';
import { DEFAULT_ELIANA_POS_CONFIG, getPresetForGiro } from '@/lib/posConfig';

describe('posConfig presets', () => {
  it('mantiene configuración restaurante por defecto', () => {
    expect(DEFAULT_ELIANA_POS_CONFIG.giro).toBe('RESTAURANTE');
    expect(DEFAULT_ELIANA_POS_CONFIG.habilitaMesas).toBe(true);
    expect(DEFAULT_ELIANA_POS_CONFIG.anchoTicketMm).toBe(80);
  });

  it('aplica preset COMERCIO_RETAIL desactivando mesas y comandas', () => {
    const retail = getPresetForGiro('COMERCIO_RETAIL');
    expect(retail.habilitaMesas).toBe(false);
    expect(retail.habilitaComandasCocina).toBe(false);
    expect(retail.habilitaPesajeAutomatico).toBe(true);
    expect(retail.nombreImpuesto).toBe('IVA');
  });

  it('aplica preset HIBRIDO habilitando mesas y pesaje', () => {
    const hibrido = getPresetForGiro('HIBRIDO');
    expect(hibrido.habilitaMesas).toBe(true);
    expect(hibrido.habilitaPesajeAutomatico).toBe(true);
  });
});
