const Ventas = {
    data: [],
    currentPage: 1,
    itemsPerPage: 10,
    sortBy: 'fecha',
    sortDesc: true,
    tableFilterCat: 'ALL',
    tableSearchQuery: '',

    init: function() {
        if(!AppData.ventas || AppData.ventas.length === 0) return;
        this.renderDateTags();
        this.bindEvents();
        this.setDefaultDates();
        this.updateView();
    },

    renderDateTags: function() {
        const container = document.getElementById('ventas-date-tags');
        if(!container) return;

        const uniqueDates = [...new Set(AppData.ventas.map(v => v.fecha))].sort((a, b) => b.localeCompare(a));
        
        container.innerHTML = '';
        uniqueDates.forEach(date => {
            const btn = document.createElement('button');
            btn.className = 'date-tag';
            btn.textContent = date;
            btn.setAttribute('data-date', date);
            
            btn.addEventListener('click', () => {
                const inicio = document.getElementById('ventas-fecha-inicio');
                const fin = document.getElementById('ventas-fecha-fin');
                if(inicio) inicio.value = date;
                if(fin) fin.value = ''; // Vaciar "Hasta" para forzar búsqueda de 1 solo día
                
                this.currentPage = 1;
                this.updateView();
            });
            
            container.appendChild(btn);
        });
    },

    bindEvents: function() {
        const btnFiltrar = document.getElementById('ventas-btn-filtrar');
        const btnLimpiar = document.getElementById('ventas-btn-limpiar');
        
        if(btnFiltrar) {
            btnFiltrar.addEventListener('click', () => {
                this.currentPage = 1;
                this.updateView();
            });
        }
        
        if(btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.setDefaultDates();
                this.currentPage = 1;
                this.updateView();
            });
        }

        // Headers sort
        document.querySelectorAll('#tabla-ventas th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const sortKey = th.getAttribute('data-sort');
                if(this.sortBy === sortKey) {
                    this.sortDesc = !this.sortDesc;
                } else {
                    this.sortBy = sortKey;
                    this.sortDesc = true;
                }
                this.updateView();
            });
        });

        // Pagination
        const btnPrev = document.getElementById('ventas-prev-page');
        const btnNext = document.getElementById('ventas-next-page');
        
        if(btnPrev) {
            btnPrev.addEventListener('click', () => {
                if(this.currentPage > 1) { this.currentPage--; this.updateView(); }
            });
        }
        if(btnNext) {
            btnNext.addEventListener('click', () => {
                this.currentPage++; this.updateView();
            });
        }

        const searchInput = document.getElementById('ventas-table-search');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.tableSearchQuery = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.updateView();
            });
        }
        
        const catFilter = document.getElementById('ventas-table-category');
        if(catFilter) {
            catFilter.addEventListener('change', (e) => {
                this.tableFilterCat = e.target.value;
                this.currentPage = 1;
                this.updateView();
            });
        }
    },

    setDefaultDates: function() {
        // Encontrar min y max fecha
        const fechas = AppData.ventas.map(v => v.fecha).sort();
        if(fechas.length === 0) return;
        
        const minFecha = fechas[0];
        const maxFecha = fechas[fechas.length-1];
        
        const inicio = document.getElementById('ventas-fecha-inicio');
        const fin = document.getElementById('ventas-fecha-fin');
        
        if(inicio) inicio.value = minFecha;
        if(fin) fin.value = maxFecha;
    },

    getFilteredData: function() {
        const inicio = document.getElementById('ventas-fecha-inicio');
        const fin = document.getElementById('ventas-fecha-fin');
        
        const d1 = inicio ? inicio.value : '';
        const d2 = fin ? fin.value : '';

        // Actualizar el estado visual de los tags
        const tags = document.querySelectorAll('#ventas-date-tags .date-tag');
        tags.forEach(tag => {
            if (d1 === tag.getAttribute('data-date') && !d2) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });

        // Mapa de recetas para encontrar nombre del plato y categoría
        const recetaMap = {};
        if (AppData.recetas) {
            AppData.recetas.forEach(r => {
                if (r.idPlato) {
                    recetaMap[r.idPlato] = {
                        plato: r.plato || 'Desconocido',
                        categoria: r.tipoCarne || 'OTRO'
                    };
                }
            });
        }
        
        const mappedData = AppData.ventas.map(v => {
            const recetaInfo = recetaMap[v.idPlato] || { plato: v.idPlato, categoria: 'OTRO' };
            return {
                ...v,
                plato: recetaInfo.plato,
                categoria: recetaInfo.categoria
            };
        });

        if(!d1 && !d2) return mappedData;

        return mappedData.filter(v => {
            // Si solo hay una fecha, buscar exactamente ese día
            if (d1 && !d2) return v.fecha === d1;
            if (!d1 && d2) return v.fecha === d2;
            
            // Si hay ambas fechas, buscar por rango
            let pass = true;
            if(d1 && v.fecha < d1) pass = false;
            if(d2 && v.fecha > d2) pass = false;
            return pass;
        });
    },

    updateView: function() {
        const filtered = this.getFilteredData();
        
        // 1. Calculate KPIs
        const totalIngresos = filtered.reduce((acc, curr) => acc + curr.ingreso, 0);
        const totalCostos = filtered.reduce((acc, curr) => acc + curr.costoInsumo, 0);
        const totalItems = filtered.reduce((acc, curr) => acc + curr.cantPlatos, 0);
        const ticketPromedio = totalItems > 0 ? (totalIngresos / totalItems) : 0;
        const rentabilidad = totalIngresos > 0 ? ((totalIngresos - totalCostos) / totalIngresos) * 100 : 0;

        const kpiTotal = document.getElementById('kpi-ventas-total');
        const kpiItems = document.getElementById('kpi-ventas-items');
        const kpiTicket = document.getElementById('kpi-ventas-ticket');
        const kpiRentabilidad = document.getElementById('kpi-ventas-rentabilidad');

        if(kpiTotal) kpiTotal.textContent = Dashboard.formatCurrency(totalIngresos);
        if(kpiItems) kpiItems.textContent = totalItems.toFixed(0);
        if(kpiTicket) kpiTicket.textContent = Dashboard.formatCurrency(ticketPromedio);
        if(kpiRentabilidad) {
            kpiRentabilidad.textContent = `${rentabilidad.toFixed(1)}%`;
            kpiRentabilidad.style.color = rentabilidad > 30 ? 'var(--success)' : 'var(--warning)';
        }

        // 2. Render Cards by Category
        const catMap = {};
        filtered.forEach(v => {
            if(!catMap[v.categoria]) catMap[v.categoria] = { ingreso: 0, platos: 0 };
            catMap[v.categoria].ingreso += v.ingreso;
            catMap[v.categoria].platos += v.cantPlatos;
        });

        const cardsContainer = document.getElementById('ventas-category-cards');
        if(cardsContainer) {
            cardsContainer.innerHTML = '';
            Object.keys(catMap).sort().forEach(cat => {
                const data = catMap[cat];
                const html = `
                    <div class="kpi-card mini-card" style="border-bottom: 3px solid var(--accent-primary);">
                        <div class="kpi-header">
                            <h4 style="color: var(--text-secondary); font-size: 1rem;">${cat}</h4>
                        </div>
                        <div style="margin-top: 1rem;">
                            <h3 style="font-size: 1.25rem;">${Dashboard.formatCurrency(data.ingreso)}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted);">${data.platos.toFixed(0)} Platos vendidos</p>
                        </div>
                    </div>
                `;
                cardsContainer.innerHTML += html;
            });
        }

        // 3. Render Table with Sort and Pagination
        let tableData = [...filtered];

        const catFilterSelect = document.getElementById('ventas-table-category');
        let validCats = [];
        if (catFilterSelect) {
             validCats = [...new Set(filtered.map(d => d.categoria))].sort();
             catFilterSelect.innerHTML = '<option value="ALL">Todas las Categorías</option>';
             validCats.forEach(c => {
                 catFilterSelect.innerHTML += `<option value="${c}" ${c === this.tableFilterCat ? 'selected' : ''}>${c}</option>`;
             });
        }

        // Reset persistent category filter if invalid
        if (this.tableFilterCat !== 'ALL' && validCats.length > 0 && !validCats.includes(this.tableFilterCat)) {
             this.tableFilterCat = 'ALL';
             if (catFilterSelect) catFilterSelect.value = 'ALL';
        }

        if (this.tableFilterCat !== 'ALL') {
             tableData = tableData.filter(d => d.categoria === this.tableFilterCat);
        }
        if (this.tableSearchQuery.trim() !== '') {
             tableData = tableData.filter(d => d.plato.toLowerCase().includes(this.tableSearchQuery.trim()));
        }

        tableData.sort((a,b) => {
            let valA = a[this.sortBy];
            let valB = b[this.sortBy];
            if(typeof valA === 'string') {
                return this.sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
            }
            return this.sortDesc ? valB - valA : valA - valB;
        });

        const totalItemsTable = tableData.length;
        const totalPages = Math.ceil(totalItemsTable / this.itemsPerPage) || 1;
        if(this.currentPage > totalPages) this.currentPage = totalPages || 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const paged = tableData.slice(start, start + this.itemsPerPage);

        const tbody = document.querySelector('#tabla-ventas tbody');
        if(tbody) {
            tbody.innerHTML = '';
            paged.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.fecha}</td>
                    <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-secondary); border: 1px solid var(--border-color);">${row.categoria}</span></td>
                    <td><strong>${row.plato}</strong></td>
                    <td>${row.cantPlatos.toFixed(0)}</td>
                    <td style="color: var(--danger);">${Dashboard.formatCurrency(row.costoInsumo)}</td>
                    <td style="font-weight: bold; color: var(--success);">${Dashboard.formatCurrency(row.ingreso)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        const pageInfo = document.getElementById('ventas-page-info');
        const prevBtn = document.getElementById('ventas-prev-page');
        const nextBtn = document.getElementById('ventas-next-page');

        if(pageInfo) pageInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
        
        if(prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.style.opacity = this.currentPage === 1 ? '0.5' : '1';
        }
        if(nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
            nextBtn.style.opacity = this.currentPage === totalPages ? '0.5' : '1';
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
};
