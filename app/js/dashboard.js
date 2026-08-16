const Dashboard = {
    chartInstance: null,
    insumosData: [],
    insumosCurrentPage: 1,
    insumosItemsPerPage: 10,
    insumosSortBy: 'insumo',
    insumosSortDesc: false,
    insumosFilterCat: 'ALL',
    globalEndDate: null,

    getFilteredData: function(dataset) {
        if (!this.globalEndDate) return dataset;
        return dataset.filter(row => row.fecha <= this.globalEndDate);
    },

    init: function() {
        this.bindEvents();
        this.calculateKPIs();
        this.renderTrendChart();
        this.renderRecentTable();
        this.renderCategoryCards();
        this.renderInsumosTable();
    },

    bindEvents: function() {
        const dateInput = document.getElementById('global-end-date');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                this.globalEndDate = e.target.value;
                
                // Re-render all dashboard components
                this.calculateKPIs();
                this.renderTrendChart();
                this.renderRecentTable();
                this.renderCategoryCards();
                this.renderInsumosTable();
            });
        }
    },

    formatCurrency: function(value) {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
    },

    calculateKPIs: function() {
        // 1. Ingresos y Costo Ventas (Mes)
        const totalIngresos = this.getFilteredData(AppData.ventas).reduce((sum, v) => sum + v.ingreso, 0);
        const totalCostoVentas = this.getFilteredData(AppData.ventas).reduce((sum, v) => sum + v.costoInsumo, 0);

        // 2. Compras (Mes)
        const totalComprasCosto = this.getFilteredData(AppData.compras).reduce((sum, c) => sum + c.costoTotal, 0);
        const totalComprasQty = this.getFilteredData(AppData.compras).length;

        // 3. Costo Inventario Actual
        const latestDateBodega = [...this.getFilteredData(AppData.bodega)].sort((a,b) => b.fecha.localeCompare(a.fecha))[0]?.fecha;
        let inventarioValorado = 0;

        if (latestDateBodega) {
            document.getElementById('last-update-text').textContent = 'Actualizado hasta: ' + latestDateBodega;
            // Obtener el último registro de cada insumo en esa fecha
            const ultimosRegistros = {};
            this.getFilteredData(AppData.bodega).filter(b => b.fecha === latestDateBodega).forEach(b => {
                ultimosRegistros[b.insumo] = b.pesoTotalBodega;
            });

            // Mapear el último costo conocido por insumo
            const costoPorInsumo = {};
            this.getFilteredData(AppData.compras).forEach(c => {
                if (c.costoUnitario > 0) {
                    costoPorInsumo[c.insumo] = c.costoUnitario;
                }
            });

            for (const [insumo, kilos] of Object.entries(ultimosRegistros)) {
                // Si no tiene costo en compras, usamos un valor fijo simulado o 0
                const costoKg = costoPorInsumo[insumo] || 15000; // Asumiendo un costo default si no hay factura
                inventarioValorado += (kilos * costoKg);
            }
        }

        // 4. Rentabilidad Bruta
        const rentabilidad = totalIngresos > 0 ? ((totalIngresos - totalCostoVentas) / totalIngresos) * 100 : 0;

        // Actualizar UI
        document.getElementById('kpi-inventario').textContent = this.formatCurrency(inventarioValorado);
        document.getElementById('kpi-ingresos').textContent = this.formatCurrency(totalIngresos);
        document.getElementById('kpi-compras').textContent = this.formatCurrency(totalComprasCosto);
        document.getElementById('kpi-compras-qty').textContent = `${totalComprasQty} transacciones`;
        
        const rentElement = document.getElementById('kpi-rentabilidad');
        rentElement.textContent = `${rentabilidad.toFixed(1)}%`;
        rentElement.style.color = rentabilidad > 30 ? 'var(--success)' : 'var(--warning)';
    },

    renderTrendChart: function() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        // Agrupar por fecha
        const dateMap = {};

        // Ventas por fecha
        this.getFilteredData(AppData.ventas).forEach(v => {
            if(!dateMap[v.fecha]) dateMap[v.fecha] = { ingresos: 0, costoVentas: 0, platos: 0 };
            dateMap[v.fecha].ingresos += v.ingreso;
            dateMap[v.fecha].costoVentas += v.costoInsumo;
            dateMap[v.fecha].platos += v.cantPlatos;
        });

        const dates = Object.keys(dateMap).sort();
        const dataIngresos = dates.map(d => dateMap[d].ingresos);
        const dataCostoVentas = dates.map(d => dateMap[d].costoVentas);

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Ingresos por Ventas',
                        data: dataIngresos,
                        borderColor: '#10b981', // success
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Costo de Ventas',
                        data: dataCostoVentas,
                        borderColor: '#ef4444', // danger
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(context.parsed.y);
                                }
                                return label;
                            },
                            afterBody: (tooltipItems) => {
                                const date = tooltipItems[0].label;
                                const data = dateMap[date];
                                if (!data) return '';
                                const rent = data.ingresos > 0 ? ((data.ingresos - data.costoVentas) / data.ingresos * 100).toFixed(1) : 0;
                                return [
                                    '',
                                    `🍽️ Platos Vendidos: ${data.platos}`,
                                    `📈 Rentabilidad Bruta: ${rent}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            callback: function(value) {
                                return '$' + (value/1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                }
            }
        });
    },

    renderRecentTable: function() {
        const tbody = document.querySelector('#dashboard-table tbody');
        tbody.innerHTML = '';

        // Tomar los últimos 15 movimientos de bodega del día más reciente
        const latestDate = [...this.getFilteredData(AppData.bodega)].sort((a,b) => b.fecha.localeCompare(a.fecha))[0]?.fecha;
        if(!latestDate) return;

        const recientes = this.getFilteredData(AppData.bodega)
            .filter(b => b.fecha === latestDate)
            .slice(-10) // Tomamos los últimos 10 de esa fecha
            .reverse();

        recientes.forEach(row => {
            const tr = document.createElement('tr');
            
            let mermaStyle = row.merma < 0 ? 'color: var(--danger)' : '';
            
            tr.innerHTML = `
                <td>${row.fecha}</td>
                <td><span class="badge" style="background: rgba(255,255,255,0.1); color: #fff;">${row.tipo}</span></td>
                <td><strong>${row.insumo}</strong></td>
                <td>${row.esCorte}</td>
                <td>${row.pesoTotalBodega.toFixed(2)} Kg</td>
                <td style="font-weight:600; ${mermaStyle}">${row.merma.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    },

    renderCategoryCards: function() {
        const latestDateBodega = [...this.getFilteredData(AppData.bodega)].sort((a,b) => b.fecha.localeCompare(a.fecha))[0]?.fecha;
        if (!latestDateBodega) return;

        // 1. Inventario por categoría
        const costoPorInsumo = {};
        this.getFilteredData(AppData.compras).forEach(c => {
            if (c.costoUnitario > 0) costoPorInsumo[c.insumo] = c.costoUnitario;
        });

        const invCategoria = {};
        const ultimosRegistros = this.getFilteredData(AppData.bodega).filter(b => b.fecha === latestDateBodega);
        const dictCierre = {};
        ultimosRegistros.forEach(b => {
            dictCierre[b.insumo] = b;
        });

        for (const insumo in dictCierre) {
            const b = dictCierre[insumo];
            const cat = b.tipo || 'OTRO';
            if(!invCategoria[cat]) invCategoria[cat] = { costo: 0, kg: 0 };
            const costoKg = costoPorInsumo[b.insumo] || 15000;
            invCategoria[cat].costo += (b.pesoTotalBodega * costoKg);
            invCategoria[cat].kg += b.pesoTotalBodega;
        }

        // 2. Ingresos y CostoVentas por categoría
        const platoToCategoria = {};
        AppData.recetas.forEach(r => {
            platoToCategoria[r.idPlato] = r.tipoCarne || 'OTRO';
        });

        const ventCategoria = {};
        AppData.ventas.forEach(v => {
            const cat = platoToCategoria[v.idPlato] || 'OTRO';
            if(!ventCategoria[cat]) ventCategoria[cat] = { ingresos: 0, costo: 0 };
            ventCategoria[cat].ingresos += v.ingreso;
            ventCategoria[cat].costo += v.costoInsumo;
        });

        // 3. Render
        const container = document.getElementById('category-cards');
        if(!container) return;
        container.innerHTML = '';
        
        const categorias = new Set([...Object.keys(invCategoria), ...Object.keys(ventCategoria)]);

        categorias.forEach(cat => {
            const inv = invCategoria[cat] || { costo: 0, kg: 0 };
            const ven = ventCategoria[cat] || { ingresos: 0, costo: 0 };
            const rentabilidad = ven.ingresos > 0 ? ((ven.ingresos - ven.costo) / ven.ingresos) * 100 : 0;
            const colorRent = rentabilidad > 30 ? 'var(--success)' : (rentabilidad > 0 ? 'var(--warning)' : 'var(--danger)');

            const html = `
                <div class="kpi-card mini-card" style="align-items: stretch; justify-content: space-between; gap: 1rem; position: relative;">
                    
                    <!-- Tooltip y Botón -->
                    <button class="kpi-info-btn" onclick="this.nextElementSibling.classList.toggle('show')"><i data-lucide="help-circle"></i></button>
                    <div class="kpi-tooltip" style="width: 250px; left: -10px; top: 35px; font-weight: normal; text-align: left;">
                        <strong>¿Qué significan estos valores?</strong><br>
                        • <strong>Inv. Actual:</strong> Es el dinero inmovilizado en esta categoría (Stock físico actual multiplicado por su costo unitario de compra).<br>
                        • <strong>Ingresos Mes:</strong> Es la facturación por ventas de todos los platos que usan insumos de esta categoría.<br>
                        • <strong>Rendimiento:</strong> % de Rentabilidad Bruta. Se calcula restando el costo de lo vendido a los ingresos, dividido entre los ingresos (Ingresos - Costo) / Ingresos.
                    </div>

                    <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; padding-right: 1.5rem;">
                        <h4 style="color: var(--accent-primary); font-size: 1rem; margin-bottom: 0.25rem;">${cat}</h4>
                        <span style="font-size: 0.65rem; color: var(--text-muted);">Act: ${latestDateBodega}</span>
                    </div>
                    <div>
                        <h5 style="color: var(--text-secondary); font-size: 0.75rem;">Inv. Actual</h5>
                        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${this.formatCurrency(inv.costo)} <span style="font-size: 0.75rem; font-weight: normal; color: var(--text-muted);">(${inv.kg.toFixed(1)} Kg)</span></h3>
                        
                        <h5 style="color: var(--text-secondary); font-size: 0.75rem;">Ingresos Mes</h5>
                        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${this.formatCurrency(ven.ingresos)}</h3>
                        
                        <h5 style="color: var(--text-secondary); font-size: 0.75rem;">Rendimiento</h5>
                        <h3 style="font-size: 1.1rem; color: ${colorRent};">${rentabilidad.toFixed(1)}%</h3>
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    renderInsumosTable: function() {
        const catalog = {};
        
        if (AppData.catalogo) {
            AppData.catalogo.forEach(c => {
                if (c.insumo) catalog[c.insumo] = c.tipo || 'OTRO';
            });
        }
        
        AppData.recetas.forEach(r => {
            if(r.insumo && !catalog[r.insumo]) catalog[r.insumo] = r.tipoCarne || 'OTRO';
        });
        this.getFilteredData(AppData.bodega).forEach(b => {
            if(b.insumo && !catalog[b.insumo]) catalog[b.insumo] = b.tipo || 'OTRO';
        });
        this.getFilteredData(AppData.compras).forEach(c => {
            if(c.insumo && !catalog[c.insumo]) catalog[c.insumo] = 'OTRO';
        });

        const statsPorInsumo = {};
        for(let ins in catalog) {
            statsPorInsumo[ins] = {
                categoria: catalog[ins],
                insumo: ins,
                stockKg: 0,
                costoStock: 0,
                ingresos: 0,
                costoVentas: 0,
                platos: 0,
                rendimiento: 0
            };
        }

        const latestDateBodega = [...this.getFilteredData(AppData.bodega)].sort((a,b) => b.fecha.localeCompare(a.fecha))[0]?.fecha;
        if (latestDateBodega) {
            const costoPorInsumo = {};
            this.getFilteredData(AppData.compras).forEach(c => {
                if (c.costoUnitario > 0) costoPorInsumo[c.insumo] = c.costoUnitario;
            });

            const ultimosRegistros = this.getFilteredData(AppData.bodega).filter(b => b.fecha === latestDateBodega);
            ultimosRegistros.forEach(b => {
                const ins = b.insumo;
                if(statsPorInsumo[ins]) {
                    const costoKg = costoPorInsumo[ins] || 15000;
                    statsPorInsumo[ins].stockKg = b.pesoTotalBodega;
                    statsPorInsumo[ins].costoStock = b.pesoTotalBodega * costoKg;
                }
            });
        }

        const platoToInsumo = {};
        AppData.recetas.forEach(r => {
            platoToInsumo[r.idPlato] = r.insumo;
        });

        this.getFilteredData(AppData.ventas).forEach(v => {
            const insumo = platoToInsumo[v.idPlato];
            if (insumo && statsPorInsumo[insumo]) {
                statsPorInsumo[insumo].ingresos += v.ingreso;
                statsPorInsumo[insumo].costoVentas += v.costoInsumo;
                statsPorInsumo[insumo].platos += v.cantPlatos;
            }
        });

        for(let ins in statsPorInsumo) {
            const st = statsPorInsumo[ins];
            st.rendimiento = st.ingresos > 0 ? ((st.ingresos - st.costoVentas) / st.ingresos) * 100 : 0;
        }

        this.insumosData = Object.values(statsPorInsumo);

        // Bind Filters
        const filterSelect = document.getElementById('insumos-category-filter');
        if (filterSelect) {
            const cats = new Set(this.insumosData.map(d => d.categoria));
            filterSelect.innerHTML = '<option value="ALL">Todas las Categorías</option>';
            Array.from(cats).sort().forEach(cat => {
                filterSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
            // Remover event listeners viejos si se re-renderiza
            const newSelect = filterSelect.cloneNode(true);
            filterSelect.parentNode.replaceChild(newSelect, filterSelect);
            newSelect.addEventListener('change', (e) => {
                this.insumosFilterCat = e.target.value;
                this.insumosCurrentPage = 1;
                this.updateInsumosView();
            });
        }

        const searchInput = document.getElementById('insumos-search');
        if (searchInput) {
            const newSearch = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearch, searchInput);
            newSearch.addEventListener('input', (e) => {
                this.insumosSearchQuery = e.target.value.toLowerCase();
                this.insumosCurrentPage = 1;
                this.updateInsumosView();
            });
        }

        // Bind Sort Headers
        document.querySelectorAll('#insumos-table th.sortable').forEach(th => {
            // Limpiar listeners viejos clonando
            const newTh = th.cloneNode(true);
            th.parentNode.replaceChild(newTh, th);
            newTh.addEventListener('click', () => {
                const sortBy = newTh.getAttribute('data-sort');
                if(this.insumosSortBy === sortBy) {
                    this.insumosSortDesc = !this.insumosSortDesc;
                } else {
                    this.insumosSortBy = sortBy;
                    this.insumosSortDesc = false;
                }
                this.updateInsumosView();
            });
        });

        // Bind Pagination Buttons
        const btnPrev = document.getElementById('insumos-prev-page');
        const btnNext = document.getElementById('insumos-next-page');
        
        if(btnPrev && btnNext) {
            const newPrev = btnPrev.cloneNode(true);
            const newNext = btnNext.cloneNode(true);
            btnPrev.parentNode.replaceChild(newPrev, btnPrev);
            btnNext.parentNode.replaceChild(newNext, btnNext);
            
            newPrev.addEventListener('click', () => {
                if(this.insumosCurrentPage > 1) {
                    this.insumosCurrentPage--;
                    this.updateInsumosView();
                }
            });
            newNext.addEventListener('click', () => {
                this.insumosCurrentPage++;
                this.updateInsumosView();
            });
        }

        this.updateInsumosView();
    },

    updateInsumosView: function() {
        const tbody = document.querySelector('#insumos-table tbody');
        if(!tbody) return;

        let filtered = this.insumosData;
        
        // Filter by Category
        if(this.insumosFilterCat && this.insumosFilterCat !== 'ALL') {
            filtered = filtered.filter(d => d.categoria === this.insumosFilterCat);
        }

        // Filter by Search Query
        if (this.insumosSearchQuery && this.insumosSearchQuery.trim() !== '') {
            filtered = filtered.filter(d => d.insumo.toLowerCase().includes(this.insumosSearchQuery.trim()));
        }

        filtered.sort((a,b) => {
            let valA = a[this.insumosSortBy];
            let valB = b[this.insumosSortBy];
            if(typeof valA === 'string') {
                return this.insumosSortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
            }
            return this.insumosSortDesc ? valB - valA : valA - valB;
        });

        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.insumosItemsPerPage) || 1;
        if(this.insumosCurrentPage > totalPages) this.insumosCurrentPage = totalPages;
        
        const start = (this.insumosCurrentPage - 1) * this.insumosItemsPerPage;
        const end = start + this.insumosItemsPerPage;
        const pagedData = filtered.slice(start, end);

        tbody.innerHTML = '';
        pagedData.forEach(stats => {
            const colorRent = stats.rendimiento > 30 ? 'var(--success)' : (stats.rendimiento > 0 ? 'var(--warning)' : 'var(--text-muted)');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-secondary); border: 1px solid var(--border-color);">${stats.categoria}</span></td>
                <td><strong>${stats.insumo}</strong></td>
                <td>${stats.stockKg.toFixed(2)}</td>
                <td>${this.formatCurrency(stats.costoStock)}</td>
                <td>${this.formatCurrency(stats.ingresos)}</td>
                <td>${stats.platos}</td>
                <td style="font-weight: bold; color: ${colorRent};">${stats.rendimiento.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('insumos-page-info').textContent = `Página ${this.insumosCurrentPage} de ${totalPages}`;
        
        const prevBtn = document.getElementById('insumos-prev-page');
        const nextBtn = document.getElementById('insumos-next-page');
        if(prevBtn) {
            prevBtn.disabled = this.insumosCurrentPage === 1;
            prevBtn.style.opacity = this.insumosCurrentPage === 1 ? '0.5' : '1';
        }
        if(nextBtn) {
            nextBtn.disabled = this.insumosCurrentPage === totalPages;
            nextBtn.style.opacity = this.insumosCurrentPage === totalPages ? '0.5' : '1';
        }
    }
};
