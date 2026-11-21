import { describe, it, expect, afterEach } from 'vitest';
import {
  getAuthEnforcementMode,
  normalizeSystemRole,
  signAuthToken,
  verifyAuthToken,
} from '@/lib/authServer';

describe('authServer RBAC & HMAC tokens', () => {
  const originalEnforcement = process.env.AUTH_ENFORCEMENT;

  afterEach(() => {
    if (originalEnforcement === undefined) {
      delete process.env.AUTH_ENFORCEMENT;
    } else {
      process.env.AUTH_ENFORCEMENT = originalEnforcement;
    }
  });

  it('firma y verifica un token válido conservando usuario y rol', async () => {
    const token = await signAuthToken({
      username: 'admin',
      name: 'Administrador',
      role: 'ADMIN',
    });

    const session = await verifyAuthToken(token);
    expect(session).not.toBeNull();
    expect(session?.username).toBe('admin');
    expect(session?.role).toBe('ADMIN');
  });

  it('rechaza tokens alterados, vacíos o malformados', async () => {
    const token = await signAuthToken({
      username: 'mesero1',
      name: 'Mesero Uno',
      role: 'OPERATIVO_POS',
    });

    const tampered = `${token.slice(0, -4)}xxxx`;
    expect(await verifyAuthToken(tampered)).toBeNull();
    expect(await verifyAuthToken('')).toBeNull();
    expect(await verifyAuthToken('solo.un.punto.invalido')).toBeNull();
    expect(await verifyAuthToken(undefined)).toBeNull();
  });

  it('normaliza correctamente roles operativos vs administrativos', () => {
    expect(normalizeSystemRole(undefined, 'admin')).toBe('ADMIN');
    expect(normalizeSystemRole('SUPERVISOR', 'carlos')).toBe('GESTOR');
    expect(normalizeSystemRole('MESERO', 'juan')).toBe('OPERATIVO_POS');
    expect(normalizeSystemRole('CAJERO', 'maria')).toBe('OPERATIVO_POS');
  });

  it('respeta AUTH_ENFORCEMENT=enforce y audit', () => {
    process.env.AUTH_ENFORCEMENT = 'enforce';
    expect(getAuthEnforcementMode()).toBe('enforce');
    process.env.AUTH_ENFORCEMENT = 'audit';
    expect(getAuthEnforcementMode()).toBe('audit');
  });
});
