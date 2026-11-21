import crypto from 'crypto';

export type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN =
  /(pin|password|passwd|secret|token|key|authorization|cookie|credential)/i;

/**
 * Enmascara recursivamente claves sensibles en metadatos de logs para evitar fuga de secretos.
 */
export function sanitizeLogMeta(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeLogMeta(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitizeLogMeta(v, depth + 1);
      }
    }
    return out;
  }

  if (typeof value === 'string' && value.length > 1000) {
    return `${value.slice(0, 1000)}…[truncated]`;
  }

  return value;
}

function formatErrorForLog(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : undefined,
    };
  }
  if (typeof err === 'object' && err !== null) {
    return sanitizeLogMeta(err) as Record<string, unknown>;
  }
  return { message: String(err) };
}

export interface LogMeta {
  requestId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function emitLog(
  level: LogLevel,
  moduleName: string,
  action: string,
  meta?: LogMeta,
  err?: unknown
) {
  const { requestId, durationMs, ...restMeta } = meta || {};
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    module: moduleName,
    action,
    requestId: requestId || crypto.randomUUID(),
  };

  if (typeof durationMs === 'number') {
    payload.durationMs = Math.round(durationMs);
  }
  if (Object.keys(restMeta).length > 0) {
    payload.meta = sanitizeLogMeta(restMeta);
  }
  if (err !== undefined) {
    payload.error = formatErrorForLog(err);
  }

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Crea un logger estructurado en formato JSON de una línea por evento.
 */
export function createLogger(moduleName: string) {
  return {
    info(action: string, meta?: LogMeta) {
      emitLog('info', moduleName, action, meta);
    },
    warn(action: string, meta?: LogMeta) {
      emitLog('warn', moduleName, action, meta);
    },
    error(action: string, err: unknown, meta?: LogMeta) {
      emitLog('error', moduleName, action, meta, err);
    },
  };
}
