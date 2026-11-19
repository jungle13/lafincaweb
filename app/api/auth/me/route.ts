import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  normalizeSystemRole,
  verifyAuthToken,
} from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifyAuthToken(token);

  if (!session || session.role === 'cajero') {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const normalizedRole = normalizeSystemRole(session.role, session.username);

  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      name: session.name,
      role: normalizedRole,
    },
  });
}
