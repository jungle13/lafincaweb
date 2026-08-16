const Recetas = {
    dishesData: [],
    searchQuery: '',
    categoryFilter: 'ALL',

    init: function() {
        if (!AppData.recetas || AppData.recetas.length === 0) return;
        this.processData();
        this.bindEvents();
        this.renderView();
    },

    processData: function() {
        const dishes = {};
        
        AppData.recetas.forEach(r => {
            if (!dishes[r.idPlato]) {
                dishes[r.idPlato] = {
                    id: r.idPlato,
                    name: r.plato,
                    categories: new Set(),
                    price: r.precioVenta,
                    ingredients: []
                };
            }
            
            if (r.insumo) {
                const cat = r.tipoCarne || 'OTRO';
                dishes[r.idPlato].categories.add(cat);
                dishes[r.idPlato].ingredients.push({
                    name: r.insumo,
                    category: cat,
                    portions: r.porcionesPorPlato,
                    qty: r.cantidadPorPorcion,
                    costKg: r.costoInsumoKg,
                    totalCost: r.cantidadPorPorcion * r.costoInsumoKg
                });
            }
        });

        // Convert to array
        this.dishesData = Object.values(dishes).map(d => ({
            ...d,
            categories: Array.from(d.categories),
            mainCategory: Array.from(d.categories)[0] || 'VARIOS'
        }));

        // Populate Category Filter
        const filterSelect = document.getElementById('recetas-category');
        if (filterSelect) {
            const allCats = new Set();
            this.dishesData.forEach(d => d.categories.forEach(c => allCats.add(c)));
            
            filterSelect.innerHTML = '<option value="ALL">Todas</option>';
            Array.from(allCats).sort().forEach(c => {
                filterSelect.innerHTML += `<option value="${c}">${c}</option>`;
            });
        }
    },

    bindEvents: function() {
        const searchInput = document.getElementById('recetas-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderView();
            });
        }

        const catSelect = document.getElementById('recetas-category');
        if (catSelect) {
            catSelect.addEventListener('change', (e) => {
                this.categoryFilter = e.target.value;
                this.renderView();
            });
        }
    },

    renderView: function() {
        const grid = document.getElementById('recetas-grid');
        if (!grid) return;

        let filtered = this.dishesData;

        if (this.categoryFilter !== 'ALL') {
            filtered = filtered.filter(d => d.categories.includes(this.categoryFilter));
        }

        if (this.searchQuery.trim() !== '') {
            filtered = filtered.filter(d => d.name.toLowerCase().includes(this.searchQuery.trim()) || d.id.toLowerCase().includes(this.searchQuery.trim()));
        }

        grid.innerHTML = '';
        
        if (filtered.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i data-lucide="search-x" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No se encontraron recetas con estos filtros.</p>
            </div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        filtered.forEach(dish => {
            const totalDishCost = dish.ingredients.reduce((acc, curr) => acc + curr.totalCost, 0);
            
            let ingredientsHtml = dish.ingredients.map(ing => `
                <li class="recipe-ingredient-item">
                    <div class="ingredient-name">
                        ${ing.name} <span style="font-size:0.7rem; color: var(--text-muted); font-weight: normal;">(${ing.category})</span>
                    </div>
                    <div class="ingredient-details">
                        <div class="ingredient-qty">${ing.qty.toFixed(3)} Kg <span style="font-size:0.7rem; font-weight:normal; color:var(--text-muted);">(${ing.portions} porc)</span></div>
                        <div class="ingredient-cost">${Dashboard.formatCurrency(ing.totalCost)}</div>
                    </div>
                </li>
            `).join('');

            const card = document.createElement('div');
            card.className = 'recipe-card';
            
            card.innerHTML = `
                <div class="recipe-image-wrapper" style="display: flex; justify-content: center; align-items: center; background-color: var(--bg-surface-solid); height: 180px;">
                    <div class="recipe-category-badge">${dish.mainCategory}</div>
                    <i data-lucide="image" style="width: 48px; height: 48px; color: var(--text-muted); opacity: 0.5;"></i>
                </div>
                <div class="recipe-content">
                    <h3 class="recipe-title">${dish.name}</h3>
                    <div class="recipe-id">${dish.id}</div>
                    
                    <ul class="recipe-ingredients-list">
                        ${ingredientsHtml}
                    </ul>
                    
                    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px dashed var(--border-color); display: flex; justify-content: space-between; align-items: flex-end;">
                        <div>
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin:0;">Costo Carnes</p>
                            <h4 style="color: var(--danger); margin:0; font-size: 1.1rem;">${Dashboard.formatCurrency(totalDishCost)}</h4>
                        </div>
                        <div style="text-align: right;">
                            <p style="font-size: 0.75rem; color: var(--text-muted); margin:0;">Precio Venta</p>
                            <h4 style="color: var(--success); margin:0; font-size: 1.25rem;">${Dashboard.formatCurrency(dish.price)}</h4>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
};
