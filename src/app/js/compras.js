/**
 * Módulo de Compras - Liquidación, Facturación y Control de Proveedores
 * La Finca
 */

const Compras = {
    data: [],
    currentPage: 1,
    itemsPerPage: 10,
    sortBy: 'fecha',
    sortDesc: true,
    tableFilterCat: 'ALL',
    tableSearchQuery: '',
    filterOnlyPending: false,

    init: async function() {
        this.bindEvents();
        this.setupModalEvents();
        await this.loadData();
    },

    loadData: async function() {
        const client = typeof SupabaseConfig !== 'undefined' ? SupabaseConfig.getClient() : null;
        if (client) {
            try {
                const { data, error } = await client
                    .from('compras')
                    .select('*, compras_detalle(*, catalogo_insumos(nombre, categoria))')
                    .order('created_at', { ascending: false });

                if (!error && data && data.length > 0) {
                    const flattened = [];
                    data.forEach(c => {
                        if (c.compras_detalle && c.compras_detalle.length > 0) {
                            c.compras_detalle.forEach(det => {
                                const insumoNom = det.catalogo_insumos?.nombre || 'Insumo';
                                const catNom = det.catalogo_insumos?.categoria || 'CARNE DE RES';
                                const hasFactura = Boolean(c.numero_factura && c.numero_factura !== 'Pendiente');
                                const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura' && c.proveedor !== 'Proveedor Local');

                                flattened.push({
                                    id: c.id,
                                    fecha: c.fecha,
                                    factura: c.numero_factura || 'Pendiente',
                                    proveedor: c.proveedor || 'Pendiente de Factura',
                                    insumo: insumoNom,
                                    categoria: catNom,
                                    cantidad: parseFloat(det.cantidad_kg) || 0,
                                    costoUnitario: parseFloat(det.costo_unitario_kg) || 0,
                                    total: parseFloat(det.costo_total) || parseFloat(c.valor_total) || 0,
                                    estado_factura: (hasFactura && hasProv) ? 'COMPLETA' : 'PENDIENTE',
                                    observaciones: c.observaciones || ''
                                });
                            });
                        } else {
                            const hasFactura = Boolean(c.numero_factura && c.numero_factura !== 'Pendiente');
                            const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura' && c.proveedor !== 'Proveedor Local');

                            flattened.push({
                                id: c.id,
                                fecha: c.fecha,
                                factura: c.numero_factura || 'Pendiente',
                                proveedor: c.proveedor || 'Pendiente de Factura',
                                insumo: 'Compra Registrada',
                                categoria: 'CARNE DE RES',
                                cantidad: 1,
                                costoUnitario: parseFloat(c.valor_total) || 0,
                                total: parseFloat(c.valor_total) || 0,
                                estado_factura: (hasFactura && hasProv) ? 'COMPLETA' : 'PENDIENTE',
                                observaciones: c.observaciones || ''
                            });
                        }
                    });
                    AppData.compras = flattened;
                }
            } catch (e) {
                console.error("Error cargando compras desde Supabase:", e);
            }
        }

        this.renderDateTags();
        this.setDefaultDates();
        this.updateView();
    },

    renderDateTags: function() {
        const container = document.getElementById('compras-date-tags');
        if(!container) return;

        const uniqueDates = [...new Set((AppData.compras || []).map(c => c.fecha))].filter(Boolean).sort((a, b) => b.localeCompare(a));
        
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
                if(fin) fin.value = '';
                
                this.filterOnlyPending = false;
                this.currentPage = 1;
                this.updateView();
            });
            
            container.appendChild(btn);
        });
    },

    bindEvents: function() {
        const btnFiltrar = document.getElementById('compras-btn-filtrar');
        const btnLimpiar = document.getElementById('compras-btn-limpiar');
        const btnPendingFilter = document.getElementById('compras-filter-pending-btn');
        
        if(btnFiltrar) {
            btnFiltrar.addEventListener('click', () => {
                this.filterOnlyPending = false;
                this.currentPage = 1;
                this.updateView();
            });
        }
        
        if(btnLimpiar) {
            btnLimpiar.addEventListener('click', () => {
                this.setDefaultDates();
                this.filterOnlyPending = false;
                this.currentPage = 1;
                this.updateView();
            });
        }

        if(btnPendingFilter) {
            btnPendingFilter.addEventListener('click', () => {
                this.filterOnlyPending = !this.filterOnlyPending;
                btnPendingFilter.textContent = this.filterOnlyPending ? 'Ver Todas' : 'Ver Solo Pendientes';
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
                this.tableSearchQuery = e.target.value.toLowerCase().trim();
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

    setupModalEvents: function() {
        const modalBackdrop = document.getElementById('modal-factura-backdrop');
        const closeBtn = document.getElementById('modal-factura-close');
        const cancelBtn = document.getElementById('modal-factura-cancel');
        const form = document.getElementById('form-modal-factura');

        const closeModal = () => {
            if (modalBackdrop) modalBackdrop.style.display = 'none';
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) closeModal();
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleSaveFacturaModal();
            });
        }
    },

    openModalCompletarFactura: function(compraId) {
        const compra = (AppData.compras || []).find(c => String(c.id) === String(compraId) || c.insumo_id === compraId);
        if (!compra) return;

        const modalBackdrop = document.getElementById('modal-factura-backdrop');
        if (!modalBackdrop) return;

        document.getElementById('modal-factura-id').value = compra.id || compra.insumo_id;
        document.getElementById('modal-factura-insumo').textContent = compra.insumo;
        document.getElementById('modal-factura-cant').textContent = `${parseFloat(compra.cantidad || 0).toFixed(2)} Kg`;
        document.getElementById('modal-factura-fecha').textContent = `Fecha de recepción: ${compra.fecha || 'Hoy'}`;

        const numInp = document.getElementById('modal-factura-num');
        const provInp = document.getElementById('modal-factura-prov');
        const totalInp = document.getElementById('modal-factura-total');
        const obsInp = document.getElementById('modal-factura-obs');

        if (numInp) numInp.value = (compra.factura && compra.factura !== 'Pendiente') ? compra.factura : '';
        if (provInp) provInp.value = (compra.proveedor && compra.proveedor !== 'Pendiente de Factura' && compra.proveedor !== 'Proveedor Local') ? compra.proveedor : '';
        if (totalInp) totalInp.value = compra.total || (compra.cantidad * (compra.costoUnitario || 0));
        if (obsInp) obsInp.value = compra.observaciones || '';

        modalBackdrop.style.display = 'flex';
        if (numInp) numInp.focus();
    },

    handleSaveFacturaModal: async function() {
        const id = document.getElementById('modal-factura-id')?.value;
        const numFactura = document.getElementById('modal-factura-num')?.value?.trim();
        const proveedor = document.getElementById('modal-factura-prov')?.value?.trim();
        const costoTotal = parseFloat(document.getElementById('modal-factura-total')?.value);
        const obs = document.getElementById('modal-factura-obs')?.value?.trim();

        if (!numFactura) return alert("Por favor ingresa el número de factura o remisión.");
        if (!proveedor) return alert("Por favor ingresa el nombre del proveedor.");
        if (!costoTotal || costoTotal <= 0) return alert("Ingresa el costo total liquidado.");

        const compra = (AppData.compras || []).find(c => String(c.id) === String(id) || c.insumo_id === id);
        if (compra) {
            compra.factura = numFactura;
            compra.proveedor = proveedor;
            compra.total = costoTotal;
            compra.costoUnitario = compra.cantidad > 0 ? (costoTotal / compra.cantidad) : compra.costoUnitario;
            compra.estado_factura = 'COMPLETA';
            compra.observaciones = obs || 'Factura completada por Administración';

            // Actualizar en Supabase si es UUID real
            if (compra.id && typeof compra.id === 'string' && compra.id.includes('-') && !compra.id.startsWith('comp-')) {
                try {
                    await MovimientosService.actualizarCompraFactura({
                        compraId: compra.id,
                        numeroFactura: numFactura,
                        proveedor: proveedor,
                        valorTotal: costoTotal,
                        observaciones: obs
                    });
                } catch (err) {
                    console.warn("No se pudo actualizar en BD remota (se actualizó en memoria):", err);
                }
            }
        }

        document.getElementById('modal-factura-backdrop').style.display = 'none';
        this.updateView();

        if (typeof BodegueroTerminal !== 'undefined' && BodegueroTerminal.showToast) {
            BodegueroTerminal.showToast(`✅ Factura ${numFactura} (${proveedor}) completada y liquidada.`);
        }
    },

    setDefaultDates: function() {
        const fechas = (AppData.compras || []).map(c => c.fecha).filter(Boolean).sort();
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

        // Actualizar tags activos
        const tags = document.querySelectorAll('#compras-date-tags .date-tag');
        tags.forEach(tag => {
            if (d1 === tag.getAttribute('data-date') && !d2) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });

        // Definir categoria de cada insumo
        const catalog = {};
        (AppData.recetas || []).forEach(r => { if(r.insumo) catalog[r.insumo] = r.tipoCarne || 'CARNE DE RES'; });
        (AppData.bodega || []).forEach(b => { if(b.insumo && !catalog[b.insumo]) catalog[b.insumo] = b.tipo || 'CARNE DE RES'; });
        
        const mappedData = (AppData.compras || []).map(c => {
            const hasFactura = Boolean(c.factura && c.factura !== 'Pendiente');
            const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura' && c.proveedor !== 'Proveedor Local');
            const estado = c.estado_factura || ((hasFactura && hasProv) ? 'COMPLETA' : 'PENDIENTE');

            return {
                ...c,
                id: c.id || `comp-${c.insumo}-${c.fecha}`,
                factura: c.factura || 'Pendiente',
                proveedor: c.proveedor || 'Proveedor Local',
                estado_factura: estado,
                categoria: c.categoria || catalog[c.insumo] || 'CARNES',
                total: c.total || (c.cantidad * (c.costoUnitario || 0))
            };
        });

        let result = mappedData;

        if (this.filterOnlyPending) {
            result = result.filter(c => c.estado_factura === 'PENDIENTE');
        }

        if(!d1 && !d2) return result;

        return result.filter(c => {
            if (d1 && !d2) return c.fecha === d1;
            if (!d1 && d2) return c.fecha === d2;
            
            let pass = true;
            if(d1 && c.fecha < d1) pass = false;
            if(d2 && c.fecha > d2) pass = false;
            return pass;
        });
    },

    updateView: function() {
        const filtered = this.getFilteredData();
        
        // Contar cuántas compras están pendientes de factura
        const allCompras = AppData.compras || [];
        const totalPending = allCompras.filter(c => {
            const hasFactura = Boolean(c.factura && c.factura !== 'Pendiente');
            const hasProv = Boolean(c.proveedor && c.proveedor !== 'Pendiente de Factura' && c.proveedor !== 'Proveedor Local');
            return (c.estado_factura === 'PENDIENTE') || (!hasFactura || !hasProv);
        }).length;

        const pendingAlert = document.getElementById('compras-pending-alert');
        const pendingMsg = document.getElementById('compras-pending-msg');
        if (pendingAlert && pendingMsg) {
            if (totalPending > 0) {
                pendingMsg.textContent = `Tienes ${totalPending} compra${totalPending === 1 ? '' : 's'} registrada${totalPending === 1 ? '' : 's'} por bodega pendiente${totalPending === 1 ? '' : 's'} por completar factura y proveedor.`;
                pendingAlert.style.display = 'flex';
            } else {
                pendingAlert.style.display = 'none';
            }
        }

        // 1. Calcular KPIs
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
        if (kpiBodegaPeso && kpiBodegaPorciones && AppData.bodega) {
            const inicio = document.getElementById('compras-fecha-inicio');
            const fin = document.getElementById('compras-fecha-fin');
            const d1 = inicio ? inicio.value : '';
            const d2 = fin ? fin.value : '';

            const bodegaFiltered = AppData.bodega.filter(b => {
                if (d1 && !d2) return b.fecha === d1;
                if (!d1 && d2) return b.fecha === d2;
                let pass = true;
                if(d1 && b.fecha < d1) pass = false;
                if(d2 && b.fecha > d2) pass = false;
                return pass;
            });

            const fechas = [...new Set(bodegaFiltered.map(b => b.fecha))].sort();
            const lastDate = fechas.length > 0 ? fechas[fechas.length - 1] : null;
            
            let pesoEnBodega = 0;
            if (lastDate) {
                pesoEnBodega = bodegaFiltered.filter(b => b.fecha === lastDate).reduce((acc, curr) => acc + curr.cantBodega, 0);
            }

            const totalPorciones = bodegaFiltered.reduce((acc, curr) => acc + (curr.porcACocina || 0), 0);
            const totalPesoPorciones = bodegaFiltered.reduce((acc, curr) => acc + (curr.pesoACocina || 0), 0);

            kpiBodegaPeso.textContent = pesoEnBodega.toFixed(1);
            kpiBodegaPorciones.innerHTML = `${totalPorciones.toFixed(0)} <span style="font-size:1rem;">Unds</span>`;
            
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

        if (this.tableFilterCat !== 'ALL' && validCats.length > 0 && !validCats.includes(this.tableFilterCat)) {
             this.tableFilterCat = 'ALL';
             if (catFilterSelect) catFilterSelect.value = 'ALL';
        }

        if (this.tableFilterCat !== 'ALL') {
             tableData = tableData.filter(d => d.categoria === this.tableFilterCat);
        }
        if (this.tableSearchQuery.trim() !== '') {
             const q = this.tableSearchQuery;
             tableData = tableData.filter(d => 
                 (d.insumo && d.insumo.toLowerCase().includes(q)) ||
                 (d.factura && d.factura.toLowerCase().includes(q)) ||
                 (d.proveedor && d.proveedor.toLowerCase().includes(q))
             );
        }

        tableData.sort((a,b) => {
            let valA = a[this.sortBy];
            let valB = b[this.sortBy];
            if(typeof valA === 'string') {
                return this.sortDesc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
            }
            return this.sortDesc ? (valB || 0) - (valA || 0) : (valA || 0) - (valB || 0);
        });

        const totalItemsTable = tableData.length;
        const totalPages = Math.ceil(totalItemsTable / this.itemsPerPage) || 1;
        if(this.currentPage > totalPages) this.currentPage = totalPages || 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const paged = tableData.slice(start, start + this.itemsPerPage);

        const tbody = document.querySelector('#tabla-compras tbody');
        if(tbody) {
            if (paged.length === 0) {
                tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron compras en el rango seleccionado.</td></tr>`;
            } else {
                tbody.innerHTML = paged.map(row => {
                    const isPending = row.estado_factura === 'PENDIENTE' || row.factura === 'Pendiente' || row.proveedor === 'Pendiente de Factura';
                    
                    const facturaBadge = (!row.factura || row.factura === 'Pendiente')
                        ? `<span style="color:#d97706; font-style:italic; font-weight:600;">⚠️ Pendiente</span>`
                        : `<strong>${row.factura}</strong>`;

                    const provBadge = (!row.proveedor || row.proveedor === 'Pendiente de Factura' || row.proveedor === 'Proveedor Local')
                        ? `<span style="color:#64748b; font-style:italic;">${row.proveedor || 'Sin especificar'}</span>`
                        : row.proveedor;

                    const estadoBadge = isPending
                        ? `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700;">⚠️ PENDIENTE FACTURA</span>`
                        : `<span class="badge" style="background:#d1fae5; color:#065f46; border:1px solid #a7f3d0; font-weight:700;">✓ COMPLETA</span>`;

                    const actionBtn = isPending
                        ? `<button type="button" class="btn-completar-factura" data-id="${row.id}" style="background:#f59e0b; color:#ffffff; border:none; padding:0.35rem 0.75rem; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem;">✏️ Completar Factura</button>`
                        : `<button type="button" class="btn-completar-factura" data-id="${row.id}" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:0.35rem 0.75rem; border-radius:6px; font-size:0.78rem; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:0.3rem;">✏️ Editar</button>`;

                    return `
                        <tr>
                            <td>${row.fecha}</td>
                            <td>${facturaBadge}</td>
                            <td>${provBadge}</td>
                            <td><span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-secondary); border: 1px solid var(--border-color);">${row.categoria}</span></td>
                            <td><strong>${row.insumo}</strong></td>
                            <td style="text-align: right; font-weight:600;">${row.cantidad.toFixed(2)}</td>
                            <td style="text-align: right;">${Dashboard.formatCurrency(row.costoUnitario)}</td>
                            <td style="text-align: right; font-weight: bold; color: var(--danger);">${Dashboard.formatCurrency(row.total)}</td>
                            <td style="text-align: center;">${estadoBadge}</td>
                            <td style="text-align: center;">${actionBtn}</td>
                        </tr>
                    `;
                }).join('');

                // Asignar listeners a botones de completar factura
                tbody.querySelectorAll('.btn-completar-factura').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const compraId = btn.getAttribute('data-id');
                        this.openModalCompletarFactura(compraId);
                    });
                });
            }
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

        lucide.createIcons();
    }
};

window.Compras = Compras;
