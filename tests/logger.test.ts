import { describe, it, expect } from 'vitest';
import { sanitizeLogMeta } from '@/lib/logger';

describe('logger sanitizeLogMeta', () => {
  it('redacta claves sensibles incluso en objetos anidados', () => {
    const input = {
      ordenId: 'ord-123',
      total: 45000,
      pin: '1234',
      supervisorPin: '9999',
      nested: {
        password: 'secreto',
        supabase_service_role_key: 'sb_secret_xyz',
        authorization: 'Bearer abc',
        cajaId: 'caja-1',
      },
    };

    const sanitized = sanitizeLogMeta(input) as Record<string, any>;
    expect(sanitized.ordenId).toBe('ord-123');
    expect(sanitized.total).toBe(45000);
    expect(sanitized.pin).toBe('[REDACTED]');
    expect(sanitized.supervisorPin).toBe('[REDACTED]');
    expect(sanitized.nested.password).toBe('[REDACTED]');
    expect(sanitized.nested.supabase_service_role_key).toBe('[REDACTED]');
    expect(sanitized.nested.authorization).toBe('[REDACTED]');
    expect(sanitized.nested.cajaId).toBe('caja-1');
  });
});
