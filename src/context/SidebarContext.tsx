'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleSidebar: () => void;
  setCollapsed: (v: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  mobileOpen: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    // En desktop colapsa el sidebar, en mobile abre/cierra el drawer
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileOpen((prev) => !prev);
    } else {
      setCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  const openMobile = () => setMobileOpen(true);
  const closeMobile = () => setMobileOpen(false);
  const toggleMobile = () => setMobileOpen((prev) => !prev);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        mobileOpen,
        toggleSidebar,
        setCollapsed,
        openMobile,
        closeMobile,
        toggleMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
