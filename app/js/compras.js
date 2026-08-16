const Compras = {
    data: [],
    currentPage: 1,
    itemsPerPage: 10,
    sortBy: 'fecha',
    sortDesc: true,
    tableFilterCat: 'ALL',
    tableSearchQuery: '',

    init: function() {
        if(!AppData.compras || AppData.compras.length === 0) return;
        this.renderDateTags();
        this.bindEvents();
        this.setDefaultDates();
        this.updateView();
    },

    renderDateTags: function() {
        const container = document.getElementById('compras-date-tags');
        if(!container) return;

        const uniqueDates = [...new Set(AppData.compras.map(c => c.fecha))].sort((a, b) => b.localeCompare(a));
        
        container.innerHTML = '';
        uniqueDates.forEach(date => {
            const btn = document.createElement('button');
            btn.className = 'date-tag';
            btn.textContent = date;
            btn.setAttribute('data-date', date);
            
            btn.addEventListener('click', () => {
                const inicio = document.getElementById('compras-fecha-inicio');
                const fin = document.getElementById('compras-fecha-fin');
                if(inicio) inicio.value = date;
                if(fin) fin.value = ''; // Vaciar "Hasta" para forzar búsqueda de 1 solo día
                
                this.currentPage = 1;
                this.updateView();
            });
            
            container.appendChild(btn);
        });
    },

    bindEvents: function() {
        const btnFiltrar = document.getElementById('compras-btn-filtrar');
        const btnLimpiar = document.getElementById('compras-btn-limpiar');
        
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
        document.querySelectorAll('#tabla-compras th.sortable').forEach(th => {
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
        const btnPrev = document.getElementById('compras-prev-page');
        const btnNext = document.getElementById('compras-next-page');
        
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

        const searchInput = document.getElementById('compras-table-search');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.tableSearchQuery = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.updateView();
            });
        }
        
        const catFilter = document.getElementById('compras-table-category');
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
        const fechas = AppData.compras.map(c => c.fecha).sort();
        if(fechas.length === 0) return;
        
        const minFecha = fechas[0];
        const maxFecha = fechas[fechas.length-1];
        
        const inicio = document.getElementById('compras-fecha-inicio');
        const fin = document.getElementById('compras-fecha-fin');
        
        if(inicio) inicio.value = minFecha;
        if(fin) fin.value = maxFecha;
    },

    getFilteredData: function() {
        const inicio = document.getElementById('compras-fecha-inicio');
        const fin = document.getElementById('compras-fecha-fin');
        
        const d1 = inicio ? inicio.value : '';
        const d2 = fin ? fin.value : '';

        // Actualizar el estado visual de los tags (colorear el tag activo si solo hay d1)
        const tags = document.querySelectorAll('#compras-date-tags .date-tag');
        tags.forEach(tag => {
            if (d1 === tag.getAttribute('data-date') && !d2) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });

        // Definir categoria de cada insumo usando recetas y bodega
        const catalog = {};
        AppData.recetas.forEach(r => { if(r.insumo) catalog[r.insumo] = r.tipoCarne || 'OTRO'; });
        AppData.bodega.forEach(b => { if(b.insumo && !catalog[b.insumo]) catalog[b.insumo] = b.tipo || 'OTRO'; });
        
        const mappedData = AppData.compras.map(c => ({
            ...c,
            categoria: catalog[c.insumo] || 'OTRO',
            total: c.cantidad * c.costoUnitario
        }));

        if(!d1 && !d2) return mappedData;

        return mappedData.filter(c => {
            // Si solo hay una fecha, buscar exactamente ese día
            if (d1 && !d2) return c.fecha === d1;
            if (!d1 && d2) return c.fecha === d2;
            
            // Si hay ambas fechas, buscar por rango
            let pass = true;
            if(d1 && c.fecha < d1) pass = false;
            if(d2 && c.fecha > d2) pass = false;
            return pass;
        });
    },

    updateView: function() {
        const filtered = this.getFilteredData();
        
        // 1. Calculate KPIs
        const totalGastado = filtered.reduce((acc, curr) => acc + curr.total, 0);
        const totalItems = filtered.reduce((acc, curr) => acc + curr.cantidad, 0);
        const ticketPromedio = filtered.length > 0 ? (totalGastado / filtered.length) : 0;

        const kpiTotal = document.getElementById('kpi-compras-total');
        const kpiItems = document.getElementById('kpi-compras-items');
        const kpiTicket = document.getElementById('kpi-compras-ticket');
        const kpiBodegaPeso = document.getElementById('kpi-bodega-peso');
        const kpiBodegaPorciones = document.getElementById('kpi-bodega-porciones');

        if(kpiTotal) kpiTotal.textContent = Dashboard.formatCurrency(totalGastado);
        if(kpiItems) kpiItems.textContent = totalItems.toFixed(1);
        if(kpiTicket) kpiTicket.textContent = Dashboard.formatCurrency(ticketPromedio);

        // Calculate Bodega KPIs for the same date range
        if (kpiBodegaPeso && kpiBodegaPorciones) {
            const inicio = document.getElementById('compras-fecha-inicio');
            const fin = document.getElementById('compras-fecha-fin');
            const d1 = inicio ? inicio.value : '';
            const d2 = fin ? fin.value : '';

            // Filter Bodega data
            const bodegaFiltered = AppData.bodega.filter(b => {
                if (d1 && !d2) return b.fecha === d1;
                if (!d1 && d2) return b.fecha === d2;
                let pass = true;
                if(d1 && b.fecha < d1) pass = false;
                if(d2 && b.fecha > d2) pass = false;
                return pass;
            });

            // "Peso Total en Bodega" makes sense as the sum of the LAST day of the selected range
            const fechas = [...new Set(bodegaFiltered.map(b => b.fecha))].sort();
            const lastDate = fechas.length > 0 ? fechas[fechas.length - 1] : null;
            
            let pesoEnBodega = 0;
            if (lastDate) {
                pesoEnBodega = bodegaFiltered.filter(b => b.fecha === lastDate).reduce((acc, curr) => acc + curr.cantBodega, 0);
            }

            // "Total Porcionados" makes sense as the sum over the entire range
            const totalPorciones = bodegaFiltered.reduce((acc, curr) => acc + curr.porcACocina, 0);
            const totalPesoPorciones = bodegaFiltered.reduce((acc, curr) => acc + curr.pesoACocina, 0);

            kpiBodegaPeso.textContent = pesoEnBodega.toFixed(1);
            kpiBodegaPorciones.innerHTML = `${totalPorciones.toFixed(0)} <span style="font-size:1rem;">Unds</span>`;
            
            // Usamos el subtitulo para mostrar el peso
            const subtitlePorciones = kpiBodegaPorciones.nextElementSibling;
            if(subtitlePorciones) {
                subtitlePorciones.textContent = `Equivalente a ${totalPesoPorciones.toFixed(1)} Kg`;
            }
        }

        // 2. Render Cards by Category
        const catMap = {};
        filtered.forEach(c => {
            if(!catMap[c.categoria]) catMap[c.categoria] = { total: 0, items: 0 };
            catMap[c.categoria].total += c.total;
            catMap[c.categoria].items += c.cantidad;
        });

        const cardsContainer = document.getElementById('compras-category-cards');
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
                            <h3 style="font-size: 1.25rem;">${Dashboard.formatCurrency(data.total)}</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted);">${data.items.toFixed(1)} Kg comprados</p>
                        </div>
                    </div>
                `;
                cardsContainer.innerHTML += html;
            });
        }

        // 3. Render Table with Sort and Pagination
        let tableData = [...filtered];

        const catFilterSelect = document.getElementById('compras-table-category');
        let validCats = [];
        if (catFilterSelect) {
             validCats = [...new Set(filtered.map(d => d.categoria))].sort();
             catFilterSelect.innerHTML = '<option value="ALL">Todas las Categorías</option>';
             validCats.forEach(c => {
                 catFilterSelect.innerHTML += `<option value="${c}" ${c === this.tableFilterCat ? 'selected' : ''}>${c}</option>`;
             });
        }

        // Si la categoría seleccionada ya no existe en el nuevo set de datos, resetear a 'ALL'
        if (this.tableFilterCat !== 'ALL' && validCats.length > 0 && !validCats.includes(this.tableFilterCat)) {
             this.tableFilterCat = 'ALL';
             if (catFilterSelect) catFilterSelect.value = 'ALL';
        }

        if (this.tableFilterCat !== 'ALL') {
             tableData = tableData.filter(d => d.categoria === this.tableFilterCat);
        }
        if (this.tableSearchQuery.trim() !== '') {
             tableData = tableData.filter(d => d.insumo.toLowerCase().includes(this.tableSearchQuery.trim()));
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

        const tbody = document.querySelector('#tabla-compras tbody');
        if(tbody) {
            tbody.innerHTML = '';
            paged.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.fecha}</td>
                    <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-secondary); border: 1px solid var(--border-color);">${row.categoria}</span></td>
                    <td><strong>${row.insumo}</strong></td>
                    <td>${row.cantidad.toFixed(2)}</td>
                    <td>${Dashboard.formatCurrency(row.costoUnitario)}</td>
                    <td style="font-weight: bold; color: var(--danger);">${Dashboard.formatCurrency(row.total)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        const footerCantidad = document.getElementById('compras-footer-cantidad');
        const footerTotal = document.getElementById('compras-footer-total');
        if(footerCantidad && footerTotal) {
            const sumCantidad = tableData.reduce((acc, curr) => acc + curr.cantidad, 0);
            const sumTotal = tableData.reduce((acc, curr) => acc + curr.total, 0);
            footerCantidad.textContent = sumCantidad.toFixed(2);
            footerTotal.textContent = Dashboard.formatCurrency(sumTotal);
        }

        const pageInfo = document.getElementById('compras-page-info');
        const prevBtn = document.getElementById('compras-prev-page');
        const nextBtn = document.getElementById('compras-next-page');

        if(pageInfo) pageInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
        
        if(prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.style.opacity = this.currentPage === 1 ? '0.5' : '1';
        }
        if(nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
            nextBtn.style.opacity = this.currentPage === totalPages ? '0.5' : '1';
        }
    }
};
