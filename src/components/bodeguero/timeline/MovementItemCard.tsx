'use client';

import { 
  CheckCircle2, 
  Trash2, 
  Edit2, 
  Loader2, 
  Lock, 
  Wrench 
} from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { MovimientoItem } from '@/types';

interface Props {
  movimiento: MovimientoItem;
  mode: 'PENDIENTES' | 'HISTORIAL';
  isDateLocked?: boolean;
  isStockInsufficient?: boolean;
  stockImpactHtml?: React.ReactNode;
  isLoading?: boolean;
  earliestPendingDate?: string | null;
  showCocinaCosts?: boolean;
  onAprobar?: (id: string) => void;
  onDescartar?: (id: string) => void;
  onOpenEdit?: (m: MovimientoItem) => void;
  onOpenQuickAjuste?: (m: MovimientoItem) => void;
}

export default function MovementItemCard({
  movimiento,
  mode,
  isDateLocked = false,
  isStockInsufficient = false,
  stockImpactHtml,
  isLoading = false,
  earliestPendingDate,
  showCocinaCosts = false,
  onAprobar,
  onDescartar,
  onOpenEdit,
  onOpenQuickAjuste,
}: Props) {
  const tipo = movimiento.tipo_movimiento;
  const dateStr = (movimiento.fecha || movimiento.fecha_hora || '').split('T')[0];
  const valorTotal = movimiento.valor_total_movimiento || 0;
  const origen = (movimiento.origen || '').toUpperCase();
  const destino = (movimiento.destino || '').toUpperCase();

  // Desglose estricto: Costo de Bodega vs Costo de Cocina
  let costoBodega: { label: string; valor: number; type: 'entrada' | 'salida' | 'neutro' } | null = null;
  let costoCocina: { label: string; valor: number; type: 'entrada' | 'salida' | 'neutro' } | null = null;

  if (tipo === 'ENTRADA_COMPRA') {
    costoBodega = { label: 'Ingreso Bodega', valor: valorTotal, type: 'entrada' };
  } else if (tipo === 'PORCIONADO') {
    costoBodega = { label: 'Valor Bodega', valor: valorTotal, type: 'neutro' };
  } else if (tipo === 'TRASLADO_COCINA') {
    costoBodega = { label: 'Salida Bodega', valor: valorTotal, type: 'salida' };
    costoCocina = { label: 'Entrada Cocina', valor: valorTotal, type: 'entrada' };
  } else if (tipo === 'DEVOLUCION_COCINA') {
    costoBodega = { label: 'Reintegro Bodega', valor: valorTotal, type: 'entrada' };
    costoCocina = { label: 'Salida Cocina', valor: valorTotal, type: 'salida' };
  } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
    if (origen.includes('COCINA')) {
      costoCocina = { label: 'Merma Cocina', valor: valorTotal, type: 'salida' };
    } else {
      costoBodega = { label: 'Merma Bodega', valor: valorTotal, type: 'salida' };
    }
  } else if (tipo === 'AJUSTE_INVENTARIO') {
    if (origen.includes('COCINA') || destino.includes('COCINA')) {
      costoCocina = { label: 'Ajuste Cocina', valor: valorTotal, type: 'neutro' };
    } else {
      costoBodega = { label: 'Ajuste Bodega', valor: valorTotal, type: 'neutro' };
    }
  } else if (tipo === 'INVENTARIO_INICIAL') {
    costoBodega = { label: 'Apertura Bodega', valor: valorTotal, type: 'entrada' };
  } else {
    costoBodega = { label: 'Bodega', valor: valorTotal, type: 'neutro' };
  }
  const timeStr = movimiento.fecha_hora
    ? new Date(movimiento.fecha_hora).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : '';

  const tipoMedida = movimiento.catalogo_insumos?.tipo_medida || 'KGS_Y_UNIDADES';

  let typeTag = 'bg-blue-100 text-blue-800 border-blue-200';
  let typeLabel = '1. ENTRADA COMPRA';
  let qtyText = `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;

  if (tipo === 'ENTRADA_COMPRA') {
    if (tipoMedida === 'UNIDADES') {
      const u = movimiento.porciones_und || parseFloat(String(movimiento.cant_sin_porcionar_kg || 0));
      qtyText = `${u} und`;
    } else if (tipoMedida === 'PAQUETES') {
      const p = movimiento.porciones_und || parseFloat(String(movimiento.cant_sin_porcionar_kg || 0));
      qtyText = `${p} paquetes`;
    } else {
      qtyText = `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    }
  } else if (tipo === 'PORCIONADO') {
    typeTag = 'bg-purple-100 text-purple-800 border-purple-200';
    typeLabel = '2. PORCIONADO';
    qtyText = `${movimiento.porciones_und || 0} porc (${parseFloat(
      String(movimiento.peso_porciones_kg || 0)
    ).toFixed(2)} Kg)`;
  } else if (tipo === 'DEVOLUCION_COCINA') {
    typeTag = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    typeLabel = '3. DEVOLUCIÓN COCINA';
    if (tipoMedida === 'UNIDADES') {
      qtyText = `+${movimiento.porciones_und || 0} und`;
    } else if (tipoMedida === 'PAQUETES') {
      qtyText = `+${movimiento.porciones_und || 0} paquetes`;
    } else {
      qtyText = movimiento.porciones_und
        ? `+${movimiento.porciones_und} und`
        : `+${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    }
  } else if (tipo === 'TRASLADO_COCINA') {
    typeTag = 'bg-orange-100 text-orange-800 border-orange-200';
    typeLabel = '4. TRASLADO COCINA';
    if (tipoMedida === 'UNIDADES') {
      qtyText = `${movimiento.porciones_und || 0} und`;
    } else if (tipoMedida === 'PAQUETES') {
      qtyText = `${movimiento.porciones_und || 0} paquetes`;
    } else if (tipoMedida === 'KGS') {
      qtyText = `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    } else {
      const pKg = parseFloat(String(movimiento.peso_porciones_kg || 0));
      qtyText = movimiento.porciones_und
        ? `${movimiento.porciones_und} porc${pKg > 0 ? ` (${pKg.toFixed(2)} Kg)` : ''}`
        : `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    }
  } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
    typeTag = 'bg-rose-100 text-rose-800 border-rose-200';
    typeLabel = '5. MERMA / BAJA';
    if (tipoMedida === 'UNIDADES') {
      qtyText = `-${movimiento.porciones_und || 0} und`;
    } else if (tipoMedida === 'PAQUETES') {
      qtyText = `-${movimiento.porciones_und || 0} paquetes`;
    } else {
      qtyText = movimiento.porciones_und
        ? `-${movimiento.porciones_und} und`
        : `-${parseFloat(String(movimiento.cant_sin_porcionar_kg || movimiento.merma_kg || 0)).toFixed(2)} Kg`;
    }
  } else if (tipo === 'AJUSTE_INVENTARIO') {
    typeTag = 'bg-amber-100 text-amber-900 border-amber-200';
    typeLabel = '5. AJUSTE DE INVENTARIO';
    if (tipoMedida === 'UNIDADES') {
      qtyText = `${movimiento.porciones_und || 0} und`;
    } else if (tipoMedida === 'PAQUETES') {
      qtyText = `${movimiento.porciones_und || 0} paquetes`;
    } else if (tipoMedida === 'KGS') {
      qtyText = `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    } else {
      qtyText = movimiento.porciones_und
        ? `${movimiento.porciones_und} und`
        : `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    }
  } else if (tipo === 'INVENTARIO_INICIAL') {
    typeTag = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    typeLabel = '📦 APERTURA INICIAL';
    if (tipoMedida === 'UNIDADES') {
      qtyText = `${movimiento.porciones_und || 0} und`;
    } else if (tipoMedida === 'PAQUETES') {
      qtyText = `${movimiento.porciones_und || 0} paquetes`;
    } else if (tipoMedida === 'KGS') {
      qtyText = `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    } else {
      qtyText = movimiento.porciones_und
        ? `${movimiento.porciones_und} und (${parseFloat(
            String(movimiento.peso_porciones_kg || 0)
          ).toFixed(2)} Kg)`
        : `${parseFloat(String(movimiento.cant_sin_porcionar_kg || 0)).toFixed(2)} Kg`;
    }
  }

  // PENDIENTES CARD
  if (mode === 'PENDIENTES') {
    return (
      <div
        className={`p-3 rounded-xl border shadow-sm space-y-2 text-xs font-normal transition-all ${
          isDateLocked
            ? 'bg-slate-50/70 border-slate-200 opacity-80'
            : isStockInsufficient
            ? 'bg-red-50/40 border-red-300'
            : 'bg-white border-amber-200'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${typeTag}`}>
            {typeLabel}
          </span>
          <span className="text-[11px] text-slate-400 font-normal flex items-center gap-1">
            {isDateLocked && <Lock className="w-3 h-3 text-slate-400" />}
            <span>{dateStr}</span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-medium text-slate-900 text-xs md:text-sm">{qtyText}</span>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Costo Bodega: Siempre visible */}
            {costoBodega && costoBodega.valor > 0 && (
              <span 
                className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 ${
                  costoBodega.type === 'salida'
                    ? 'bg-blue-50/90 text-blue-900 border-blue-200'
                    : costoBodega.type === 'entrada'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-slate-100 text-slate-800 border-slate-200'
                }`}
                title={`Impacto contable en Bodega: ${costoBodega.label}`}
              >
                <span className="text-[10px] text-blue-700 uppercase font-semibold">Bodega:</span>
                <span>$ {formatMoney(costoBodega.valor)}</span>
              </span>
            )}

            {/* Costo Cocina: Solo si showCocinaCosts está activo */}
            {showCocinaCosts && costoCocina && costoCocina.valor > 0 && (
              <span 
                className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 animate-fade-in ${
                  costoCocina.type === 'entrada'
                    ? 'bg-amber-50 text-amber-950 border-amber-300'
                    : 'bg-orange-50 text-orange-950 border-orange-200'
                }`}
                title={`Impacto contable en Cocina: ${costoCocina.label}`}
              >
                <span className="text-[10px] text-amber-800 uppercase font-semibold">Cocina:</span>
                <span>$ {formatMoney(costoCocina.valor)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Impacto en Stock */}
        {stockImpactHtml}

        {movimiento.observaciones && (
          <p className="text-[11px] text-slate-500 line-clamp-2 pt-0.5">
            {movimiento.observaciones.replace(/\[PENDIENTE_APROBAR\]/g, '').trim()}
          </p>
        )}

        {/* Botones de Acción */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
          {onDescartar && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onDescartar(movimiento.id)}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors touch-manipulation active:scale-95 cursor-pointer"
              title="Descartar movimiento"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {onOpenEdit && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onOpenEdit(movimiento)}
              className="px-3 py-1.5 min-h-[36px] text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors touch-manipulation active:scale-95 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          )}

          {isStockInsufficient && !isDateLocked && onOpenQuickAjuste && (
            <button
              type="button"
              onClick={() => onOpenQuickAjuste(movimiento)}
              className="px-3 py-1.5 min-h-[36px] text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 touch-manipulation cursor-pointer"
              title="Ajustar stock faltante por error de conteo para poder aprobar"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-700" />
              <span>Ajustar</span>
            </button>
          )}

          {onAprobar && (
            <button
              type="button"
              disabled={isLoading || isStockInsufficient || isDateLocked}
              onClick={() => onAprobar(movimiento.id)}
              className={`px-3.5 py-1.5 min-h-[36px] rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all touch-manipulation cursor-pointer ${
                isDateLocked
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : isStockInsufficient
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title={
                isDateLocked
                  ? `⚠️ Bloqueado: Primero debes aprobar los movimientos del día ${earliestPendingDate}`
                  : isStockInsufficient
                  ? 'No se puede aprobar: stock insuficiente en bodega. Usa el botón Ajustar.'
                  : 'Aprobar movimiento'
              }
            >
              {isDateLocked ? (
                <>
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Bloqueado</span>
                </>
              ) : isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aprobar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // HISTORIAL CARD
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs font-normal">
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${typeTag}`}>
          {typeLabel}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>{movimiento.usuario || 'Bodeguero'}</span>
          <span>•</span>
          <span>{timeStr || movimiento.fecha}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-medium text-slate-900 text-xs md:text-sm">{qtyText}</span>
        
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Costo Bodega: Siempre visible */}
          {costoBodega && costoBodega.valor > 0 && (
            <span 
              className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 ${
                costoBodega.type === 'salida'
                  ? 'bg-blue-50/90 text-blue-900 border-blue-200'
                  : costoBodega.type === 'entrada'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
              title={`Impacto contable en Bodega: ${costoBodega.label}`}
            >
              <span className="text-[10px] text-blue-700 uppercase font-semibold">Bodega:</span>
              <span>$ {formatMoney(costoBodega.valor)}</span>
            </span>
          )}

          {/* Costo Cocina: Solo si showCocinaCosts está activo */}
          {showCocinaCosts && costoCocina && costoCocina.valor > 0 && (
            <span 
              className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 animate-fade-in ${
                costoCocina.type === 'entrada'
                  ? 'bg-amber-50 text-amber-950 border-amber-300'
                  : 'bg-orange-50 text-orange-950 border-orange-200'
              }`}
              title={`Impacto contable en Cocina: ${costoCocina.label}`}
            >
              <span className="text-[10px] text-amber-800 uppercase font-semibold">Cocina:</span>
              <span>$ {formatMoney(costoCocina.valor)}</span>
            </span>
          )}
        </div>
      </div>

      {movimiento.observaciones && (
        <p className="text-[11px] text-slate-600 line-clamp-2 pt-0.5 border-t border-slate-100 mt-1">
          {movimiento.observaciones.replace(/\[PENDIENTE_APROBAR\]/g, '').trim()}
        </p>
      )}
    </div>
  );
}
