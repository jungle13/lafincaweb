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
        'inventario': { title: 'Estado Real del Inventario', subtitle: 'Monitoreo en vivo de existencias en bodega, cocina y valorización en pesos' },
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

    function switchView(target) {
        if (!target) return;

        // Actualizar active classes en sidebar
        navItems.forEach(nav => {
            if (nav.getAttribute('data-target') === target) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });

        // Actualizar active classes en barra móvil inferior
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            if (btn.getAttribute('data-view') === target) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Actualizar secciones de vista
        viewSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === `view-${target}`) {
                section.classList.add('active');
            }
        });

        // Actualizar textos Header
        if (viewMeta[target]) {
            if (viewTitle) viewTitle.textContent = viewMeta[target].title;
            if (viewSubtitle) viewSubtitle.textContent = viewMeta[target].subtitle;
        } else if (target === 'ventas') {
            if (viewTitle) viewTitle.textContent = 'Registro de Ventas';
            if (viewSubtitle) viewSubtitle.textContent = 'KPIs e ingresos por platos vendidos';
        }
        
        // Cerrar menú móvil si está abierto
        if (window.innerWidth <= 768 && sidebar && overlay) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('show');
        }
        
        // Acciones específicas por vista
        if (target === 'dashboard' && AppData.isLoaded) {
            Dashboard.renderTrendChart();
        }

        if (target === 'bodeguero' && typeof BodegueroTerminal !== 'undefined') {
            BodegueroTerminal.loadData();
        }

        if (target === 'inventario' && typeof BodegueroTerminal !== 'undefined') {
            BodegueroTerminal.loadData();
        }

        if (target === 'compras' && typeof Compras !== 'undefined') {
            Compras.loadData();
        }

        // Scroll al tope de la página suavemente
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Eventos en Nav Items Sidebar
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchView(target);
        });
    });

    // Eventos en Botones de Barra Inferior Móvil
    document.querySelectorAll('.mobile-nav-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = btn.getAttribute('data-view');
            switchView(target);
        });
    });

    // Botón de Abrir Menú lateral desde Barra Inferior
    const mobileMenuDrawerBtn = document.getElementById('mobile-btn-menu-drawer');
    if (mobileMenuDrawerBtn && sidebar) {
        mobileMenuDrawerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sidebar.classList.add('mobile-open');
            if (overlay) overlay.classList.add('show');
        });
    }

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
