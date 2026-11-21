import { supabase } from '@/lib/supabase';
import { normalizeSystemRole, validateAdminCredentials } from '@/lib/authServer';

export async function verifySupervisorPin(
  pin: string | undefined | null
): Promise<{ ok: true; supervisorName: string } | { ok: false }> {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) return { ok: false };

  try {
    const { data: supervisors } = await supabase
      .from('libro_caja_usuarios')
      .select('username, nombre_cajero, rol, rol_sistema, password_pin, password_sistema, activo')
      .eq('activo', true);

    for (const u of supervisors || []) {
      const role = normalizeSystemRole(u.rol_sistema || u.rol, u.username);
      if (role !== 'ADMIN' && role !== 'GESTOR') continue;
      const expected = String(u.password_pin || u.password_sistema || '').trim();
      if (expected && expected === cleanPin) {
        return {
          ok: true,
          supervisorName: String(u.nombre_cajero || u.username).trim(),
        };
      }
    }
  } catch (err) {
    console.warn('[verifySupervisorPin] Error consultando usuarios:', err);
  }

  for (const fallbackUser of ['admin', 'eliana', 'arturo']) {
    const okCred = validateAdminCredentials(fallbackUser, cleanPin);
    if (okCred) {
      return { ok: true, supervisorName: okCred.name };
    }
  }

  return { ok: false };
}
