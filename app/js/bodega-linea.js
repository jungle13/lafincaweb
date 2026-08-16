const BodegaLinea = {
    data: [],
    filteredData: [],
    insumoToCategoryMap: {},
    sortCol: null,
    sortAsc: true,
    currentPage: 1,
    itemsPerPage: 50,
    viewMode: 'vertical',
    
    init: function() {
        if (!AppData.bodegaRaw || AppData.bodegaRaw.length === 0) return;
        try {
            this.buildCategoryMap();
            // Ya no inyectamos la columna 'Categoría' para mostrar en la tabla,
            // pero el buildCategoryMap se mantiene porque el filtro sí lo usa.
            this.data = AppData.bodegaRaw.map(d => ({...d}));
            this.filteredData = [...this.data];
            this.initFilters();
            this.renderTable();
        } catch(e) {
            console.error("Error en BodegaLinea.init: ", e);
            alert("Error en BodegaLinea.init: " + e.message);
        }
    },

    buildCategoryMap: function() {
        if (!AppData.compras) return;
        // Map insumo names to their categories from Compras
        AppData.compras.forEach(c => {
            const insumo = (c.insumo || '').toLowerCase().trim();
            const cat = c.categoria || c['Categoría'] || 'Sin Categoría';
            if (insumo && !this.insumoToCategoryMap[insumo]) {
                this.insumoToCategoryMap[insumo] = cat;
            }
        });
    },

    initFilters: function() {
        const tipoSelect = document.getElementById('bl-tipo');
        const insumoSelect = document.getElementById('bl-insumo');

        const usedCats = new Set();
        const usedTipos = new Set();
        const usedInsumos = new Set();

        this.data.forEach(d => {
            const ins = (d['Insumo'] || '').toLowerCase().trim();
            const cat = this.insumoToCategoryMap[ins] || 'Otra';
            const tipo = String(d['Tipo'] || '').trim();
            const realInsumo = String(d['Insumo'] || '').trim();

            if (cat) usedCats.add(cat);
            if (tipo) usedTipos.add(tipo);
            if (realInsumo) usedInsumos.add(realInsumo);
        });

        // Dropdown de tipos
        if (tipoSelect) {
            tipoSelect.innerHTML = '<option value="ALL">Todos los Tipos</option>';
            [...usedTipos].sort().forEach(tipo => {
                const opt = document.createElement('option');
                opt.value = tipo;
                opt.textContent = tipo;
                tipoSelect.appendChild(opt);
            });
        }

        // Función para actualizar el dropdown de insumos
        const updateInsumoOptions = () => {
            if (!insumoSelect) return;
            insumoSelect.innerHTML = '<option value="ALL">Todos los Insumos</option>';
            
            [...usedInsumos].sort().forEach(ins => {
                const opt = document.createElement('option');
                opt.value = ins;
                opt.textContent = ins;
                insumoSelect.appendChild(opt);
            });
        };

        // Inicializar insumos
        updateInsumoOptions();

        const btnFiltrar = document.getElementById('bl-btn-filtrar');
        const btnLimpiar = document.getElementById('bl-btn-limpiar');

        if (btnFiltrar) {
            btnFiltrar.addEventListener('click', () => this.applyFilters());
        }
        if (btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                document.getElementById('bl-fecha-inicio').value = '';
                document.getElementById('bl-fecha-fin').value = '';
                if(document.getElementById('bl-tipo')) document.getElementById('bl-tipo').value = 'ALL';
                if(document.getElementById('bl-tipo-movimiento')) document.getElementById('bl-tipo-movimiento').value = 'ALL';
                if(document.getElementById('bl-insumo')) {
                    document.getElementById('bl-insumo').value = 'ALL';
                }
                this.applyFilters();
            });
        }

        // Help popover logic
        const btnHelp = document.getElementById('bl-btn-help');
        const helpPopover = document.getElementById('bl-help-popover');
        if (btnHelp && helpPopover) {
            btnHelp.addEventListener('click', (e) => {
                e.stopPropagation();
                helpPopover.style.display = helpPopover.style.display === 'none' ? 'block' : 'none';
            });
            document.addEventListener('click', (e) => {
                if (!helpPopover.contains(e.target) && !btnHelp.contains(e.target)) {
                    helpPopover.style.display = 'none';
                }
            });
        }

        const btnToggle = document.getElementById('bl-btn-toggle-view');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                this.viewMode = this.viewMode === 'horizontal' ? 'vertical' : 'horizontal';
                const textSpan = document.getElementById('bl-toggle-text');
                const iconSpan = btnToggle.querySelector('i');
                const tipoMovContainer = document.getElementById('bl-tipo-mov-container');
                
                if (textSpan) textSpan.textContent = this.viewMode === 'horizontal' ? 'Vista Vertical' : 'Vista Horizontal';
                if (iconSpan) {
                    iconSpan.setAttribute('data-lucide', this.viewMode === 'horizontal' ? 'list' : 'table');
                    if (window.lucide) window.lucide.createIcons();
                }
                if (tipoMovContainer) {
                    tipoMovContainer.style.display = this.viewMode === 'horizontal' ? 'none' : 'flex';
                }
                this.currentPage = 1;
                this.renderTable();
            });
        }
    },

    applyFilters: function() {
        const dStart = document.getElementById('bl-fecha-inicio')?.value;
        const dEnd = document.getElementById('bl-fecha-fin')?.value;
        const tipoVal = document.getElementById('bl-tipo')?.value;
        const insumoVal = document.getElementById('bl-insumo')?.value;

        this.filteredData = this.data.filter(row => {
            let pass = true;
            
            const rFecha = String(row['Fecha'] || '').trim();
            if (dStart && rFecha < dStart) pass = false;
            if (dEnd && rFecha > dEnd) pass = false;

            const rInsumoRaw = String(row['Insumo'] || '').trim();
            const rInsumoLow = rInsumoRaw.toLowerCase();

            if (tipoVal && tipoVal !== 'ALL') {
                const rTipo = String(row['Tipo'] || '').trim();
                if (rTipo !== tipoVal) pass = false;
            }

            if (insumoVal && insumoVal !== 'ALL') {
                if (rInsumoRaw !== insumoVal) pass = false;
            }

            return pass;
        });

        this.currentPage = 1;
        this.renderTable();
    },

    renderTable: function() {
        const table = document.getElementById('bodega-linea-table');
        if (!table) return;

        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');

        if (this.filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100%">No hay datos.</td></tr>';
            this.updatePaginationInfo();
            return;
        }

        // Calcular slice de paginación
        const totalItems = this.filteredData.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedData = this.filteredData.slice(startIndex, endIndex);

        if (this.viewMode === 'vertical') {
            thead.innerHTML = `
                <tr>
                    <th style="text-align: left; padding: 0.75rem 1rem;">FECHA</th>
                    <th style="text-align: left; padding: 0.75rem 1rem;">TIPO DE INSUMO</th>
                    <th style="text-align: left; padding: 0.75rem 1rem;">INSUMO</th>
                    <th style="text-align: center; padding: 0.75rem 1rem;">TIPO MOVIMIENTO</th>
                    <th style="text-align: right; padding: 0.75rem 1rem;">PORCIONES UNDS</th>
                    <th style="text-align: right; padding: 0.75rem 1rem;">PESO DE LAS PORCIONES KG</th>
                    <th style="text-align: right; padding: 0.75rem 1rem;">INSUMO NO PORCIONADO KG</th>
                    <th style="text-align: right; padding: 0.75rem 1rem;">TOTAL DE INSUMO EN BODEGA EN KG</th>
                </tr>
            `;

            let tbodyHtml = '';
            paginatedData.forEach(row => {
                const fecha = row['Fecha'] || '';
                const tipoInsumo = row['Tipo'] || '';
                const insumo = row['Insumo'] || '';
                
                // Extract selected movement filter
                const tipoMovFilterEl = document.getElementById('bl-tipo-movimiento');
                const tipoMovFilter = tipoMovFilterEl ? tipoMovFilterEl.value : 'ALL';

                const events = [];
                const pushEvent = (tipoMov, porc, pesoPorc, noPorc) => {
                    if (tipoMovFilter !== 'ALL' && tipoMov !== tipoMovFilter) return;

                    const hasValue = (val) => val && val !== 0 && val !== '0' && val !== '0.00';
                    if (hasValue(porc) || hasValue(pesoPorc) || hasValue(noPorc) || tipoMov === 'INICIAL' || tipoMov === 'FINAL') {
                        events.push({
                            tipoMov,
                            porc: porc,
                            pesoPorc: pesoPorc,
                            noPorc: noPorc
                        });
                    }
                };

                // Extraemos en orden cronológico lógico para el día
                pushEvent('INICIAL', row['STOCK INICIAL (Porciones)'], row['PESO DE LAS PORCIONES (Kg)'], row['Stock Inicial Sin Porcionar (Kg)']);
                pushEvent('ENTRADA', null, null, row['Ingreso Factura Dia (Kg)']);
                pushEvent('DEVOLUCION', row['Porciones Devueltas a Bodega'], row['Peso Porciones Devueltas (Kgs)'], null);
                pushEvent('SALIDA', row['Cant. Porcion. Entreg. a Cocina (Unds)'], row['Peso de Unidades Porcionadas (Kgs)'], null);
                pushEvent('FINAL', row['Total Porciones Bodega (Unds)'], row['Peso Porciones Bodega Kgs'], row['Peso Insumo Sin Porcionar Bodega Kg']);

                const renderVal = (v) => {
                    if (v === undefined || v === null || v === '') return '-';
                    let num = Number(v);
                    if (isNaN(num)) return v;
                    return Number.isInteger(num) ? num : num.toFixed(2);
                };

                events.forEach((ev, idx) => {
                    let badgeStyle = "padding: 6px 12px; border-radius: 20px; font-weight: 600; font-size: 0.75rem; display: inline-block; text-align: center; min-width: 100px; border: 1px solid;";
                    switch (ev.tipoMov) {
                        case 'INICIAL': badgeStyle += " background-color: rgba(99, 102, 241, 0.1); color: #4f46e5; border-color: rgba(99, 102, 241, 0.2);"; break;
                        case 'ENTRADA': badgeStyle += " background-color: rgba(16, 185, 129, 0.1); color: #059669; border-color: rgba(16, 185, 129, 0.2);"; break;
                        case 'SALIDA': badgeStyle += " background-color: rgba(239, 68, 68, 0.1); color: #dc2626; border-color: rgba(239, 68, 68, 0.2);"; break;
                        case 'DEVOLUCION': badgeStyle += " background-color: rgba(245, 158, 11, 0.1); color: #d97706; border-color: rgba(245, 158, 11, 0.2);"; break;
                        case 'FINAL': badgeStyle += " background-color: rgba(107, 114, 128, 0.1); color: #4b5563; border-color: rgba(107, 114, 128, 0.2);"; break;
                    }
                    const tipoMovHtml = `<span style="${badgeStyle}">${ev.tipoMov}</span>`;
                    
                    const isLast = idx === events.length - 1;
                    const rowStyle = isLast ? 'border-bottom: 2px solid var(--border-color);' : 'border-bottom: 1px solid var(--border-color);';
                    const cellStyle = 'padding: 0.75rem 1rem; vertical-align: middle;';

                    let totalKg = null;
                    if (ev.pesoPorc !== null && ev.pesoPorc !== undefined && ev.pesoPorc !== '' || 
                        ev.noPorc !== null && ev.noPorc !== undefined && ev.noPorc !== '') {
                        totalKg = (Number(ev.pesoPorc) || 0) + (Number(ev.noPorc) || 0);
                    }

                    tbodyHtml += `
                        <tr style="${rowStyle} transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--bg-surface-hover)'" onmouseout="this.style.backgroundColor='transparent'">
                            <td style="${cellStyle}">${fecha}</td>
                            <td style="${cellStyle}">${tipoInsumo}</td>
                            <td style="${cellStyle} font-weight: 500; color: var(--text-primary);">${insumo}</td>
                            <td style="${cellStyle} text-align: center;">${tipoMovHtml}</td>
                            <td style="${cellStyle} text-align: right; font-variant-numeric: tabular-nums;">${renderVal(ev.porc)}</td>
                            <td style="${cellStyle} text-align: right; font-variant-numeric: tabular-nums;">${renderVal(ev.pesoPorc)}</td>
                            <td style="${cellStyle} text-align: right; font-variant-numeric: tabular-nums;">${renderVal(ev.noPorc)}</td>
                            <td style="${cellStyle} text-align: right; font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums;">${renderVal(totalKg)}</td>
                        </tr>
                    `;
                });
            });

            tbody.innerHTML = tbodyHtml;
        } else {
            // Definición estricta de columnas y grupos para Horizontal
            const baseCols = ['Fecha', 'Tipo', 'Insumo', 'EsCorte'];
            const colEntrada = [
                'STOCK INICIAL (Porciones)',
                'PESO DE LAS PORCIONES (Kg)',
                'Stock Inicial Sin Porcionar (Kg)',
                'Ingreso Factura Dia (Kg)',
                'Cant. Insumo en Bodega (Kg)',
                'Porciones Devueltas a Bodega',
                'Peso Porciones Devueltas (Kgs)'
            ];
            const colSalida = [
                'Cant. Porcion. Entreg. a Cocina (Unds)',
                'Peso de Unidades Porcionadas (Kgs)'
            ];
            const colTotal = [
                { orig: 'Total Porciones Bodega (Unds)', label: 'Total Porc. Bodega' },
                { orig: 'Peso Porciones Bodega Kgs', label: 'Peso Porc. Bodega Kgs' },
                { orig: 'Peso Insumo Sin Porcionar Bodega Kg', label: 'Peso Insumo Sin Porcionar Kg' },
                { orig: 'Peso Total Insumo Bodega Kg', label: 'Peso Total Insumo Kg' }
            ];
            const endCols = ['CONSUMO/PERDIDA/MERMA'];

            // Render Thead Nivel 1 (Super Headers)
            let theadHtml = '<tr>';
            baseCols.forEach((col, index) => {
                const stickyClass = index < 3 ? `bl-sticky-${index + 1}` : '';
                theadHtml += `<th rowspan="2" class="${stickyClass}">${col}</th>`;
            });
            theadHtml += `<th colspan="${colEntrada.length}" class="super-entrada">ENTRADA</th>`;
            theadHtml += `<th colspan="${colSalida.length}" class="super-salida">SALIDA</th>`;
            theadHtml += `<th colspan="${colTotal.length}" class="super-total">TOTAL</th>`;
            endCols.forEach(col => {
                theadHtml += `<th rowspan="2">${col}</th>`;
            });
            theadHtml += '</tr>';

            // Render Thead Nivel 2 (Sub-columnas)
            theadHtml += '<tr>';
            colEntrada.forEach(col => {
                theadHtml += `<th>${col}</th>`;
            });
            colSalida.forEach(col => {
                theadHtml += `<th>${col}</th>`;
            });
            colTotal.forEach(colObj => {
                theadHtml += `<th>${colObj.label}</th>`;
            });
            theadHtml += '</tr>';

            thead.innerHTML = theadHtml;

            // Render Tbody
            let tbodyHtml = '';
            paginatedData.forEach(row => {
                let trClass = '';
                const tipo = String(row['Tipo'] || '').toLowerCase().trim();
                if (tipo.includes('entrada') || tipo.includes('compra')) {
                    trClass = 'row-entrada';
                } else if (tipo.includes('salida') || tipo.includes('a cocina') || tipo.includes('consumo')) {
                    trClass = 'row-salida';
                } else if (tipo.includes('devolución') || tipo.includes('devolucion')) {
                    trClass = 'row-devolucion';
                }

                tbodyHtml += `<tr class="${trClass}">`;
                
                // Helper function to render a cell
                const renderCell = (colName, stickyClass = '') => {
                    let val = row[colName];
                    if (val === undefined || val === null) val = '';
                    if (typeof val === 'number') {
                        // Maximum of 2 decimals without forcing 2 if not needed
                        val = Number.isInteger(val) ? val : Number(val.toFixed(2));
                    }
                    let clsAttr = stickyClass ? ` class="${stickyClass}"` : '';
                    return `<td${clsAttr}>${val}</td>`;
                };

                // Base
                baseCols.forEach((col, index) => {
                    const stickyClass = index < 3 ? `bl-sticky-${index + 1}` : '';
                    tbodyHtml += renderCell(col, stickyClass);
                });

                // Entrada
                colEntrada.forEach(col => tbodyHtml += renderCell(col));

                // Salida
                colSalida.forEach(col => tbodyHtml += renderCell(col));

                // Total
                colTotal.forEach(colObj => tbodyHtml += renderCell(colObj.orig));

                // End
                endCols.forEach(col => tbodyHtml += renderCell(col));

                tbodyHtml += '</tr>';
            });

            tbody.innerHTML = tbodyHtml;
        }

        if (window.lucide) window.lucide.createIcons();
        this.updatePaginationInfo();
        this.bindEvents();
        this.syncScrollbars();
    },

    syncScrollbars: function() {
        const topScroll = document.getElementById('bl-top-scroll');
        const topContent = document.getElementById('bl-top-scroll-content');
        const tableContainer = document.getElementById('bl-table-container');
        const table = document.getElementById('bodega-linea-table');
        
        if (topScroll && topContent && tableContainer && table) {
            // Set the dummy div's width to match the real table's width
            topContent.style.width = table.offsetWidth + 'px';
            
            // Sync scrolling
            topScroll.onscroll = function() {
                tableContainer.scrollLeft = topScroll.scrollLeft;
            };
            tableContainer.onscroll = function() {
                topScroll.scrollLeft = tableContainer.scrollLeft;
            };
        }
    },

    updatePaginationInfo: function() {
        const totalPages = Math.max(1, Math.ceil(this.filteredData.length / this.itemsPerPage));
        const infoEl = document.getElementById('bl-page-info');
        const prevBtn = document.getElementById('bl-prev-page');
        const nextBtn = document.getElementById('bl-next-page');

        if (infoEl) infoEl.textContent = `Página ${this.currentPage} de ${totalPages}`;
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.style.opacity = this.currentPage === 1 ? '0.5' : '1';
            prevBtn.style.cursor = this.currentPage === 1 ? 'not-allowed' : 'pointer';
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
            nextBtn.style.opacity = this.currentPage === totalPages ? '0.5' : '1';
            nextBtn.style.cursor = this.currentPage === totalPages ? 'not-allowed' : 'pointer';
        }
    },

    bindEvents: function() {
        // Remove sort headers events
        
        // Pagination Events
        const prevBtn = document.getElementById('bl-prev-page');
        const nextBtn = document.getElementById('bl-next-page');
        
        const newPrev = prevBtn ? prevBtn.cloneNode(true) : null;
        if (prevBtn && newPrev) prevBtn.parentNode.replaceChild(newPrev, prevBtn);
        
        const newNext = nextBtn ? nextBtn.cloneNode(true) : null;
        if (nextBtn && newNext) nextBtn.parentNode.replaceChild(newNext, nextBtn);

        if (newPrev) {
            newPrev.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderTable();
                }
            });
        }
        if (newNext) {
            newNext.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderTable();
                }
            });
        }
    }
};
