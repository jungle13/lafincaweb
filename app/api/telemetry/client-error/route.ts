import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/authServer';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createLogger('client.boundary');

function clip(value: unknown, maxLen: number): string {
  return String(value ?? '').slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    const rl = checkRateLimit(`client-err:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limit exceeded' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const scope = clip(body?.scope || 'unknown', 64);
    const message = clip(body?.message || 'Unknown client error', 500);
    const stack = clip(body?.stack || '', 900);
    const digest = clip(body?.digest || '', 120);
    const pathname = clip(body?.pathname || '', 200);
    const userAgent = clip(req.headers.get('user-agent') || '', 200);

    logger.error('client_error_captured', new Error(message), {
      scope,
      digest: digest || undefined,
      pathname: pathname || undefined,
      userAgent: userAgent || undefined,
      clientStack: stack || undefined,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    logger.warn('client_error_ingest_failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
