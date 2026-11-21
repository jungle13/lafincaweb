import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthEnforcementMode } from '@/lib/authServer';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const logger = createLogger('api.health');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const startedAt = Date.now();
  const checks = {
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    authEnforcement: getAuthEnforcementMode(),
  };

  try {
    const { error } = await supabase
      .from('pos_cajas')
      .select('id', { count: 'exact', head: true });

    const dbLatencyMs = Date.now() - startedAt;

    if (error) {
      logger.warn('health_check_degraded', { durationMs: dbLatencyMs, code: error.code });
      return NextResponse.json(
        {
          ok: false,
          status: 'degraded',
          dbLatencyMs,
          error: error.message,
          checks,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'healthy',
        dbLatencyMs,
        checks,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const dbLatencyMs = Date.now() - startedAt;
    logger.error('health_check_exception', err, { durationMs: dbLatencyMs });
    return NextResponse.json(
      {
        ok: false,
        status: 'degraded',
        dbLatencyMs,
        error: err instanceof Error ? err.message : 'Error verificando salud del sistema',
        checks,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: CORS_HEADERS }
    );
  }
}
