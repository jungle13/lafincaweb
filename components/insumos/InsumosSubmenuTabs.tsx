'use client';

import { 
  Beef, 
  Beer, 
  Package, 
  Users, 
  Zap, 
  Building2, 
  UtensilsCrossed, 
  Wrench, 
  Layers,
  BookOpen 
} from 'lucide-react';

export type SubmoduloType = 
  | 'ALL'
  | 'LIBROS_EGRESOS'
  | 'CARNES'
  | 'BEBIDAS'
  | 'DESECHABLES'
  | 'NOMINA'
  | 'SERVICIOS_PUBLICOS'
  | 'ARRENDAMIENTO'
  | 'COCINA_VERDURAS_GRANO'
  | 'SERVICIOS_GENERALES';

interface SubmenuTab {
  id: SubmoduloType;
  label: string;
  shortLabel: string;
  icon: any;
  colorClass: string;
  activeClass: string;
}

const SUBMODULOS: SubmenuTab[] = [
  {
    id: 'ALL',
    label: 'Todos los Egresos',
    shortLabel: 'Todos',
    icon: Layers,
    colorClass: 'text-slate-600',
    activeClass: 'bg-slate-900 text-white border-slate-900 shadow-sm',
  },
  {
    id: 'LIBROS_EGRESOS',
    label: 'Libros de Egresos (Caja / Arturo)',
    shortLabel: 'Libros Egresos',
    icon: BookOpen,
    colorClass: 'text-violet-600',
    activeClass: 'bg-violet-600 text-white border-violet-600 shadow-sm',
  },
  {
    id: 'CARNES',
    label: 'Costeo de Carnes',
    shortLabel: 'Carnes',
    icon: Beef,
    colorClass: 'text-red-600',
    activeClass: 'bg-red-600 text-white border-red-600 shadow-sm',
  },
  {
    id: 'BEBIDAS',
    label: 'Costeo de Bebidas',
    shortLabel: 'Bebidas',
    icon: Beer,
    colorClass: 'text-amber-600',
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm',
  },
  {
    id: 'DESECHABLES',
    label: 'Costeo de Desechables',
    shortLabel: 'Desechables',
    icon: Package,
    colorClass: 'text-blue-600',
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm',
  },
  {
    id: 'NOMINA',
    label: 'Costeo de Nómina y Turnos',
    shortLabel: 'Nómina',
    icon: Users,
    colorClass: 'text-purple-600',
    activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm',
  },
  {
    id: 'SERVICIOS_PUBLICOS',
    label: 'Servicios Públicos',
    shortLabel: 'Servicios Públicos',
    icon: Zap,
    colorClass: 'text-yellow-600',
    activeClass: 'bg-yellow-600 text-white border-yellow-600 shadow-sm',
  },
  {
    id: 'ARRENDAMIENTO',
    label: 'Arrendamiento',
    shortLabel: 'Arriendo',
    icon: Building2,
    colorClass: 'text-indigo-600',
    activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm',
  },
  {
    id: 'COCINA_VERDURAS_GRANO',
    label: 'Verduras y Granos (Cocina)',
    shortLabel: 'Verduras/Granos',
    icon: UtensilsCrossed,
    colorClass: 'text-emerald-600',
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
  },
  {
    id: 'SERVICIOS_GENERALES',
    label: 'Servicios Generales / Otros',
    shortLabel: 'Serv. Generales',
    icon: Wrench,
    colorClass: 'text-orange-600',
    activeClass: 'bg-orange-600 text-white border-orange-600 shadow-sm',
  },
];

interface Props {
  activeTab: SubmoduloType;
  onTabChange: (tab: SubmoduloType) => void;
  counts?: Partial<Record<SubmoduloType, number>>;
}

export default function InsumosSubmenuTabs({ activeTab, onTabChange, counts = {} }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-1 touch-pan-x">
      {SUBMODULOS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const count = counts[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap cursor-pointer ${
              isActive
                ? tab.activeClass
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.colorClass}`} />
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
