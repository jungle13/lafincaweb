'use client';

interface Props {
  selectedCat: string;
  onSelectCat: (cat: string) => void;
}

const CATEGORIES = [
  { id: 'ALL', label: 'Todos los Insumos' },
  { id: 'CARNES', label: '🥩 Solo Carnes' },
  { id: 'CARNE DE RES', label: 'Res' },
  { id: 'CARNE DE CERDO', label: 'Cerdo' },
  { id: 'CARNE POLLO', label: 'Pollo' },
  { id: 'PESCADOS', label: 'Pescados' },
];

export default function CategoryFilterChips({ selectedCat, onSelectCat }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
      {CATEGORIES.map((cat) => {
        const isActive = selectedCat === cat.id;

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCat(cat.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              isActive
                ? 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
