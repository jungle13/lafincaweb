'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  Truck, 
  Boxes, 
  LayoutDashboard, 
  ShoppingCart, 
  DollarSign, 
  Beef, 
  CalendarRange, 
  Wrench,
  X
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';

const NAV_ITEMS = [
  { label: 'Terminal Bodeguero', href: '/bodeguero', icon: Truck },
  { label: 'Inventario de Carnes', href: '/inventario', icon: Boxes },
  { label: 'Ajustes e Inconsistencias', href: '/ajustes', icon: Wrench },
  { label: 'Catálogo de Carnes', href: '/catalogo', icon: Beef },
  { label: 'Control de Periodos', href: '/periodos', icon: CalendarRange },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Ventas', href: '/ventas', icon: DollarSign },
];

export default function MobileDrawer() {
  const pathname = usePathname();
  const { collapsed, toggleSidebar } = useSidebar();

  // En móvil, si "collapsed" es false significa que el drawer está abierto (o viceversa según el estado inicial).
  // Para garantizar un control claro: si isOpenMobile es true, mostramos el overlay
  // Usamos el estado collapsed: cuando el usuario presiona el menú en TopHeader, toggleSidebar cambia collapsed.
  // En pantallas móviles, si 'mobileOpen' estuviese separado sería ideal, pero podemos manejarlo con una clase responsive.
  
  if (!collapsed) return null; // Por defecto en desktop se oculta con md:hidden

  return null;
}
