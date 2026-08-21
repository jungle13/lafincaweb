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
        'bodeguero': { title: 'Terminal del Bodeguero', subtitle: 'Control operativo de carnes y movimientos en tiempo real' },
        'dashboard': { title: 'Dashboard General', subtitle: 'Resumen ejecutivo del restaurante' },
        'movimientos': { title: 'Movimientos de Inventario', subtitle: 'Trazabilidad y estados diarios por insumo' },
        'bodega-linea': { title: 'Bodega Línea Temporal', subtitle: 'Tabla original de movimientos de conteo bodega' },
        'compras': { title: 'Registro de Compras', subtitle: 'Ingresos y costos de materia prima' },
        'recetas': { title: 'Recetario y Menú', subtitle: 'Desglose de insumos cárnicos por plato' }
    };

    // Establecer textos iniciales
    if (viewTitle && viewSubtitle) {
        viewTitle.textContent = viewMeta['bodeguero'].title;
        viewSubtitle.textContent = viewMeta['bodeguero'].subtitle;
    }

    // Inicializar Supabase, Terminal del Bodeguero y Compras
    if (typeof SupabaseConfig !== 'undefined') {
        SupabaseConfig.init();
    }
    if (typeof BodegueroTerminal !== 'undefined') {
        BodegueroTerminal.init();
    }
    if (typeof Compras !== 'undefined') {
        Compras.init();
    }

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

            if (target === 'bodeguero' && typeof BodegueroTerminal !== 'undefined') {
                BodegueroTerminal.loadData();
            }

            if (target === 'compras' && typeof Compras !== 'undefined') {
                Compras.loadData();
            }
        });
    });

    // Botón de Sincronización Manual de Base de Datos
    const btnSyncDb = document.getElementById('btn-sync-db');
    if (btnSyncDb) {
        btnSyncDb.addEventListener('click', async () => {
            btnSyncDb.disabled = true;
            btnSyncDb.innerHTML = `<i data-lucide="refresh-cw" class="spin"></i><span>Sincronizando...</span>`;
            lucide.createIcons();

            try {
                if (typeof BodegueroTerminal !== 'undefined') {
                    await BodegueroTerminal.loadData();
                }
                if (typeof SupabaseConfig !== 'undefined') {
                    await SupabaseConfig.testConnection();
                }
            } catch (e) {
                console.error("Error sincronizando base de datos:", e);
            } finally {
                btnSyncDb.disabled = false;
                btnSyncDb.innerHTML = `<i data-lucide="refresh-cw"></i><span>Sincronizar Datos</span>`;
                lucide.createIcons();
            }
        });
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
