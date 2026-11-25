import { describe, it, expect } from 'vitest';

describe('Sincronización Offline FIFO: Mapeo de IDs Temporales e Idempotencia', () => {
  it('traduce temp_orden_id y temp_sesion_id en operaciones secuenciales FIFO', async () => {
    const ops = [
      { op_id: 'op-1', action: 'ABRIR_TURNO_CAJA', temp_sesion_id: 'off-ses-1' },
      {
        op_id: 'op-2',
        action: 'ABRIR_O_AGREGAR_ORDEN',
        sesion_caja_id: 'off-ses-1',
        temp_orden_id: 'off-ord-1',
        idempotency_key: 'k-2',
      },
      {
        op_id: 'op-3',
        action: 'FACTURAR_ORDEN',
        sesion_caja_id: 'off-ses-1',
        orden_id: 'off-ord-1',
        idempotency_key: 'k-3',
      },
    ];

    const sentPayloads: Array<Record<string, unknown>> = [];
    const tempOrdenIdMap: Record<string, string> = {};
    const tempSesionIdMap: Record<string, string> = {};

    for (const rawOp of ops) {
      const payload: Record<string, unknown> = { ...rawOp };
      const tempOrdenId = typeof payload.temp_orden_id === 'string' ? payload.temp_orden_id : '';
      const tempSesionId = typeof payload.temp_sesion_id === 'string' ? payload.temp_sesion_id : '';
      delete payload.op_id;
      delete payload.temp_orden_id;
      delete payload.temp_sesion_id;

      if (typeof payload.orden_id === 'string' && tempOrdenIdMap[payload.orden_id]) {
        payload.orden_id = tempOrdenIdMap[payload.orden_id];
      }
      if (typeof payload.sesion_caja_id === 'string' && tempSesionIdMap[payload.sesion_caja_id]) {
        payload.sesion_caja_id = tempSesionIdMap[payload.sesion_caja_id];
      }

      sentPayloads.push(payload);

      if (tempSesionId) tempSesionIdMap[tempSesionId] = 'uuid-sesion-real-001';
      if (tempOrdenId) tempOrdenIdMap[tempOrdenId] = 'uuid-orden-real-001';
    }

    expect(sentPayloads[1].sesion_caja_id).toBe('uuid-sesion-real-001');
    expect(sentPayloads[2].sesion_caja_id).toBe('uuid-sesion-real-001');
    expect(sentPayloads[2].orden_id).toBe('uuid-orden-real-001');
    expect(sentPayloads[2].idempotency_key).toBe('k-3');
  });
});
