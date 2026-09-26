"use client";

import { useState } from "react";
import type { WorkspaceMode } from "@/domain/types";
import { AppHeader, type ShellAlert, type ShellView } from "@/components/layout/app-header";
import { BottomBar } from "@/components/layout/bottom-bar";
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

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      {view === "sidebar" ? <Sidebar /> : null}
      <div className={view === "sidebar" ? "print-reset lg:pl-[248px]" : "print-reset"}>
        <div className="no-print sticky top-0 z-20">
          <AppHeader user={user} alerts={alerts} view={view} onView={changeView} workspaceMode={workspaceMode} />
          {view === "top" ? <TopBar /> : null}
        </div>
        <p className="no-print border-b border-[#e3e9f0] bg-white px-4 py-2 text-sm text-navy sm:px-6">
          {workspaceMode === "demo"
            ? "Mode démonstration. Les dossiers et les montants sont simulés pour comprendre l'application."
            : "Mode réel. Les dossiers simulés sont masqués. Cet espace démarre sans estimation, sans fournisseur et sans montant."}
        </p>
        <main className={view === "bottom" ? "px-4 pt-4 pb-24 sm:px-6" : "px-4 pt-4 pb-8 sm:px-6"}>{children}</main>
      </div>
      {view === "bottom" ? <BottomBar /> : null}
    </div>
  );
}
