const AppData = {
    rawExcel: null,
    bodega: [],
    bodegaRaw: [],
    compras: [],
    ventas: [],
    recetas: [],
    catalogo: [],
    isLoaded: false
};

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Iconos
    lucide.createIcons();

    // Toggle Sidebar Responsivo
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if(sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('mobile-open');
                if (overlay) overlay.classList.toggle('show');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });
    }

    if(overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('show');
        });
    }

    // Rendimiento Popover Logic
    const btnHelpRendimiento = document.getElementById('btn-help-rendimiento');
    const popoverRendimiento = document.getElementById('popover-rendimiento');
    if (btnHelpRendimiento && popoverRendimiento) {
        btnHelpRendimiento.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevenir sort
            popoverRendimiento.style.display = popoverRendimiento.style.display === 'none' ? 'block' : 'none';
        });
        
        // Evitar que clic dentro del popover dispare el sort de la columna
        popoverRendimiento.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', (e) => {
            if (!popoverRendimiento.contains(e.target) && !btnHelpRendimiento.contains(e.target)) {
                popoverRendimiento.style.display = 'none';
            }
        });
    }

    // Navegación del Sidebar
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item:not(.disabled)');
    const viewSections = document.querySelectorAll('.view-section');
    const viewTitle = document.getElementById('current-view-title');
    const viewSubtitle = document.getElementById('current-view-subtitle');

    const viewMeta = {
        'dashboard': { title: 'Dashboard General', subtitle: 'Resumen ejecutivo del restaurante' },
        'movimientos': { title: 'Movimientos de Inventario', subtitle: 'Trazabilidad y estados diarios por insumo' },
        'bodega-linea': { title: 'Bodega Línea Temporal', subtitle: 'Tabla original de movimientos de conteo bodega' },
        'compras': { title: 'Registro de Compras', subtitle: 'Ingresos y costos de materia prima' },
        'recetas': { title: 'Recetario y Menú', subtitle: 'Desglose de insumos cárnicos por plato' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Actualizar active classes nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Actualizar vistas
            const target = item.getAttribute('data-target');
            viewSections.forEach(section => {
                section.classList.remove('active');
                if(section.id === `view-${target}`) {
                    section.classList.add('active');
                }
            });

            // Actualizar textos Header
            if (viewMeta[target]) {
                viewTitle.textContent = viewMeta[target].title;
                viewSubtitle.textContent = viewMeta[target].subtitle;
            } else if (target === 'ventas') {
                viewTitle.textContent = 'Registro de Ventas';
                viewSubtitle.textContent = 'KPIs e ingresos por platos vendidos';
            }
            
            // Cerrar menú móvil si está abierto
            if (window.innerWidth <= 768 && sidebar && overlay) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('show');
            }
            
            // Re-render chart if navigating back to dashboard to fix canvas resize issues
            if (target === 'dashboard' && AppData.isLoaded) {
                Dashboard.renderTrendChart();
            }
        });
    });

    // Manejo Carga Archivo
    const uploadInput = document.getElementById('excel-upload');
    const uploadBtn = document.getElementById('btn-upload');
    
    // Drag & Drop
    const body = document.body;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        body.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        body.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        body.style.opacity = '0.8';
    }

    function unhighlight(e) {
        body.style.opacity = '1';
    }

    body.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    }

    uploadInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if(files.length === 0) return;
        const file = files[0];
        
        if(!file.name.includes('.xls')) {
            alert('Por favor, selecciona un archivo Excel (.xlsx o .xls)');
            return;
        }

        processExcelFile(file);
    }

    function processExcelFile(file) {
        const loading = document.getElementById('loading-overlay');
        loading.classList.remove('hidden');

        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array', cellDates: true, cellNF: false, cellText:false});
                
                // Extraer Data
                AppData.bodega = ExcelParser.parseBodega(workbook);
                AppData.bodegaRaw = ExcelParser.parseBodegaRaw(workbook);
                AppData.compras = ExcelParser.parseCompras(workbook);
                AppData.ventas = ExcelParser.parseVentas(workbook);
                AppData.recetas = ExcelParser.parseRecetas(workbook);
                AppData.catalogo = ExcelParser.parseCatalogo(workbook);
                
                AppData.isLoaded = true;
                
                // UI Updates
                document.getElementById('data-status').innerHTML = `
                    <div class="status-indicator green"></div>
                    <span>Datos cargados: ${file.name}</span>
                `;
                
                document.getElementById('dashboard-empty').classList.add('hidden');
                document.getElementById('dashboard-data').classList.remove('hidden');
                document.getElementById('movimientos-empty').classList.add('hidden');
                document.getElementById('movimientos-data').classList.remove('hidden');

                // Inicializar Vistas
                Dashboard.init();
                if (typeof Movimientos !== 'undefined') Movimientos.init();
                if (typeof Compras !== 'undefined') Compras.init();
                if (typeof Ventas !== 'undefined') Ventas.init();
                if (typeof Recetas !== 'undefined') Recetas.init();
                if (typeof BodegaLinea !== 'undefined') BodegaLinea.init();
                
            } catch (error) {
                console.error(error);
                alert('Error técnico detectado:\n' + error.message + '\n\nStack:\n' + error.stack);
            } finally {
                loading.classList.add('hidden');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    // Cerrar tooltips al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.kpi-info-btn') && !e.target.closest('.kpi-tooltip')) {
            document.querySelectorAll('.kpi-tooltip.show').forEach(tooltip => {
                tooltip.classList.remove('show');
            });
        }
    });
});
