'use client';

import { InsumoItem, MovimientoItem } from '@/types';
import MovementItemCard from './MovementItemCard';

export interface GroupedMeatData {
  insumoId: string;
  carneName: string;
  categoria?: string;
  insumoObj?: InsumoItem;
  movs: MovimientoItem[];
  minTimestamp?: string;
  firstIndex?: number;
}

interface Props {
  group: GroupedMeatData;
  mode: 'PENDIENTES' | 'HISTORIAL';
  actionLoadingId?: string | null;
  earliestPendingDate?: string | null;
  showCocinaCosts?: boolean;
  onAprobar?: (id: string) => void;
  onDescartar?: (id: string) => void;
  onOpenEdit?: (m: MovimientoItem) => void;
  onOpenQuickAjuste?: (m: any, stock: any, carneName: string) => void;
}

export default function MovementGroupCard({
  group,
  mode,
  actionLoadingId,
  earliestPendingDate,
  showCocinaCosts = false,
  onAprobar,
  onDescartar,
  onOpenEdit,
  onOpenQuickAjuste,
}: Props) {
  const stock = group.insumoObj;

  const renderStockBadge = (st: any) => {
    if (!st) return 'Sin datos';
    const tipo = st.tipo_medida || 'KGS_Y_UNIDADES';
    if (tipo === 'UNIDADES') {
      return `${st.bodega_porc_und || 0} und`;
    }
    if (tipo === 'PAQUETES') {
      return `${st.bodega_porc_und || 0} paquetes`;
    }
    if (tipo === 'KGS') {
      return `${(st.bodega_sin_porc_kg || 0).toFixed(2)} Kg`;
    }
    return `${st.bodega_porc_und || 0} und (${(st.bodega_porc_kg || 0).toFixed(2)} Kg) / Entero: ${(st.bodega_sin_porc_kg || 0).toFixed(2)} Kg`;
  };

  const renderCocinaBadge = (st: any) => {
    if (!st) return null;
    const tipo = st.tipo_medida || 'KGS_Y_UNIDADES';
    if (tipo === 'UNIDADES') {
      if ((st.cocina_porc_und || 0) <= 0) return null;
      return `🍳 Cocina: ${st.cocina_porc_und} und`;
    }
    if (tipo === 'PAQUETES') {
      if ((st.cocina_porc_und || 0) <= 0) return null;
      return `🍳 Cocina: ${st.cocina_porc_und} paquetes`;
    }
    if (tipo === 'KGS') {
      if ((st.cocina_sin_porc_kg || 0) <= 0) return null;
      return `🍳 Cocina: ${(st.cocina_sin_porc_kg || 0).toFixed(2)} Kg`;
    }
    if ((st.cocina_porc_und || 0) <= 0 && (st.cocina_sin_porc_kg || 0) <= 0) return null;
    return `🍳 Cocina: ${st.cocina_porc_und || 0} und ${st.cocina_sin_porc_kg > 0 ? `(${st.cocina_sin_porc_kg.toFixed(1)} Kg)` : ''}`;
  };

  if (mode === 'HISTORIAL') {
    return (
      <div className="space-y-2 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        {/* Encabezado del Insumo */}
        <div className="flex items-center justify-between flex-wrap gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="font-medium text-slate-900 text-sm">{group.carneName}</span>
            {group.categoria && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                {group.categoria}
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-normal">
              • {group.movs.length} movimiento{group.movs.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Stock Actual */}
          <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
            <span className="text-slate-400">Stock Bodega:</span>
            <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              📦 {renderStockBadge(stock)}
            </span>
            {showCocinaCosts && renderCocinaBadge(stock) && (
              <span className="font-medium text-amber-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded animate-fade-in">
                {renderCocinaBadge(stock)}
              </span>
            )}
          </div>
        </div>

        {/* Tarjetas de Movimientos Aprobados de este Insumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-1">
          {group.movs.map((m) => (
            <MovementItemCard key={m.id} movimiento={m} mode="HISTORIAL" showCocinaCosts={showCocinaCosts} />
          ))}
        </div>
      </div>
    );
  }

  // PENDIENTES MODE
  let runningBSinPorc = stock ? parseFloat(String(stock.bodega_sin_porc_kg || 0)) : 0;
  let runningBPorcUnd = stock ? parseInt(String(stock.bodega_porc_und || 0)) : 0;
  let runningBPorcKg = stock ? parseFloat(String(stock.bodega_porc_kg || 0)) : 0;
  let runningCSinPorc = stock ? parseFloat(String(stock.cocina_sin_porc_kg || 0)) : 0;
  let runningCPorcUnd = stock ? parseInt(String(stock.cocina_porc_und || 0)) : 0;

  return (
    <div className="space-y-2">
      {/* Encabezado del Grupo de Carne con Stock Actual */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-200/70 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="font-medium text-slate-900 text-sm">{group.carneName}</span>
          <span className="text-[11px] text-slate-400 font-normal">
            ({group.movs.length} movimiento{group.movs.length !== 1 ? 's' : ''})
          </span>
        </div>
        {/* Stock Actual en Bodega */}
        <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
          <span className="text-slate-400">Stock Bodega:</span>
          <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
            📦 {renderStockBadge(stock)}
          </span>
          {showCocinaCosts && renderCocinaBadge(stock) && (
            <span className="font-medium text-amber-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded animate-fade-in">
              {renderCocinaBadge(stock)}
            </span>
          )}
        </div>
      </div>

      {/* Tarjetas de Movimientos de esta Carne con Simulación Progresiva */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-2">
        {group.movs.map((m: any) => {
          const tipo = m.tipo_movimiento;
          const dateStr = (m.fecha || m.fecha_hora || '').split('T')[0];
          const isLoading = actionLoadingId === m.id;
          const isDateLocked = earliestPendingDate ? dateStr > earliestPendingDate : false;

          let stockImpactHtml = null;
          let isStockInsufficient = false;

          const cantKg = parseFloat(String(m.cant_sin_porcionar_kg || 0));
          const porcUnd = parseInt(String(m.porciones_und || 0));
          const porcKg = parseFloat(String(m.peso_porciones_kg || 0));
          const tipoMedida = stock?.tipo_medida || m.catalogo_insumos?.tipo_medida || 'KGS_Y_UNIDADES';

          if (stock) {
            if (tipo === 'ENTRADA_COMPRA') {
              if (tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES') {
                const startUnd = runningBPorcUnd;
                const undToAdd = porcUnd > 0 ? porcUnd : cantKg;
                runningBPorcUnd += undToAdd;
                const unitStr = tipoMedida === 'PAQUETES' ? 'paquetes' : 'und';
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Bodega:</span>
                    <span>{startUnd} {unitStr}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-emerald-700 font-medium">
                      +{undToAdd} {unitStr} ({runningBPorcUnd} {unitStr})
                    </span>
                  </div>
                );
              } else {
                const startKg = runningBSinPorc;
                runningBSinPorc += cantKg;
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Bodega Entero:</span>
                    <span>{startKg.toFixed(2)} Kg</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-emerald-700 font-medium">
                      +{cantKg.toFixed(2)} Kg ({runningBSinPorc.toFixed(2)} Kg)
                    </span>
                  </div>
                );
              }
            } else if (tipo === 'PORCIONADO') {
              const startKg = runningBSinPorc;
              const resultKg = startKg - cantKg;
              isStockInsufficient = resultKg < 0;
              runningBSinPorc = Math.max(0, resultKg);
              runningBPorcUnd += porcUnd;
              runningBPorcKg += porcKg;

              stockImpactHtml = (
                <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500">Bodega Entero:</span>
                  <span>{startKg.toFixed(2)} Kg</span>
                  <span className="text-slate-400">➔</span>
                  <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                    {resultKg.toFixed(2)} Kg
                  </span>
                  {isStockInsufficient && (
                    <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                      ⚠️ Stock insuficiente
                    </span>
                  )}
                </div>
              );
            } else if (tipo === 'DEVOLUCION_COCINA') {
              if (tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES') {
                const undToReturn = porcUnd > 0 ? porcUnd : cantKg;
                const startUnd = runningBPorcUnd;
                runningBPorcUnd += undToReturn;
                runningCPorcUnd = Math.max(0, runningCPorcUnd - undToReturn);
                const unitStr = tipoMedida === 'PAQUETES' ? 'paquetes' : 'und';
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Reintegro Bodega:</span>
                    <span>{startUnd} {unitStr}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-emerald-700 font-medium">{runningBPorcUnd} {unitStr}</span>
                  </div>
                );
              } else if (porcUnd > 0) {
                const startUnd = runningBPorcUnd;
                runningBPorcUnd += porcUnd;
                runningCPorcUnd = Math.max(0, runningCPorcUnd - porcUnd);
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Reintegro Bodega:</span>
                    <span>{startUnd} und</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-emerald-700 font-medium">{runningBPorcUnd} und</span>
                  </div>
                );
              } else {
                const startKg = runningBSinPorc;
                runningBSinPorc += cantKg;
                runningCSinPorc = Math.max(0, runningCSinPorc - cantKg);
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Reintegro Bodega Entero:</span>
                    <span>{startKg.toFixed(2)} Kg</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-emerald-700 font-medium">{runningBSinPorc.toFixed(2)} Kg</span>
                  </div>
                );
              }
            } else if (tipo === 'TRASLADO_COCINA') {
              if (tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES') {
                const startUnd = runningBPorcUnd;
                const undToSub = porcUnd > 0 ? porcUnd : cantKg;
                const resultUnd = startUnd - undToSub;
                isStockInsufficient = resultUnd < 0;
                runningBPorcUnd = Math.max(0, resultUnd);
                runningCPorcUnd += undToSub;
                const unitStr = tipoMedida === 'PAQUETES' ? 'paquetes' : 'und';
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Bodega:</span>
                    <span>{startUnd} {unitStr}</span>
                    <span className="text-slate-400">➔</span>
                    <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                      {resultUnd} {unitStr}
                    </span>
                    {isStockInsufficient && (
                      <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                        ⚠️ Stock insuficiente
                      </span>
                    )}
                  </div>
                );
              } else if (tipoMedida === 'KGS') {
                const startKg = runningBSinPorc;
                const resultKg = startKg - cantKg;
                isStockInsufficient = resultKg < 0;
                runningBSinPorc = Math.max(0, resultKg);
                runningCSinPorc += cantKg;
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Bodega Entero:</span>
                    <span>{startKg.toFixed(2)} Kg</span>
                    <span className="text-slate-400">➔</span>
                    <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                      {resultKg.toFixed(2)} Kg
                    </span>
                    {isStockInsufficient && (
                      <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                        ⚠️ Stock insuficiente
                      </span>
                    )}
                  </div>
                );
              } else {
                // KGS_Y_UNIDADES: Soporte Híbrido Automático (Porciones Listas + Entero)
                if (porcUnd > 0) {
                  const startUnd = runningBPorcUnd;
                  const missingUnd = Math.max(0, porcUnd - startUnd);
                  const pesoStd = (stock.peso_estandar_porcion_kg || (porcUnd > 0 && porcKg > 0 ? porcKg / porcUnd : 0.35));
                  const neededKg = missingUnd > 0 ? parseFloat((missingUnd * pesoStd).toFixed(2)) : 0;

                  if (missingUnd === 0) {
                    // Hay suficientes porciones listas en bodega
                    runningBPorcUnd = startUnd - porcUnd;
                    runningCPorcUnd += porcUnd;
                    stockImpactHtml = (
                      <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">Bodega Porc:</span>
                        <span>{startUnd} und</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-slate-900 font-medium">{runningBPorcUnd} und</span>
                      </div>
                    );
                  } else if (runningBSinPorc >= neededKg) {
                    // Alcanza combinando porciones y entero (Auto-porcionado transparente)
                    const prevSin = runningBSinPorc;
                    runningBPorcUnd = 0;
                    runningBSinPorc = Math.max(0, runningBSinPorc - neededKg);
                    runningCPorcUnd += porcUnd;
                    isStockInsufficient = false;
                    stockImpactHtml = (
                      <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">Bodega Entero:</span>
                        <span>{prevSin.toFixed(2)} Kg</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-emerald-700 font-medium">{runningBSinPorc.toFixed(2)} Kg</span>
                        <span className="text-emerald-800 text-[10px] font-normal">
                          (-{neededKg.toFixed(2)} Kg autoporcionado para {porcUnd} porc)
                        </span>
                      </div>
                    );
                  } else {
                    // No alcanza ni con entero
                    isStockInsufficient = true;
                    runningBPorcUnd = startUnd - porcUnd;
                    runningCPorcUnd += porcUnd;
                    stockImpactHtml = (
                      <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-500">Bodega:</span>
                        <span>{startUnd} und</span>
                        <span className="text-slate-400">➔</span>
                        <span className="text-red-600 font-medium">{startUnd - porcUnd} und</span>
                        <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                          ⚠️ Stock insuficiente (Entero: {runningBSinPorc.toFixed(2)} Kg)
                        </span>
                      </div>
                    );
                  }
                } else {
                  // Traslado en pieza entera (Kg)
                  const startKg = runningBSinPorc;
                  const resultKg = startKg - cantKg;
                  isStockInsufficient = resultKg < 0;
                  runningBSinPorc = Math.max(0, resultKg);
                  runningCSinPorc += cantKg;
                  stockImpactHtml = (
                    <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-slate-500">Bodega Entero:</span>
                      <span>{startKg.toFixed(2)} Kg</span>
                      <span className="text-slate-400">➔</span>
                      <span className={isStockInsufficient ? 'text-red-600 font-medium' : 'text-slate-900 font-medium'}>
                        {resultKg.toFixed(2)} Kg
                      </span>
                      {isStockInsufficient && (
                        <span className="text-red-600 font-medium bg-red-100 px-1.5 py-0.2 rounded text-[10px]">
                          ⚠️ Stock insuficiente
                        </span>
                      )}
                    </div>
                  );
                }
              }
            } else if (tipo === 'BAJA_MERMA' || tipo === 'DESPERDICIO') {
              const origen = m.origen || 'BODEGA';
              if (tipoMedida === 'UNIDADES' || tipoMedida === 'PAQUETES') {
                const undToSub = porcUnd > 0 ? porcUnd : cantKg;
                const startUnd = origen.includes('COCINA') ? runningCPorcUnd : runningBPorcUnd;
                const resultUnd = startUnd - undToSub;
                isStockInsufficient = resultUnd < 0;
                if (origen.includes('COCINA')) {
                  runningCPorcUnd = Math.max(0, resultUnd);
                } else {
                  runningBPorcUnd = Math.max(0, resultUnd);
                }
                const unitStr = tipoMedida === 'PAQUETES' ? 'paquetes' : 'und';
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Baja en {origen.includes('COCINA') ? 'Cocina' : 'Bodega'}:</span>
                    <span>{startUnd} {unitStr}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-rose-700 font-medium">{Math.max(0, resultUnd)} {unitStr}</span>
                  </div>
                );
              } else if (origen.includes('PORCIONADO') || porcUnd > 0) {
                const startUnd = origen.includes('COCINA') ? runningCPorcUnd : runningBPorcUnd;
                const resultUnd = startUnd - porcUnd;
                isStockInsufficient = resultUnd < 0;
                if (origen.includes('COCINA')) {
                  runningCPorcUnd = Math.max(0, resultUnd);
                } else {
                  runningBPorcUnd = Math.max(0, resultUnd);
                }
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Baja en {origen.includes('COCINA') ? 'Cocina' : 'Bodega'}:</span>
                    <span>{startUnd} und</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-rose-700 font-medium">{Math.max(0, resultUnd)} und</span>
                  </div>
                );
              } else {
                const startKg = origen.includes('COCINA') ? runningCSinPorc : runningBSinPorc;
                const resultKg = startKg - cantKg;
                isStockInsufficient = resultKg < 0;
                if (origen.includes('COCINA')) {
                  runningCSinPorc = Math.max(0, resultKg);
                } else {
                  runningBSinPorc = Math.max(0, resultKg);
                }
                stockImpactHtml = (
                  <div className="text-[11px] pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500">Baja en {origen.includes('COCINA') ? 'Cocina' : 'Bodega'}:</span>
                    <span>{startKg.toFixed(2)} Kg</span>
                    <span className="text-slate-400">➔</span>
                    <span className="text-rose-700 font-medium">{Math.max(0, resultKg).toFixed(2)} Kg</span>
                  </div>
                );
              }
            }
          }

          return (
            <MovementItemCard
              key={m.id}
              movimiento={m}
              mode="PENDIENTES"
              isDateLocked={isDateLocked}
              isStockInsufficient={isStockInsufficient}
              stockImpactHtml={stockImpactHtml}
              isLoading={isLoading}
              earliestPendingDate={earliestPendingDate}
              showCocinaCosts={showCocinaCosts}
              onAprobar={onAprobar}
              onDescartar={onDescartar}
              onOpenEdit={onOpenEdit}
              onOpenQuickAjuste={() => onOpenQuickAjuste && onOpenQuickAjuste(m, stock, group.carneName)}
            />
          );
        })}
      </div>
    </div>
  );
}
