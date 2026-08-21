/**
 * Terminal del Bodeguero - Control Operativo en Tiempo Real con Buscador Inteligente
 * La Finca - Trazabilidad de Carnes y Movimientos
 */

const BodegueroTerminal = {
    inventario: [],
    insumosFiltrados: [],
    movimientosHistorial: [],
    activeTab: 'entrada-compra',
    filterCategoria: 'ALL',
    searchQuery: '',
    timelineFilterFecha: new Date().toISOString().split('T')[0],
    timelineFilterInsumo: 'ALL',

    init: async function() {
        this.bindEvents();
        this.initSmartSearches();
        await this.loadData();
        this.initTimelineFilters();
        await this.loadMovimientosTimeline();
        this.setupRealtime();
    },

    loadData: async function() {
        this.showLoading(true);
        try {
            const data = await StockService.getInventarioEnVivo();
            if (data && data.length > 0) {
                this.inventario = data;
            } else if (AppData.bodega && AppData.bodega.length > 0) {
                this.inventario = this.buildFallbackFromAppData();
            } else {
                this.inventario = [];
            }
            this.applyFilters();
            this.renderTablaStock();
        } catch (e) {
            console.error("Error cargando inventario en BodegueroTerminal:", e);
        } finally {
            this.showLoading(false);
        }
    },

    loadMovimientosTimeline: async function() {
        try {
            const data = await MovimientosService.getMovimientos(50);
            if (data && data.length > 0) {
                this.movimientosHistorial = data;
            } else if (this.movimientosHistorial.length === 0 && AppData.bodega && AppData.bodega.length > 0) {
                this.movimientosHistorial = this.buildFallbackTimeline();
            }
            this.renderTimeline();
        } catch (e) {
            console.error("Error cargando línea de tiempo:", e);
        }
    },

    setupRealtime: function() {
        StockService.subscribeRealtime(() => {
            console.log("🔄 Actualizando datos del bodeguero y timeline en vivo...");
            this.loadData();
            this.loadMovimientosTimeline();
        });
    },

    buildFallbackFromAppData: function() {
        const insumoMap = new Map();
        (AppData.bodega || []).forEach(b => {
            const nom = b.insumo;
            if (!nom) return;
            if (!insumoMap.has(nom) || b.fecha > insumoMap.get(nom).fecha) {
                insumoMap.set(nom, b);
            }
        });

        const list = [];
        insumoMap.forEach((b, nom) => {
            const costoU = 22000;
            const bSinPorc = parseFloat(b.pesoSinPorcBodega || b.stockInicialSinPorc) || 0;
            const bPorcUnd = parseInt(b.totalPorcBodega || b.stockInicialPorc) || 0;
            const bPorcKg = parseFloat(b.pesoPorcBodega || (bPorcUnd * 0.35)) || 0;
            const cSinPorc = 0;
            const cPorcUnd = parseInt(b.porcACocina) || 0;
            const cPorcKg = parseFloat(b.pesoACocina) || 0;
            const totalB = bSinPorc + bPorcKg;
            const totalC = cSinPorc + cPorcKg;
            const totalGen = totalB + totalC;
            const mermaKg = parseFloat(b.mermaKg) || 0;

            list.push({
                insumo_id: `fallback-${nom}`,
                codigo: `CAR-${Math.floor(100+Math.random()*800)}`,
                insumo: nom,
                categoria: b.tipo || 'CARNE DE RES',
                es_carne: true,
                unidad_medida: 'Kg',
                costo_unitario_kg: costoU,
                stock_minimo_kg: 10,
                peso_estandar_porcion_kg: 0.350,
                bodega_sin_porc_kg: bSinPorc,
                bodega_porc_und: bPorcUnd,
                bodega_porc_kg: bPorcKg,
                peso_total_bodega_kg: totalB,
                valor_bodega_pesos: totalB * costoU,
                cocina_sin_porc_kg: cSinPorc,
                cocina_porc_und: cPorcUnd,
                cocina_porc_kg: cPorcKg,
                peso_total_cocina_kg: totalC,
                valor_cocina_pesos: totalC * costoU,
                merma_acumulada_kg: mermaKg,
                merma_acumulada_pesos: mermaKg * costoU,
                peso_total_general_kg: totalGen,
                valor_total_general_pesos: totalGen * costoU,
                estado_stock: totalB === 0 ? 'AGOTADO' : (totalB <= 10 ? 'BAJO' : 'OPTIMO')
            });
        });
        return list;
    },

    bindEvents: function() {
        // Pestañas de operaciones
        const opTabs = document.querySelectorAll('.bodeguero-op-tab');
        opTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                opTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const targetTab = tab.getAttribute('data-tab');
                this.activeTab = targetTab;

                document.querySelectorAll('.bodeguero-op-form').forEach(f => f.classList.remove('active'));
                const targetForm = document.getElementById(`form-${targetTab}`);
                if (targetForm) targetForm.classList.add('active');

                this.updateActiveFormPreview();
            });
        });

        // Filtro de Categoría en la tabla
        const catBtns = document.querySelectorAll('.bod-cat-filter');
        catBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                catBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filterCategoria = btn.getAttribute('data-cat');
                this.applyFilters();
                this.renderTablaStock();
            });
        });

        // Buscador de insumo en tabla
        const searchInp = document.getElementById('bod-search-insumo');
        if (searchInp) {
            searchInp.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                this.applyFilters();
                this.renderTablaStock();
            });
        }

        // Listeners en Formularios para cálculos automáticos en vivo:
        // 1. Compra
        const compCant = document.getElementById('comp-cant-kg');
        const compTotal = document.getElementById('comp-costo-total');
        if (compCant) compCant.addEventListener('input', () => this.updateCompraPreview());
        if (compTotal) compTotal.addEventListener('input', () => this.updateCompraPreview());

        // 2. Porcionado
        const porcKgProc = document.getElementById('porc-kg-procesar');
        const porcUnds = document.getElementById('porc-unds-obtenidas');
        const porcPeso = document.getElementById('porc-peso-obtenido');
        if (porcKgProc) porcKgProc.addEventListener('input', () => this.updatePorcionadoPreview());
        if (porcUnds) porcUnds.addEventListener('input', () => this.autoCalcPorcWeight());
        if (porcPeso) porcPeso.addEventListener('input', () => this.updatePorcionadoPreview());

        // 3. Traslado a Cocina
        const trasTipo = document.getElementById('tras-tipo');
        const trasCant = document.getElementById('tras-cantidad');
        const trasPeso = document.getElementById('tras-peso-kg');
        if (trasTipo) trasTipo.addEventListener('change', () => {
            this.handleTrasladoTipoChange();
            this.updateTrasladoPreview();
        });
        if (trasCant) trasCant.addEventListener('input', () => this.updateTrasladoPreview());
        if (trasPeso) trasPeso.addEventListener('input', () => this.updateTrasladoPreview());

        // 4. Devolución de Cocina
        const devTipo = document.getElementById('dev-tipo');
        const devCant = document.getElementById('dev-cantidad');
        const devPeso = document.getElementById('dev-peso-kg');
        if (devTipo) devTipo.addEventListener('change', () => {
            this.handleDevolucionTipoChange();
            this.updateDevolucionPreview();
        });
        if (devCant) devCant.addEventListener('input', () => this.updateDevolucionPreview());
        if (devPeso) devPeso.addEventListener('input', () => this.updateDevolucionPreview());

        // Botones de Enviar
        document.getElementById('btn-submit-compra')?.addEventListener('click', () => this.submitCompra());
        document.getElementById('btn-submit-porcionado')?.addEventListener('click', () => this.submitPorcionado());
        document.getElementById('btn-submit-traslado')?.addEventListener('click', () => this.submitTraslado());
        document.getElementById('btn-submit-devolucion')?.addEventListener('click', () => this.submitDevolucion());

        // Cerrar dropdowns de búsqueda inteligente al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.smart-search-container')) {
                document.querySelectorAll('.smart-search-dropdown').forEach(dd => dd.classList.remove('show'));
            }
        });
    },

    // ==========================================
    // BUSCADOR INTELIGENTE (SMART AUTOCOMPLETE)
    // ==========================================

    initSmartSearches: function() {
        const prefixes = [
            { prefix: 'comp', previewFn: () => this.updateCompraPreview() },
            { prefix: 'porc', previewFn: () => this.updatePorcionadoPreview() },
            { prefix: 'tras', previewFn: () => this.updateTrasladoPreview() },
            { prefix: 'dev',  previewFn: () => this.updateDevolucionPreview() }
        ];

        prefixes.forEach(({ prefix, previewFn }) => {
            this.setupSmartSearch(prefix, previewFn);
        });
    },

    normalizeStr: function(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    },

    setupSmartSearch: function(prefix, onSelectedCallback) {
        const searchInput = document.getElementById(`${prefix}-search-input`);
        const hiddenInput = document.getElementById(`${prefix}-insumo`);
        const dropdown = document.getElementById(`${prefix}-search-dropdown`);
        const clearBtn = document.getElementById(`${prefix}-search-clear`);

        if (!searchInput || !dropdown) return;

        const renderResults = (query = '') => {
            const cleanQuery = this.normalizeStr(query);
            const words = cleanQuery.split(/\s+/).filter(w => w.length > 0);

            // Filtrar y calificar coincidencias
            const scoredItems = [];

            this.inventario.forEach(item => {
                const normName = this.normalizeStr(item.insumo);
                const normCat = this.normalizeStr(item.categoria);
                const normCode = this.normalizeStr(item.codigo);

                let score = 0;

                if (cleanQuery.length === 0) {
                    score = 10; // Mostrar todos si no hay texto escrito
                } else {
                    if (normName === cleanQuery) score += 100;
                    else if (normName.startsWith(cleanQuery)) score += 80;
                    else if (words.every(w => normName.includes(w))) score += 60;
                    else if (words.some(w => normName.includes(w))) score += 40;
                    else if (words.some(w => normCat.includes(w))) score += 30;
                    else if (words.some(w => normCode.includes(w))) score += 25;
                }

                if (score > 0) {
                    scoredItems.push({ item, score });
                }
            });

            // Ordenar por mejor coincidencia
            scoredItems.sort((a, b) => b.score - a.score);

            if (scoredItems.length === 0) {
                dropdown.innerHTML = `<div class="smart-search-empty">No se encontraron carnes o insumos con "<strong>${query}</strong>"</div>`;
                dropdown.classList.add('show');
                return;
            }

            dropdown.innerHTML = scoredItems.map(({ item }) => {
                let displayName = item.insumo;
                if (cleanQuery.length > 0) {
                    const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    displayName = item.insumo.replace(regex, '<mark>$1</mark>');
                }

                const stockBodegaTexto = `${item.bodega_sin_porc_kg.toFixed(1)} Kg ent | ${item.bodega_porc_und} porc`;

                return `
                    <div class="smart-search-item" data-id="${item.insumo_id}" data-name="${item.insumo}">
                        <div class="smart-search-item-left">
                            <span class="smart-search-item-name">${displayName}</span>
                            <span class="smart-search-item-cat">${item.categoria}</span>
                        </div>
                        <div class="smart-search-item-right">
                            <span class="smart-search-item-stock" title="Existencias en Bodega">Bodega: ${stockBodegaTexto}</span>
                            <span class="smart-search-item-price">$ ${this.formatMoney(item.costo_unitario_kg)} / Kg</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Click listener a cada resultado
            dropdown.querySelectorAll('.smart-search-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-id');
                    const name = el.getAttribute('data-name');
                    
                    hiddenInput.value = id;
                    searchInput.value = name;
                    searchInput.classList.add('item-selected');
                    if (clearBtn) clearBtn.style.display = 'flex';
                    dropdown.classList.remove('show');

                    if (typeof onSelectedCallback === 'function') onSelectedCallback();
                });
            });

            dropdown.classList.add('show');
        };

        // Eventos en el input
        searchInput.addEventListener('focus', () => {
            renderResults(searchInput.value);
        });

        searchInput.addEventListener('input', (e) => {
            hiddenInput.value = '';
            searchInput.classList.remove('item-selected');
            if (clearBtn) clearBtn.style.display = e.target.value ? 'flex' : 'none';
            renderResults(e.target.value);
            if (typeof onSelectedCallback === 'function') onSelectedCallback();
        });

        // Botón limpiar
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.resetSmartSearch(prefix);
                if (typeof onSelectedCallback === 'function') onSelectedCallback();
                searchInput.focus();
            });
        }
    },

    resetSmartSearch: function(prefix) {
        const searchInput = document.getElementById(`${prefix}-search-input`);
        const hiddenInput = document.getElementById(`${prefix}-insumo`);
        const clearBtn = document.getElementById(`${prefix}-search-clear`);
        const dropdown = document.getElementById(`${prefix}-search-dropdown`);

        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('item-selected');
        }
        if (hiddenInput) hiddenInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (dropdown) dropdown.classList.remove('show');
    },

    applyFilters: function() {
        this.insumosFiltrados = this.inventario.filter(item => {
            const matchesCat = this.filterCategoria === 'ALL' || 
                (this.filterCategoria === 'CARNES' && item.es_carne) ||
                item.categoria === this.filterCategoria;
            
            const matchesSearch = !this.searchQuery || 
                item.insumo.toLowerCase().includes(this.searchQuery) ||
                (item.codigo && item.codigo.toLowerCase().includes(this.searchQuery));

            return matchesCat && matchesSearch;
        });
    },

    renderTablaStock: function() {
        const tbody = document.getElementById('bod-tabla-stock-body');
        const cardsContainer = document.getElementById('bod-cards-stock-container');

        // 1. Calcular y actualizar KPIs generales en vivo
        let totalBodegaKg = 0;
        let totalBodegaPorcUnd = 0;
        let totalBodegaSinPorcKg = 0;
        let totalValorStock = 0;
        let totalMermaKg = 0;
        let totalMermaPesos = 0;

        (this.inventario || []).forEach(item => {
            totalBodegaKg += (item.peso_total_bodega_kg || 0);
            totalBodegaPorcUnd += (item.bodega_porc_und || 0);
            totalBodegaSinPorcKg += (item.bodega_sin_porc_kg || 0);
            totalValorStock += (item.valor_total_general_pesos || 0);
            const mKg = parseFloat(item.merma_acumulada_kg) || 0;
            const mPesos = parseFloat(item.merma_acumulada_pesos) || (mKg * (item.costo_unitario_kg || 0));
            totalMermaKg += mKg;
            totalMermaPesos += mPesos;
        });

        const kpiStockKg = document.getElementById('kpi-inv-stock-kg');
        const kpiStockSub = document.getElementById('kpi-inv-stock-sub');
        const kpiPorcUnd = document.getElementById('kpi-inv-porc-und');
        const kpiValor = document.getElementById('kpi-inv-valor-total');
        const kpiMermaKg = document.getElementById('kpi-inv-merma-kg');
        const kpiMermaPesos = document.getElementById('kpi-inv-merma-pesos');

        if (kpiStockKg) kpiStockKg.textContent = `${totalBodegaKg.toFixed(1)} Kg`;
        if (kpiStockSub) kpiStockSub.textContent = `${totalBodegaSinPorcKg.toFixed(1)} Kg ent | ${totalBodegaPorcUnd} porc`;
        if (kpiPorcUnd) kpiPorcUnd.textContent = `${totalBodegaPorcUnd} und`;
        if (kpiValor) kpiValor.textContent = `$ ${this.formatMoney(totalValorStock)}`;
        if (kpiMermaKg) kpiMermaKg.textContent = `${totalMermaKg.toFixed(2)} Kg`;
        if (kpiMermaPesos) kpiMermaPesos.textContent = `$ ${this.formatMoney(totalMermaPesos)} en pérdidas`;

        // 2. Renderizar Tabla para Desktop
        if (tbody) {
            if (this.insumosFiltrados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron carnes que coincidan con la búsqueda.</td></tr>`;
            } else {
                tbody.innerHTML = this.insumosFiltrados.map(item => {
                    const estadoBadge = item.estado_stock === 'AGOTADO'
                        ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;">AGOTADO</span>`
                        : item.estado_stock === 'BAJO'
                        ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;">BAJO</span>`
                        : `<span class="badge" style="background:#d1fae5; color:#047857; font-weight:700;">ÓPTIMO</span>`;

                    const mermaKg = parseFloat(item.merma_acumulada_kg) || 0;
                    const mermaPesos = parseFloat(item.merma_acumulada_pesos) || (mermaKg * (item.costo_unitario_kg || 0));
                    const mermaHtml = mermaKg > 0
                        ? `<span style="font-weight: 700; color: #dc2626;">${mermaKg.toFixed(2)} Kg</span>
                           <div style="font-size: 0.75rem; color: #b91c1c; font-weight: 600;">$ ${this.formatMoney(mermaPesos)}</div>`
                        : `<span style="color: var(--text-muted); font-size: 0.85rem;">0.00 Kg</span>
                           <div style="font-size: 0.72rem; color: var(--text-muted);">$ 0</div>`;

                    return `
                        <tr>
                            <td style="font-weight: 600;">
                                ${item.insumo}
                                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">${item.categoria}</div>
                            </td>
                            <td style="text-align: right; font-weight: 600; color: #2563eb;">
                                ${item.bodega_sin_porc_kg.toFixed(2)} <span style="font-size:0.75rem; color:var(--text-muted);">Kg</span>
                            </td>
                            <td style="text-align: right;">
                                <span style="font-weight: 600; color: #7c3aed;">${item.bodega_porc_und}</span> <span style="font-size:0.75rem;">und</span>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${item.bodega_porc_kg.toFixed(2)} Kg</div>
                            </td>
                            <td style="text-align: right; font-weight: 600; color: #059669;">
                                ${item.peso_total_bodega_kg.toFixed(2)} <span style="font-size:0.75rem; color:var(--text-muted);">Kg</span>
                            </td>
                            <td style="text-align: right;">
                                <span style="font-weight: 600; color: #d97706;">${item.cocina_porc_und}</span> <span style="font-size:0.75rem;">und</span>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${item.cocina_porc_kg.toFixed(2)} Kg</div>
                            </td>
                            <td style="text-align: right; background: rgba(239, 68, 68, 0.04);">
                                ${mermaHtml}
                            </td>
                            <td style="text-align: right; color: var(--text-muted);">
                                $ ${this.formatMoney(item.costo_unitario_kg)}
                            </td>
                            <td style="text-align: right; font-weight: 700; color: #0284c7;">
                                $ ${this.formatMoney(item.valor_total_general_pesos)}
                            </td>
                            <td style="text-align: center;">
                                ${estadoBadge}
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 3. Renderizar Tarjetas para Móviles
        if (cardsContainer) {
            if (this.insumosFiltrados.length === 0) {
                cardsContainer.innerHTML = `<div style="text-align:center; padding: 2rem; color: #94a3b8;">No se encontraron carnes que coincidan con la búsqueda.</div>`;
            } else {
                cardsContainer.innerHTML = this.insumosFiltrados.map(item => {
                    const estadoBadge = item.estado_stock === 'AGOTADO'
                        ? `<span class="badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;">AGOTADO</span>`
                        : item.estado_stock === 'BAJO'
                        ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;">BAJO</span>`
                        : `<span class="badge" style="background:#d1fae5; color:#047857; font-weight:700;">ÓPTIMO</span>`;

                    const mermaKg = parseFloat(item.merma_acumulada_kg) || 0;
                    const mermaPesos = parseFloat(item.merma_acumulada_pesos) || (mermaKg * (item.costo_unitario_kg || 0));

                    return `
                        <div class="stock-card-item">
                            <div class="stock-card-header">
                                <div>
                                    <div class="stock-card-title">${item.insumo}</div>
                                    <div class="stock-card-cat">${item.categoria}</div>
                                </div>
                                <div>${estadoBadge}</div>
                            </div>
                            <div class="stock-card-grid">
                                <div class="stock-card-metric">
                                    <span class="metric-label">📦 Bodega Entero</span>
                                    <span class="metric-val" style="color: #2563eb;">${item.bodega_sin_porc_kg.toFixed(2)} Kg</span>
                                </div>
                                <div class="stock-card-metric">
                                    <span class="metric-label">✂️ Bodega Porciones</span>
                                    <span class="metric-val" style="color: #7c3aed;">${item.bodega_porc_und} und <small>(${item.bodega_porc_kg.toFixed(2)} Kg)</small></span>
                                </div>
                                <div class="stock-card-metric">
                                    <span class="metric-label">🍳 En Cocina</span>
                                    <span class="metric-val" style="color: #d97706;">${item.cocina_porc_und} und <small>(${item.cocina_porc_kg.toFixed(2)} Kg)</small></span>
                                </div>
                                <div class="stock-card-metric">
                                    <span class="metric-label">📉 Merma Acum.</span>
                                    <span class="metric-val" style="color: #dc2626;">${mermaKg > 0 ? `${mermaKg.toFixed(2)} Kg ($ ${this.formatMoney(mermaPesos)})` : '0.00 Kg'}</span>
                                </div>
                            </div>
                            <div class="stock-card-footer">
                                <span><strong>Valor Stock:</strong> $ ${this.formatMoney(item.valor_total_general_pesos)}</span>
                                <span><strong>Costo/Kg:</strong> $ ${this.formatMoney(item.costo_unitario_kg)}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    // ==========================================
    // CÁLCULOS Y PREVIEWS EN TIEMPO REAL
    // ==========================================

    updateActiveFormPreview: function() {
        if (this.activeTab === 'entrada-compra') this.updateCompraPreview();
        if (this.activeTab === 'porcionado') this.updatePorcionadoPreview();
        if (this.activeTab === 'traslado-cocina') this.updateTrasladoPreview();
        if (this.activeTab === 'devolucion-cocina') this.updateDevolucionPreview();
    },

    getInsumoById: function(id) {
        if (!id) return null;
        return this.inventario.find(i => i.insumo_id === id) || null;
    },

    // 1. PREVIEW COMPRA
    updateCompraPreview: function() {
        const insumoId = document.getElementById('comp-insumo')?.value;
        const cantKg = parseFloat(document.getElementById('comp-cant-kg')?.value) || 0;
        const totalPesos = parseFloat(document.getElementById('comp-costo-total')?.value) || 0;
        const previewBox = document.getElementById('comp-preview-box');
        if (!previewBox) return;

        const insumo = this.getInsumoById(insumoId);
        if (!insumo) {
            previewBox.innerHTML = `<div class="preview-placeholder">Escribe y selecciona un insumo arriba para ver la proyección del movimiento.</div>`;
            return;
        }

        const prevKg = insumo.bodega_sin_porc_kg;
        const newKg = prevKg + cantKg;
        const costoUnit = cantKg > 0 ? (totalPesos / cantKg) : insumo.costo_unitario_kg;

        previewBox.innerHTML = `
            <div class="preview-card">
                <div class="preview-title">Impacto en Inventario: ${insumo.insumo}</div>
                <div class="preview-grid">
                    <div class="preview-item">
                        <span class="lbl">Stock Entero en Bodega:</span>
                        <span class="val">${prevKg.toFixed(2)} Kg &nbsp;➔&nbsp; <strong style="color:#10b981;">${newKg.toFixed(2)} Kg</strong></span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Costo por Kg estimado:</span>
                        <span class="val">$ ${this.formatMoney(costoUnit)} / Kg</span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Nuevo Valor en Bodega:</span>
                        <span class="val">$ ${this.formatMoney(newKg * costoUnit)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // 2. PREVIEW PORCIONADO
    autoCalcPorcWeight: function() {
        const insumoId = document.getElementById('porc-insumo')?.value;
        const unds = parseInt(document.getElementById('porc-unds-obtenidas')?.value) || 0;
        const pesoInp = document.getElementById('porc-peso-obtenido');
        const insumo = this.getInsumoById(insumoId);

        if (insumo && unds > 0 && pesoInp && !pesoInp.value) {
            const stdWeight = insumo.peso_estandar_porcion_kg || 0.350;
            pesoInp.value = (unds * stdWeight).toFixed(2);
        }
        this.updatePorcionadoPreview();
    },

    updatePorcionadoPreview: function() {
        const insumoId = document.getElementById('porc-insumo')?.value;
        const kgAProcesar = parseFloat(document.getElementById('porc-kg-procesar')?.value) || 0;
        const unds = parseInt(document.getElementById('porc-unds-obtenidas')?.value) || 0;
        const pesoPorcKg = parseFloat(document.getElementById('porc-peso-obtenido')?.value) || 0;
        const previewBox = document.getElementById('porc-preview-box');
        if (!previewBox) return;

        const insumo = this.getInsumoById(insumoId);
        if (!insumo) {
            previewBox.innerHTML = `<div class="preview-placeholder">Escribe y selecciona la carne arriba para calcular rendimiento y merma.</div>`;
            return;
        }

        const prevSinPorc = insumo.bodega_sin_porc_kg;
        const prevPorcUnd = insumo.bodega_porc_und;
        const prevPorcKg = insumo.bodega_porc_kg;

        const newSinPorc = Math.max(0, prevSinPorc - kgAProcesar);
        const newPorcUnd = prevPorcUnd + unds;
        const newPorcKg = prevPorcKg + pesoPorcKg;

        const mermaKg = Math.max(0, kgAProcesar - pesoPorcKg);
        const rendimientoPct = kgAProcesar > 0 ? ((pesoPorcKg / kgAProcesar) * 100) : 100;
        const mermaPct = 100 - rendimientoPct;

        const pesoPromedioObtenido = unds > 0 ? (pesoPorcKg / unds) : 0;

        let warning = '';
        if (kgAProcesar > prevSinPorc) {
            warning = `<div class="alert-box-warning" style="margin-top:0.5rem; color:#ef4444; font-size:0.8rem; font-weight:600;">⚠️ Atención: La cantidad a procesar (${kgAProcesar} Kg) supera el stock disponible sin porcionar (${prevSinPorc.toFixed(2)} Kg).</div>`;
        }

        previewBox.innerHTML = `
            <div class="preview-card">
                <div class="preview-title">Resultado de Rendimiento y Porcionado</div>
                <div class="preview-grid">
                    <div class="preview-item">
                        <span class="lbl">Bodega - Piezas Enteras:</span>
                        <span class="val">${prevSinPorc.toFixed(2)} Kg &nbsp;➔&nbsp; <strong style="color:#ef4444;">${newSinPorc.toFixed(2)} Kg</strong></span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Bodega - Porciones Listas:</span>
                        <span class="val">${prevPorcUnd} und (${prevPorcKg.toFixed(2)} Kg) &nbsp;➔&nbsp; <strong style="color:#10b981;">${newPorcUnd} und (${newPorcKg.toFixed(2)} Kg)</strong></span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Rendimiento del Corte:</span>
                        <span class="val" style="color:#38bdf8; font-weight:700;">${rendimientoPct.toFixed(1)}% &nbsp; (Merma: ${mermaKg.toFixed(2)} Kg / ${mermaPct.toFixed(1)}%)</span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Gramaje promedio real por porción:</span>
                        <span class="val">${(pesoPromedioObtenido * 1000).toFixed(0)} gramos / porción</span>
                    </div>
                </div>
                ${warning}
            </div>
        `;
    },

    // 3. PREVIEW TRASLADO A COCINA
    handleTrasladoTipoChange: function() {
        const esPorc = document.getElementById('tras-tipo')?.value === 'PORCIONES';
        const undGroup = document.getElementById('tras-cant-group');
        const lblPeso = document.getElementById('lbl-tras-peso');
        if (undGroup) undGroup.style.display = esPorc ? 'block' : 'none';
        if (lblPeso) lblPeso.textContent = esPorc ? 'Peso total de las porciones (Kg)' : 'Peso de la pieza a entregar (Kg)';
    },

    updateTrasladoPreview: function() {
        const insumoId = document.getElementById('tras-insumo')?.value;
        const esPorc = document.getElementById('tras-tipo')?.value === 'PORCIONES';
        const cant = parseInt(document.getElementById('tras-cantidad')?.value) || 0;
        let pesoKg = parseFloat(document.getElementById('tras-peso-kg')?.value) || 0;
        const previewBox = document.getElementById('tras-preview-box');
        if (!previewBox) return;

        const insumo = this.getInsumoById(insumoId);
        if (!insumo) {
            previewBox.innerHTML = `<div class="preview-placeholder">Escribe y selecciona el insumo arriba para ver la proyección del traslado.</div>`;
            return;
        }

        if (esPorc && cant > 0 && (!pesoKg || pesoKg === 0)) {
            pesoKg = cant * (insumo.peso_estandar_porcion_kg || 0.35);
            const pesoInp = document.getElementById('tras-peso-kg');
            if (pesoInp && !pesoInp.value) pesoInp.value = pesoKg.toFixed(2);
        }

        let bodegaAntes = '', bodegaDespues = '', cocinaAntes = '', cocinaDespues = '';
        let hasError = false;

        if (esPorc) {
            bodegaAntes = `${insumo.bodega_porc_und} und (${insumo.bodega_porc_kg.toFixed(2)} Kg)`;
            const newBodUnd = insumo.bodega_porc_und - cant;
            const newBodKg = Math.max(0, insumo.bodega_porc_kg - pesoKg);
            bodegaDespues = `${newBodUnd} und (${newBodKg.toFixed(2)} Kg)`;

            cocinaAntes = `${insumo.cocina_porc_und} und (${insumo.cocina_porc_kg.toFixed(2)} Kg)`;
            const newCocUnd = insumo.cocina_porc_und + cant;
            const newCocKg = insumo.cocina_porc_kg + pesoKg;
            cocinaDespues = `${newCocUnd} und (${newCocKg.toFixed(2)} Kg)`;

            if (cant > insumo.bodega_porc_und) hasError = true;
        } else {
            bodegaAntes = `${insumo.bodega_sin_porc_kg.toFixed(2)} Kg`;
            const newBodKg = Math.max(0, insumo.bodega_sin_porc_kg - pesoKg);
            bodegaDespues = `${newBodKg.toFixed(2)} Kg`;

            cocinaAntes = `${insumo.cocina_sin_porc_kg.toFixed(2)} Kg`;
            const newCocKg = insumo.cocina_sin_porc_kg + pesoKg;
            cocinaDespues = `${newCocKg.toFixed(2)} Kg`;

            if (pesoKg > insumo.bodega_sin_porc_kg) hasError = true;
        }

        previewBox.innerHTML = `
            <div class="preview-card">
                <div class="preview-title">Traslado a Cocina: ${insumo.insumo}</div>
                <div class="preview-grid">
                    <div class="preview-item">
                        <span class="lbl">Queda en Bodega:</span>
                        <span class="val">${bodegaAntes} &nbsp;➔&nbsp; <strong style="color:#ef4444;">${bodegaDespues}</strong></span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Pasa a estar en Cocina:</span>
                        <span class="val">${cocinaAntes} &nbsp;➔&nbsp; <strong style="color:#10b981;">${cocinaDespues}</strong></span>
                    </div>
                </div>
                ${hasError ? `<div class="alert-box-warning" style="margin-top:0.5rem; color:#ef4444; font-size:0.8rem; font-weight:600;">⚠️ Cantidad solicitada supera el stock disponible en bodega.</div>` : ''}
            </div>
        `;
    },

    // 4. PREVIEW DEVOLUCIÓN DE COCINA
    handleDevolucionTipoChange: function() {
        const esPorc = document.getElementById('dev-tipo')?.value === 'PORCIONES';
        const undGroup = document.getElementById('dev-cant-group');
        const lblPeso = document.getElementById('lbl-dev-peso');
        if (undGroup) undGroup.style.display = esPorc ? 'block' : 'none';
        if (lblPeso) lblPeso.textContent = esPorc ? 'Peso de porciones devueltas (Kg)' : 'Peso devuelto a bodega (Kg)';
    },

    updateDevolucionPreview: function() {
        const insumoId = document.getElementById('dev-insumo')?.value;
        const esPorc = document.getElementById('dev-tipo')?.value === 'PORCIONES';
        const cant = parseInt(document.getElementById('dev-cantidad')?.value) || 0;
        let pesoKg = parseFloat(document.getElementById('dev-peso-kg')?.value) || 0;
        const previewBox = document.getElementById('dev-preview-box');
        if (!previewBox) return;

        const insumo = this.getInsumoById(insumoId);
        if (!insumo) {
            previewBox.innerHTML = `<div class="preview-placeholder">Escribe y selecciona el insumo arriba para ver el reingreso a bodega.</div>`;
            return;
        }

        if (esPorc && cant > 0 && (!pesoKg || pesoKg === 0)) {
            pesoKg = cant * (insumo.peso_estandar_porcion_kg || 0.35);
            const pesoInp = document.getElementById('dev-peso-kg');
            if (pesoInp && !pesoInp.value) pesoInp.value = pesoKg.toFixed(2);
        }

        let bodegaAntes = '', bodegaDespues = '', cocinaAntes = '', cocinaDespues = '';

        if (esPorc) {
            bodegaAntes = `${insumo.bodega_porc_und} und (${insumo.bodega_porc_kg.toFixed(2)} Kg)`;
            const newBodUnd = insumo.bodega_porc_und + cant;
            const newBodKg = insumo.bodega_porc_kg + pesoKg;
            bodegaDespues = `${newBodUnd} und (${newBodKg.toFixed(2)} Kg)`;

            cocinaAntes = `${insumo.cocina_porc_und} und (${insumo.cocina_porc_kg.toFixed(2)} Kg)`;
            const newCocUnd = Math.max(0, insumo.cocina_porc_und - cant);
            const newCocKg = Math.max(0, insumo.cocina_porc_kg - pesoKg);
            cocinaDespues = `${newCocUnd} und (${newCocKg.toFixed(2)} Kg)`;
        } else {
            bodegaAntes = `${insumo.bodega_sin_porc_kg.toFixed(2)} Kg`;
            const newBodKg = insumo.bodega_sin_porc_kg + pesoKg;
            bodegaDespues = `${newBodKg.toFixed(2)} Kg`;

            cocinaAntes = `${insumo.cocina_sin_porc_kg.toFixed(2)} Kg`;
            const newCocKg = Math.max(0, insumo.cocina_sin_porc_kg - pesoKg);
            cocinaDespues = `${newCocKg.toFixed(2)} Kg`;
        }

        previewBox.innerHTML = `
            <div class="preview-card">
                <div class="preview-title">Devolución de Cocina: ${insumo.insumo}</div>
                <div class="preview-grid">
                    <div class="preview-item">
                        <span class="lbl">Reingresa a Bodega:</span>
                        <span class="val">${bodegaAntes} &nbsp;➔&nbsp; <strong style="color:#10b981;">${bodegaDespues}</strong></span>
                    </div>
                    <div class="preview-item">
                        <span class="lbl">Queda en Cocina:</span>
                        <span class="val">${cocinaAntes} &nbsp;➔&nbsp; <strong style="color:#ef4444;">${cocinaDespues}</strong></span>
                    </div>
                </div>
            </div>
        `;
    },

    // ==========================================
    // ACCIONES DE ENVÍO Y PERSISTENCIA
    // ==========================================

    submitCompra: async function() {
        const insumoId = document.getElementById('comp-insumo')?.value;
        const proveedor = (document.getElementById('comp-proveedor')?.value || '').trim();
        const factura = (document.getElementById('comp-factura')?.value || '').trim();
        const cantidadKg = parseFloat(document.getElementById('comp-cant-kg')?.value);
        let costoTotal = parseFloat(document.getElementById('comp-costo-total')?.value);
        const obs = document.getElementById('comp-obs')?.value;

        if (!insumoId) return alert("Por favor busca y selecciona una carne o insumo.");
        if (!cantidadKg || cantidadKg <= 0) return alert("Ingresa una cantidad válida en Kg.");

        const insumo = this.getInsumoById(insumoId);
        // Si el bodeguero no tiene el costo exacto de la factura, estimamos con base al costo actual de catálogo
        if (!costoTotal || costoTotal <= 0) {
            const costoUnit = insumo ? (insumo.costo_unitario_kg || 22000) : 22000;
            costoTotal = cantidadKg * costoUnit;
        }

        const esFacturaCompleta = Boolean(factura && proveedor);
        const estadoFactura = esFacturaCompleta ? 'COMPLETA' : 'PENDIENTE';

        const btn = document.getElementById('btn-submit-compra');
        btn.disabled = true;
        btn.innerHTML = `<span>Registrando...</span>`;

        try {
            const res = await MovimientosService.registrarEntradaCompra({
                insumoId,
                proveedor: proveedor || 'Pendiente de Factura',
                factura: factura || null,
                cantidadKg,
                costoTotal,
                observaciones: obs || (esFacturaCompleta ? 'Ingreso con factura completa' : '⚠️ Factura/Proveedor pendiente por completar en administración'),
                usuario: 'Bodeguero'
            });

            // Sincronizar inmediatamente con AppData.compras para que se vea en el módulo de compras
            if (!AppData.compras) AppData.compras = [];
            const nuevaCompra = {
                id: res?.compra?.id || `comp-${Date.now()}`,
                fecha: new Date().toISOString().split('T')[0],
                fecha_hora: new Date().toISOString(),
                categoria: insumo?.categoria || 'CARNES',
                insumo: insumo?.insumo || 'Insumo',
                insumo_id: insumoId,
                cantidad: cantidadKg,
                costoUnitario: cantidadKg > 0 ? (costoTotal / cantidadKg) : (insumo?.costo_unitario_kg || 0),
                total: costoTotal,
                proveedor: proveedor || 'Pendiente de Factura',
                factura: factura || 'Pendiente',
                estado_factura: estadoFactura,
                observaciones: obs || (esFacturaCompleta ? '' : 'Pendiente revisión administrativa')
            };

            AppData.compras.unshift(nuevaCompra);

            // Actualizar vista de compras si está disponible
            if (typeof Compras !== 'undefined' && Compras.updateView) {
                Compras.updateView();
            }

            const msgExito = esFacturaCompleta
                ? "✅ Compra registrada e ingresada a bodega con éxito."
                : "✅ Ingreso a bodega registrado. La compra quedó marcada como 'PENDIENTE' para completar factura por administración.";

            this.showToast(msgExito);
            this.resetSmartSearch('comp');
            document.getElementById('comp-cant-kg').value = '';
            document.getElementById('comp-costo-total').value = '';
            document.getElementById('comp-proveedor').value = '';
            document.getElementById('comp-factura').value = '';
            document.getElementById('comp-obs').value = '';
            this.updateCompraPreview();
            await this.loadData();
            await this.loadMovimientosTimeline();
        } catch (e) {
            console.error(e);
            alert("Error al registrar compra: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="plus-circle"></i><span>Registrar Ingreso a Bodega</span>`;
            lucide.createIcons();
        }
    },

    submitPorcionado: async function() {
        const insumoId = document.getElementById('porc-insumo')?.value;
        const kgAProcesar = parseFloat(document.getElementById('porc-kg-procesar')?.value);
        const porcionesObtenidas = parseInt(document.getElementById('porc-unds-obtenidas')?.value);
        const pesoPorcionesKg = parseFloat(document.getElementById('porc-peso-obtenido')?.value);
        const obs = document.getElementById('porc-obs')?.value;

        if (!insumoId) return alert("Busca y selecciona la carne a procesar.");
        if (!kgAProcesar || kgAProcesar <= 0) return alert("Ingresa los kilogramos de pieza entera a procesar.");
        if (!porcionesObtenidas || porcionesObtenidas <= 0) return alert("Ingresa el número de porciones obtenidas.");
        if (!pesoPorcionesKg || pesoPorcionesKg <= 0) return alert("Ingresa el peso total obtenido de las porciones.");

        const btn = document.getElementById('btn-submit-porcionado');
        btn.disabled = true;
        btn.innerHTML = `<span>Guardando...</span>`;

        try {
            await MovimientosService.registrarPorcionado({
                insumoId,
                kgAProcesar,
                porcionesObtenidas,
                pesoPorcionesKg,
                observaciones: obs
            });

            this.showToast("✅ Porcionado registrado y saldos actualizados.");
            this.resetSmartSearch('porc');
            document.getElementById('porc-kg-procesar').value = '';
            document.getElementById('porc-unds-obtenidas').value = '';
            document.getElementById('porc-peso-obtenido').value = '';
            document.getElementById('porc-obs').value = '';
            this.updatePorcionadoPreview();
            await this.loadData();
            await this.loadMovimientosTimeline();
        } catch (e) {
            console.error(e);
            alert("Error al registrar porcionado: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="scissors"></i><span>Guardar Porcionado y Merma</span>`;
            lucide.createIcons();
        }
    },

    submitTraslado: async function() {
        const insumoId = document.getElementById('tras-insumo')?.value;
        const esPorcionado = document.getElementById('tras-tipo')?.value === 'PORCIONES';
        const cantidad = esPorcionado ? parseInt(document.getElementById('tras-cantidad')?.value) : 0;
        const pesoKg = parseFloat(document.getElementById('tras-peso-kg')?.value);
        const obs = document.getElementById('tras-obs')?.value;

        if (!insumoId) return alert("Busca y selecciona el insumo a despachar a cocina.");
        if (esPorcionado && (!cantidad || cantidad <= 0)) return alert("Ingresa el número de porciones.");
        if (!pesoKg || pesoKg <= 0) return alert("Ingresa el peso en Kg.");

        const btn = document.getElementById('btn-submit-traslado');
        btn.disabled = true;
        btn.innerHTML = `<span>Despachando...</span>`;

        try {
            await MovimientosService.registrarTrasladoCocina({
                insumoId,
                esPorcionado,
                cantidad,
                pesoKg,
                observaciones: obs
            });

            this.showToast("✅ Despacho a cocina registrado con éxito.");
            this.resetSmartSearch('tras');
            document.getElementById('tras-cantidad').value = '';
            document.getElementById('tras-peso-kg').value = '';
            document.getElementById('tras-obs').value = '';
            this.updateTrasladoPreview();
            await this.loadData();
            await this.loadMovimientosTimeline();
        } catch (e) {
            console.error(e);
            alert("Error al registrar traslado: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="arrow-right-circle"></i><span>Despachar a Cocina</span>`;
            lucide.createIcons();
        }
    },

    submitDevolucion: async function() {
        const insumoId = document.getElementById('dev-insumo')?.value;
        const esPorcionado = document.getElementById('dev-tipo')?.value === 'PORCIONES';
        const cantidad = esPorcionado ? parseInt(document.getElementById('dev-cantidad')?.value) : 0;
        const pesoKg = parseFloat(document.getElementById('dev-peso-kg')?.value);
        const obs = document.getElementById('dev-obs')?.value;

        if (!insumoId) return alert("Busca y selecciona el insumo que regresa a bodega.");
        if (esPorcionado && (!cantidad || cantidad <= 0)) return alert("Ingresa el número de porciones devueltas.");
        if (!pesoKg || pesoKg <= 0) return alert("Ingresa el peso en Kg.");

        const btn = document.getElementById('btn-submit-devolucion');
        btn.disabled = true;
        btn.innerHTML = `<span>Reintegrando...</span>`;

        try {
            await MovimientosService.registrarDevolucionCocina({
                insumoId,
                esPorcionado,
                cantidad,
                pesoKg,
                observaciones: obs
            });

            this.showToast("✅ Devolución reintegrada a bodega correctamente.");
            this.resetSmartSearch('dev');
            document.getElementById('dev-cantidad').value = '';
            document.getElementById('dev-peso-kg').value = '';
            document.getElementById('dev-obs').value = '';
            this.updateDevolucionPreview();
            await this.loadData();
            await this.loadMovimientosTimeline();
        } catch (e) {
            console.error(e);
            alert("Error al registrar devolución: " + e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="corner-down-left"></i><span>Registrar Devolución</span>`;
            lucide.createIcons();
        }
    },

    // ==========================================
    // RENDERIZADO Y FILTROS DE LÍNEA DE TIEMPO
    // ==========================================

    initTimelineFilters: function() {
        const fechaInput = document.getElementById('timeline-filter-fecha');
        const btnToday = document.getElementById('timeline-btn-today');
        const btnAllDates = document.getElementById('timeline-btn-all-dates');

        // 1. Inicializar fecha con Hoy
        const todayStr = new Date().toISOString().split('T')[0];
        this.timelineFilterFecha = todayStr;
        if (fechaInput) {
            fechaInput.value = todayStr;
            fechaInput.addEventListener('change', (e) => {
                this.timelineFilterFecha = e.target.value;
                if (btnToday) btnToday.classList.toggle('active', e.target.value === todayStr);
                if (btnAllDates) btnAllDates.classList.toggle('active', !e.target.value);
                this.resetTimelineSearch();
                this.renderTimeline();
            });
        }

        // 2. Configurar Buscador Inteligente de Carnes para la Línea de Tiempo
        this.setupTimelineSmartSearch();

        // 3. Botones rápidos de fecha
        if (btnToday) {
            btnToday.addEventListener('click', () => {
                const today = new Date().toISOString().split('T')[0];
                this.timelineFilterFecha = today;
                if (fechaInput) fechaInput.value = today;
                btnToday.classList.add('active');
                if (btnAllDates) btnAllDates.classList.remove('active');
                this.resetTimelineSearch();
                this.renderTimeline();
            });
        }

        if (btnAllDates) {
            btnAllDates.addEventListener('click', () => {
                this.timelineFilterFecha = '';
                if (fechaInput) fechaInput.value = '';
                btnAllDates.classList.add('active');
                if (btnToday) btnToday.classList.remove('active');
                this.resetTimelineSearch();
                this.renderTimeline();
            });
        }
    },

    resetTimelineSearch: function() {
        const searchInput = document.getElementById('timeline-search-input');
        const hiddenInput = document.getElementById('timeline-insumo-val');
        const clearBtn = document.getElementById('timeline-search-clear');
        if (searchInput) {
            searchInput.value = '';
            searchInput.classList.remove('item-selected');
        }
        if (hiddenInput) hiddenInput.value = 'ALL';
        if (clearBtn) clearBtn.style.display = 'none';
        this.timelineFilterInsumo = 'ALL';
    },

    setupTimelineSmartSearch: function() {
        const searchInput = document.getElementById('timeline-search-input');
        const hiddenInput = document.getElementById('timeline-insumo-val');
        const dropdown = document.getElementById('timeline-search-dropdown');
        const clearBtn = document.getElementById('timeline-search-clear');

        if (!searchInput || !dropdown) return;

        // Obtener la lista de carnes que TIENEN movimientos en la fecha seleccionada
        const getMeatsForCurrentDate = () => {
            let list = this.movimientosHistorial || [];
            if (this.timelineFilterFecha) {
                list = list.filter(m => {
                    const mDate = (m.fecha_hora || m.fecha || '').split('T')[0];
                    return mDate === this.timelineFilterFecha;
                });
            }

            const meatsMap = new Map();
            list.forEach(m => {
                const nombre = m.catalogo_insumos?.nombre || m.insumo || 'Carne';
                const id = m.insumo_id || nombre;
                const cat = m.catalogo_insumos?.categoria || 'CARNES';
                
                if (!meatsMap.has(id)) {
                    meatsMap.set(id, {
                        id: id,
                        name: nombre,
                        categoria: cat,
                        count: 1
                    });
                } else {
                    meatsMap.get(id).count += 1;
                }
            });

            return Array.from(meatsMap.values());
        };

        const renderResults = (query = '') => {
            const cleanQuery = this.normalizeStr(query);
            const activeMeats = getMeatsForCurrentDate();

            if (activeMeats.length === 0) {
                const dateText = this.timelineFilterFecha ? `el día ${this.timelineFilterFecha}` : 'las fechas seleccionadas';
                dropdown.innerHTML = `<div class="smart-search-empty" style="padding:0.75rem; font-size:0.85rem; text-align:center; color:#64748b;">No hay carnes con movimientos registrados ${dateText}.</div>`;
                dropdown.classList.add('show');
                return;
            }

            let filtered = activeMeats;
            if (cleanQuery.length > 0) {
                filtered = activeMeats.filter(m => this.normalizeStr(m.name).includes(cleanQuery) || this.normalizeStr(m.categoria).includes(cleanQuery));
            }

            let html = `
                <div class="smart-search-item" data-id="ALL" data-name="Todas las Carnes" style="background:#f8fafc; font-weight:700; border-bottom:1px solid #e2e8f0; padding:0.6rem 0.85rem;">
                    <div class="smart-search-item-left">
                        <span class="smart-search-item-name" style="color:#0f172a;">🥩 Ver Todas las Carnes (${activeMeats.length} con movs)</span>
                    </div>
                </div>
            `;

            if (filtered.length === 0) {
                html += `<div class="smart-search-empty" style="padding:0.75rem; font-size:0.85rem; text-align:center; color:#64748b;">No hay carnes que coincidan con "<strong>${query}</strong>" en esta fecha.</div>`;
            } else {
                html += filtered.map(m => {
                    let displayName = m.name;
                    if (cleanQuery.length > 0) {
                        const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                        displayName = m.name.replace(regex, '<mark>$1</mark>');
                    }
                    return `
                        <div class="smart-search-item" data-id="${m.id}" data-name="${m.name}" style="padding:0.6rem 0.85rem; cursor:pointer;">
                            <div class="smart-search-item-left">
                                <span class="smart-search-item-name" style="font-weight:600; font-size:0.9rem;">${displayName}</span>
                                <span class="smart-search-item-cat" style="font-size:0.72rem; color:#94a3b8;">${m.categoria}</span>
                            </div>
                            <div class="smart-search-item-right">
                                <span class="badge" style="font-size:0.72rem; background:#f1f5f9; color:#475569; padding:0.2rem 0.5rem; border-radius:4px;">${m.count} mov${m.count > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            dropdown.innerHTML = html;
            dropdown.classList.add('show');

            dropdown.querySelectorAll('.smart-search-item').forEach(el => {
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-id');
                    const name = el.getAttribute('data-name');
                    
                    if (id === 'ALL') {
                        hiddenInput.value = 'ALL';
                        searchInput.value = '';
                        searchInput.placeholder = 'Escribe para filtrar carnes con movimientos...';
                        searchInput.classList.remove('item-selected');
                        if (clearBtn) clearBtn.style.display = 'none';
                        this.timelineFilterInsumo = 'ALL';
                    } else {
                        hiddenInput.value = id;
                        searchInput.value = name;
                        searchInput.classList.add('item-selected');
                        if (clearBtn) clearBtn.style.display = 'flex';
                        this.timelineFilterInsumo = id;
                    }
                    dropdown.classList.remove('show');
                    this.renderTimeline();
                });
            });
        };

        searchInput.addEventListener('focus', () => {
            renderResults(searchInput.value);
        });

        searchInput.addEventListener('input', (e) => {
            renderResults(e.target.value);
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.resetTimelineSearch();
                this.renderTimeline();
            });
        }

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    },

    renderTimeline: function() {
        const container = document.getElementById('bod-timeline-feed');
        const countBadge = document.getElementById('bod-timeline-count');
        if (!container) return;

        // Filtrar según carne y fecha seleccionadas
        let filtered = [...this.movimientosHistorial];

        if (this.timelineFilterFecha) {
            filtered = filtered.filter(m => {
                const mDate = (m.fecha_hora || m.fecha || '').split('T')[0];
                return mDate === this.timelineFilterFecha;
            });
        }

        if (this.timelineFilterInsumo && this.timelineFilterInsumo !== 'ALL') {
            const target = String(this.timelineFilterInsumo).toLowerCase();
            filtered = filtered.filter(m => {
                const insumoNom = (m.catalogo_insumos?.nombre || m.insumo || '').toLowerCase();
                const insId = String(m.insumo_id || '').toLowerCase();
                return insId === target || insumoNom === target;
            });
        }

        if (countBadge) {
            countBadge.textContent = `${filtered.length} movimiento${filtered.length === 1 ? '' : 's'}`;
        }

        if (filtered.length === 0) {
            const fechaInfo = this.timelineFilterFecha ? `el día ${this.timelineFilterFecha}` : 'las fechas seleccionadas';
            const carneInfo = (this.timelineFilterInsumo && this.timelineFilterInsumo !== 'ALL') ? 'para la carne seleccionada' : '';

            container.innerHTML = `
                <div class="timeline-empty">
                    <i data-lucide="clock" style="width: 32px; height: 32px; color: #94a3b8;"></i>
                    <span style="font-weight: 600; color: #475569;">Sin movimientos ${carneInfo} ${fechaInfo}</span>
                    <span style="font-size: 0.8rem; color: #94a3b8;">Prueba cambiando la fecha o seleccionando "Todas las Fechas" / "Todas las Carnes".</span>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        container.innerHTML = filtered.map(m => {
            const tipo = m.tipo_movimiento || 'MOVIMIENTO';
            const nombreInsumo = m.catalogo_insumos?.nombre || m.insumo || 'Carne';
            const usuario = m.usuario || 'Bodeguero';
            const fechaHora = this.formatTimelineDate(m.fecha_hora || m.fecha);

            let dotClass = 'dot-compra';
            let tagClass = 'tag-compra';
            let iconName = 'plus-circle';
            let tagLabel = 'Compra / Entrada';
            let mainImpact = '';
            let snapshotHtml = '';

            if (tipo === 'ENTRADA_COMPRA') {
                dotClass = 'dot-compra';
                tagClass = 'tag-compra';
                iconName = 'plus-circle';
                tagLabel = '1. Entrada por Compra';
                mainImpact = `<span class="timeline-qty-badge" style="background:#dbeafe; color:#1d4ed8;">+${parseFloat(m.cant_sin_porcionar_kg || 0).toFixed(2)} Kg</span>`;
                snapshotHtml = `
                    <div class="timeline-snapshot">
                        <span><strong>Origen:</strong> ${m.origen || 'Proveedor'}</span>
                        <span><strong>Bodega Entero:</strong> ${parseFloat(m.bodega_sin_porc_anterior_kg || 0).toFixed(2)} Kg ➔ <strong>${parseFloat(m.bodega_sin_porc_nuevo_kg || 0).toFixed(2)} Kg</strong></span>
                        ${m.valor_total_movimiento ? `<span><strong>Valor:</strong> $ ${this.formatMoney(m.valor_total_movimiento)}</span>` : ''}
                    </div>
                `;
            } else if (tipo === 'PORCIONADO') {
                dotClass = 'dot-porc';
                tagClass = 'tag-porc';
                iconName = 'scissors';
                tagLabel = '2. Porcionado y Pesado';
                mainImpact = `<span class="timeline-qty-badge" style="background:#f3e8ff; color:#7e22ce;">${m.porciones_und || 0} und (${parseFloat(m.peso_porciones_kg || 0).toFixed(2)} Kg)</span>`;
                snapshotHtml = `
                    <div class="timeline-snapshot">
                        <span><strong>Procesado:</strong> ${parseFloat(m.cant_sin_porcionar_kg || 0).toFixed(2)} Kg</span>
                        <span><strong>Merma:</strong> ${parseFloat(m.merma_kg || 0).toFixed(2)} Kg</span>
                        <span><strong>Bodega Entero:</strong> ${parseFloat(m.bodega_sin_porc_anterior_kg || 0).toFixed(2)} Kg ➔ <strong>${parseFloat(m.bodega_sin_porc_nuevo_kg || 0).toFixed(2)} Kg</strong></span>
                        <span><strong>Bodega Porc:</strong> ${m.bodega_porc_und_anterior || 0} und ➔ <strong>${m.bodega_porc_und_nuevo || 0} und</strong></span>
                    </div>
                `;
            } else if (tipo === 'TRASLADO_COCINA') {
                dotClass = 'dot-traslado';
                tagClass = 'tag-traslado';
                iconName = 'arrow-right-circle';
                tagLabel = '3. Traslado a Cocina';
                const qtyText = (m.porciones_und && m.porciones_und > 0)
                    ? `${m.porciones_und} und (${parseFloat(m.peso_porciones_kg || 0).toFixed(2)} Kg)`
                    : `${parseFloat(m.cant_sin_porcionar_kg || 0).toFixed(2)} Kg (Entero)`;
                mainImpact = `<span class="timeline-qty-badge" style="background:#ffedd5; color:#c2410c;">➔ ${qtyText}</span>`;
                snapshotHtml = `
                    <div class="timeline-snapshot">
                        <span><strong>Destino:</strong> Cocina</span>
                        <span><strong>Queda en Bodega:</strong> ${m.bodega_porc_und_nuevo || 0} und (${parseFloat(m.bodega_porc_kg_nuevo || 0).toFixed(2)} Kg)</span>
                        <span><strong>En Cocina:</strong> ${m.cocina_porc_und_nuevo || 0} und (${parseFloat(m.cocina_porc_kg_nuevo || 0).toFixed(2)} Kg)</span>
                    </div>
                `;
            } else if (tipo === 'DEVOLUCION_COCINA') {
                dotClass = 'dot-devolucion';
                tagClass = 'tag-devolucion';
                iconName = 'corner-down-left';
                tagLabel = '4. Devolución de Cocina';
                const qtyText = (m.porciones_und && m.porciones_und > 0)
                    ? `${m.porciones_und} und (${parseFloat(m.peso_porciones_kg || 0).toFixed(2)} Kg)`
                    : `${parseFloat(m.cant_sin_porcionar_kg || 0).toFixed(2)} Kg`;
                mainImpact = `<span class="timeline-qty-badge" style="background:#d1fae5; color:#047857;">↩ ${qtyText}</span>`;
                snapshotHtml = `
                    <div class="timeline-snapshot">
                        <span><strong>Reingresa a Bodega:</strong> ${m.bodega_porc_und_nuevo || 0} und (${parseFloat(m.bodega_porc_kg_nuevo || 0).toFixed(2)} Kg)</span>
                        <span><strong>Queda en Cocina:</strong> ${m.cocina_porc_und_nuevo || 0} und (${parseFloat(m.cocina_porc_kg_nuevo || 0).toFixed(2)} Kg)</span>
                    </div>
                `;
            }

            return `
                <div class="timeline-item">
                    <div class="timeline-dot ${dotClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <div class="timeline-card-content">
                        <div class="timeline-header">
                            <span class="timeline-tag ${tagClass}">${tagLabel}</span>
                            <div class="timeline-meta-right">
                                <span class="timeline-user">
                                    <i data-lucide="user" style="width: 12px; height: 12px;"></i>
                                    ${usuario}
                                </span>
                                <span class="timeline-time">
                                    <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
                                    ${fechaHora}
                                </span>
                            </div>
                        </div>

                        <div class="timeline-main">
                            <span class="timeline-meat-title">${nombreInsumo}</span>
                            ${mainImpact}
                        </div>

                        ${m.observaciones ? `<div class="timeline-notes">📝 ${m.observaciones}</div>` : ''}

                        ${snapshotHtml}
                    </div>
                </div>
            `;
        }).join('');

        lucide.createIcons();
    },

    formatTimelineDate: function(dateStr) {
        if (!dateStr) return 'Hoy';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return String(dateStr);
            
            const opcionesFecha = { day: '2-digit', month: 'short' };
            const fechaTxt = d.toLocaleDateString('es-CO', opcionesFecha);
            
            let horas = d.getHours();
            const minutos = String(d.getMinutes()).padStart(2, '0');
            const ampm = horas >= 12 ? 'PM' : 'AM';
            horas = horas % 12 || 12;
            
            return `${fechaTxt}, ${horas}:${minutos} ${ampm}`;
        } catch (e) {
            return String(dateStr);
        }
    },

    buildFallbackTimeline: function() {
        const list = [];
        const fallbackCarnes = ['Lomo viche', 'Punta de anca', 'Churrasco', 'Costilla de res'];
        
        fallbackCarnes.forEach((nom, i) => {
            const timeAgo = new Date(Date.now() - (i * 45 * 60 * 1000));
            list.push({
                id: `hist-${i}`,
                fecha_hora: timeAgo.toISOString(),
                tipo_movimiento: i === 0 ? 'ENTRADA_COMPRA' : (i === 1 ? 'PORCIONADO' : (i === 2 ? 'TRASLADO_COCINA' : 'DEVOLUCION_COCINA')),
                insumo: nom,
                origen: i === 0 ? 'Frigorífico Central' : 'Bodega',
                destino: i === 2 ? 'Cocina' : 'Bodega',
                cant_sin_porcionar_kg: i === 0 ? 25.0 : (i === 1 ? 10.0 : 0),
                porciones_und: i === 1 ? 28 : (i === 2 ? 15 : (i === 3 ? 4 : 0)),
                peso_porciones_kg: i === 1 ? 9.8 : (i === 2 ? 5.25 : (i === 3 ? 1.4 : 0)),
                merma_kg: i === 1 ? 0.2 : 0,
                bodega_sin_porc_anterior_kg: 20.0,
                bodega_sin_porc_nuevo_kg: i === 0 ? 45.0 : 10.0,
                bodega_porc_und_anterior: 10,
                bodega_porc_und_nuevo: i === 1 ? 38 : (i === 2 ? 23 : 27),
                bodega_porc_kg_nuevo: 8.0,
                cocina_porc_und_nuevo: i === 2 ? 15 : (i === 3 ? 11 : 0),
                cocina_porc_kg_nuevo: 4.5,
                valor_total_movimiento: i === 0 ? 650000 : 0,
                observaciones: i === 0 ? 'Factura FAC-8921 recibida conforme' : (i === 1 ? 'Corte estándar de 350g' : (i === 2 ? 'Despacho turno almuerzo' : 'Sobrante fin de turno')),
                usuario: 'Bodeguero (Turno Mañana)'
            });
        });

        return list;
    },

    // Helpers
    formatMoney: function(num) {
        return Math.round(num || 0).toLocaleString('es-CO');
    },

    showLoading: function(show) {
        const el = document.getElementById('bod-loading-indicator');
        if (el) el.style.display = show ? 'flex' : 'none';
    },

    showToast: function(msg) {
        const toast = document.createElement('div');
        toast.className = 'bodeguero-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }, 50);
    }
};

window.BodegueroTerminal = BodegueroTerminal;

