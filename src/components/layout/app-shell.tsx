"use client";

import { useState } from "react";
import type { WorkspaceMode } from "@/domain/types";
import { AppHeader, type ShellAlert, type ShellView } from "@/components/layout/app-header";
import { BottomBar } from "@/components/layout/bottom-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export function AppShell({
  children,
  user,
  alerts,
  initialView,
  workspaceMode,
}: {
  children: React.ReactNode;
  user: { name: string; title: string; email: string; company: string };
  alerts: ShellAlert[];
  initialView: ShellView;
  workspaceMode: WorkspaceMode;
}) {
  const [view, setView] = useState<ShellView>(initialView);

  function changeView(next: ShellView) {
    setView(next);
    document.cookie = `navalsmart-view=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  const desktopBottom = view === "bottom";

  return (
    <div className="min-h-dvh bg-[#f4f7fb]">
      <div className="hidden lg:contents">{view === "sidebar" ? <Sidebar /> : null}</div>
      <div className={view === "sidebar" ? "print-reset lg:pl-[248px]" : "print-reset"}>
        <div className="no-print sticky top-0 z-20 bg-[#f4f7fb] pt-[env(safe-area-inset-top)]">
          <AppHeader user={user} alerts={alerts} view={view} onView={changeView} workspaceMode={workspaceMode} />
          {view === "top" ? <div className="hidden lg:block"><TopBar /></div> : null}
        </div>
        <p className="no-print border-b border-[#e3e9f0] bg-white px-3 py-2 text-xs text-navy sm:px-6 sm:text-sm">
          {workspaceMode === "demo"
            ? "Mode démonstration. Les dossiers et les montants sont simulés pour comprendre l'application."
            : "Mode réel. Les dossiers simulés sont masqués. Cet espace démarre sans estimation, sans fournisseur et sans montant."}
        </p>
        <main className={`px-3 pt-4 sm:px-6 ${desktopBottom ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-24" : "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8"}`}>{children}</main>
      </div>
      <MobileNav />
      {desktopBottom ? <div className="hidden lg:block"><BottomBar /></div> : null}
    </div>
  );
}
