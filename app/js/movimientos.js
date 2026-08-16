const Movimientos = {
    init: function() {
        this.populateFilters();
        this.bindEvents();
        this.updateView();
    },

    populateFilters: function() {
        const fechas = new Set();
        const categorias = new Set();

        AppData.bodega.forEach(r => {
            if(r.fecha) fechas.add(r.fecha);
            if(r.tipo) categorias.add(r.tipo);
        });

        const sortedFechas = Array.from(fechas).sort().reverse();
        
        const selFecha = document.getElementById('filter-fecha');
        selFecha.innerHTML = '';
        sortedFechas.forEach(f => {
            selFecha.innerHTML += `<option value="${f}">${f}</option>`;
        });

        const selCat = document.getElementById('filter-categoria');
        selCat.innerHTML = '<option value="ALL">Todas las Categorías</option>';
        Array.from(categorias).sort().forEach(c => {
            selCat.innerHTML += `<option value="${c}">${c}</option>`;
        });

        this.updateInsumoDropdown();
    },

    updateInsumoDropdown: function() {
        const cat = document.getElementById('filter-categoria').value;
        const insumos = new Set();
        
        AppData.bodega.forEach(r => {
            if (cat === 'ALL' || r.tipo === cat) {
                if(r.insumo) insumos.add(r.insumo);
            }
        });
        
        const selInsumo = document.getElementById('filter-insumo');
        const prevSelected = selInsumo.value;
        
        selInsumo.innerHTML = '<option value="ALL">Todos los Insumos</option>';
        Array.from(insumos).sort().forEach(i => {
            selInsumo.innerHTML += `<option value="${i}">${i}</option>`;
        });
        
        if (prevSelected !== 'ALL' && insumos.has(prevSelected)) {
            selInsumo.value = prevSelected;
        } else {
            selInsumo.value = 'ALL';
        }
    },

    bindEvents: function() {
        document.getElementById('filter-fecha').addEventListener('change', () => this.updateView());
        document.getElementById('filter-insumo').addEventListener('change', () => this.updateView());
        
        document.getElementById('filter-categoria').addEventListener('change', () => {
            this.updateInsumoDropdown();
            this.updateView();
        });
    },

    updateView: function() {
        const fecha = document.getElementById('filter-fecha').value;
        const insumo = document.getElementById('filter-insumo').value;

        const detailsDiv = document.getElementById('insumo-details');
        const promptDiv = document.getElementById('movimientos-select-prompt');

        if (insumo === 'ALL') {
            detailsDiv.classList.add('hidden');
            promptDiv.classList.remove('hidden');
            return;
        }

        const dataInsumoDia = AppData.bodega.filter(r => r.fecha === fecha && r.insumo === insumo);

        if (dataInsumoDia.length === 0) {
            detailsDiv.classList.add('hidden');
            promptDiv.innerHTML = `<i data-lucide="alert-circle"></i><h4>No hay movimientos registrados para ${insumo} en la fecha ${fecha}</h4>`;
            promptDiv.classList.remove('hidden');
            lucide.createIcons();
            return;
        }

        detailsDiv.classList.remove('hidden');
        promptDiv.classList.add('hidden');

        document.getElementById('badge-fecha-inicial').textContent = fecha;
        document.getElementById('badge-fecha-final').textContent = fecha;

        // ESTADO INICIAL (Primer registro del día)
        const estadoInicial = dataInsumoDia[0];
        document.getElementById('mov-ini-porc').textContent = estadoInicial.stockInicialPorc;
        document.getElementById('mov-ini-peso-porc').textContent = estadoInicial.pesoPorc.toFixed(2);
        document.getElementById('mov-ini-sin-porc').textContent = estadoInicial.stockInicialSinPorc.toFixed(2);
        
        // El total en bodega en ese instante (antes de movimientos del día)
        // Podría ser la suma del peso porc y sin porcionar
        const totalIni = estadoInicial.pesoPorc + estadoInicial.stockInicialSinPorc;
        document.getElementById('mov-ini-total').textContent = totalIni.toFixed(2);


        // TOTALIZACIÓN (Suma de todos los registros del día para este insumo)
        let totOutPorc = 0, totOutPeso = 0, totInPorc = 0, totInPeso = 0, totIngreso = 0;
        
        dataInsumoDia.forEach(r => {
            totOutPorc += r.porcACocina;
            totOutPeso += r.pesoACocina;
            totInPorc += r.porcDevueltas;
            totInPeso += r.pesoDevueltas;
            totIngreso += r.ingresoFactura;
        });

        document.getElementById('mov-tot-out-porc').textContent = totOutPorc;
        document.getElementById('mov-tot-out-peso').textContent = totOutPeso.toFixed(2);
        document.getElementById('mov-tot-in-porc').textContent = totInPorc;
        document.getElementById('mov-tot-in-peso').textContent = totInPeso.toFixed(2);
        document.getElementById('mov-tot-ingreso').textContent = totIngreso.toFixed(2);


        // ESTADO FINAL (Último registro del día)
        const estadoFinal = dataInsumoDia[dataInsumoDia.length - 1];
        document.getElementById('mov-fin-porc').textContent = estadoFinal.totalPorcBodega;
        document.getElementById('mov-fin-peso-porc').textContent = estadoFinal.pesoPorcBodega.toFixed(2);
        document.getElementById('mov-fin-sin-porc').textContent = estadoFinal.pesoSinPorcBodega.toFixed(2);
        
        const totalFin = estadoFinal.pesoTotalBodega;
        document.getElementById('mov-fin-total').textContent = totalFin.toFixed(2);

        // EXTRAER STOCK MÍNIMO DEL CATÁLOGO
        let minStock = 0;
        if (AppData.catalogo && AppData.catalogo.length > 0) {
            const catItem = AppData.catalogo.find(item => item.insumo.toLowerCase() === insumo.toLowerCase());
            if (catItem) {
                minStock = catItem.stockMinimo;
            }
        }
        
        document.getElementById('mov-fin-min').textContent = minStock.toFixed(2);

        // LÓGICA DE SEMÁFORO ESTADO DE BODEGA
        const estadoCard = document.getElementById('mov-estado-card');
        const estadoIcon = document.getElementById('mov-estado-icon');
        const estadoText = document.getElementById('mov-estado-text');
        
        // Reset classes
        estadoCard.classList.remove('status-ok', 'status-warning', 'status-danger');
        
        if (totalFin <= 0) {
            estadoCard.classList.add('status-danger');
            estadoIcon.innerHTML = `<i data-lucide="alert-octagon" style="width: 32px; height: 32px;"></i>`;
            estadoText.textContent = "Agotado";
        } else if (totalFin <= minStock) {
            estadoCard.classList.add('status-warning');
            estadoIcon.innerHTML = `<i data-lucide="alert-triangle" style="width: 32px; height: 32px;"></i>`;
            estadoText.textContent = "Próximo a Agotarse";
        } else {
            estadoCard.classList.add('status-ok');
            estadoIcon.innerHTML = `<i data-lucide="check-circle-2" style="width: 32px; height: 32px;"></i>`;
            estadoText.textContent = "Stock OK";
        }

        // ESTADO COCINA (Stock del día actual en Cocina)
        document.getElementById('badge-cocina-fecha').textContent = fecha;
        
        const bodegaHoy = AppData.bodega.filter(b => b.insumo === insumo && b.fecha === fecha);
        const totalEnviadoPorc = bodegaHoy.reduce((sum, b) => sum + (b.porcACocina || 0), 0);
        const totalEnviadoPeso = bodegaHoy.reduce((sum, b) => sum + (b.pesoACocina || 0), 0);
        const totalDevueltoPorc = bodegaHoy.reduce((sum, b) => sum + (b.porcDevueltas || 0), 0);
        const totalDevueltoPeso = bodegaHoy.reduce((sum, b) => sum + (b.pesoDevueltas || 0), 0);

        const recetasInsumo = AppData.recetas.filter(r => r.insumo === insumo);
        const mapaRecetas = {};
        recetasInsumo.forEach(r => {
            mapaRecetas[r.idPlato] = {
                porcPorPlato: r.porcionesPorPlato || 1,
                pesoPorPorcion: r.cantidadPorPorcion || 0
            };
        });

        const ventasHoy = AppData.ventas ? AppData.ventas.filter(v => v.fecha === fecha) : [];
        let totalVendidoPorc = 0;
        let totalVendidoPeso = 0;

        ventasHoy.forEach(v => {
            if (mapaRecetas[v.idPlato]) {
                const porc = v.cantPlatos * mapaRecetas[v.idPlato].porcPorPlato;
                totalVendidoPorc += porc;
                totalVendidoPeso += porc * mapaRecetas[v.idPlato].pesoPorPorcion;
            }
        });

        const stockCocinaPorc = totalEnviadoPorc - totalDevueltoPorc - totalVendidoPorc;
        const stockCocinaPeso = totalEnviadoPeso - totalDevueltoPeso - totalVendidoPeso;

        document.getElementById('mov-cocina-porc').textContent = stockCocinaPorc.toFixed(0);
        document.getElementById('mov-cocina-peso').textContent = stockCocinaPeso.toFixed(2);
        document.getElementById('mov-cocina-vendidas').textContent = totalVendidoPorc.toFixed(0);
        document.getElementById('mov-cocina-peso-vendido').textContent = totalVendidoPeso.toFixed(2);

        this.renderTimeline(dataInsumoDia);
        
        // Ensure new icons are rendered
        if(window.lucide) {
            window.lucide.createIcons();
        }
    },

    renderTimeline: function(data) {
        const tbody = document.querySelector('#movimientos-table tbody');
        tbody.innerHTML = '';

        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            let labelCorte = row.esCorte;
            if (index === 0) labelCorte = "🔴 INICIAL (" + row.esCorte + ")";
            if (index === data.length - 1) labelCorte = "🏁 FINAL (" + row.esCorte + ")";

            let mermaStyle = row.merma < 0 ? 'color: var(--danger); font-weight: bold;' : '';
            let outStyle = row.porcACocina > 0 ? 'color: var(--danger);' : '';
            let inStyle = row.porcDevueltas > 0 ? 'color: var(--success);' : '';

            tr.innerHTML = `
                <td><strong>${labelCorte}</strong></td>
                <td>${row.pesoTotalBodega.toFixed(2)}</td>
                <td>${row.totalPorcBodega}</td>
                <td style="${outStyle}">${row.porcACocina > 0 ? '-' + row.porcACocina : 0}</td>
                <td style="${inStyle}">${row.porcDevueltas > 0 ? '+' + row.porcDevueltas : 0}</td>
                <td style="${mermaStyle}">${row.merma.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};
