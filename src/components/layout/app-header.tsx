"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, Briefcase, GraduationCap, PanelBottom, PanelLeft, PanelTop, Search } from "lucide-react";
import { logout, switchWorkspaceAction } from "@/server/actions";
import type { WorkspaceMode } from "@/domain/types";

export type ShellView = "sidebar" | "bottom" | "top";

export type ShellAlert = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export function AppHeader({
  user,
  alerts,
  view,
  onView,
  workspaceMode,
}: {
  user: { name: string; title: string; email: string; company: string };
  alerts: ShellAlert[];
  view: ShellView;
  onView: (view: ShellView) => void;
  workspaceMode: WorkspaceMode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [workspacePending, startWorkspace] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const initial = user.name.trim().charAt(0).toUpperCase() || "M";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setAlertsOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, []);

  function chooseWorkspace(mode: WorkspaceMode) {
    if (mode === workspaceMode || workspacePending) return;
    startWorkspace(async () => {
      await switchWorkspaceAction(mode);
      setMenuOpen(false);
      router.refresh();
    });
  }

  return (
    <header ref={headerRef} className="no-print flex min-w-0 items-center gap-2 bg-[#f4f7fb]/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-6 sm:py-3">
      <Link href="/dashboard" className="shrink-0 lg:hidden" aria-label="NavalSmart">
        <img src="/brand/mark.png" alt="" className="h-8 w-auto" />
      </Link>
      {view === "sidebar" ? null : (
        <Link href="/dashboard" className="hidden shrink-0 lg:block" aria-label="NavalSmart">
          <img src="/brand/mark.png" alt="" className="h-8 w-auto" />
        </Link>
      )}
      <form action="/estimations" className="relative min-w-0 w-full max-w-sm flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-steel" />
        <input
          ref={searchRef}
          name="q"
          placeholder="Projet, offre, navire..."
          className="h-10 w-full rounded-full border border-[#e3e9f0] bg-white pr-3 pl-10 text-base text-navy outline-none placeholder:text-steel/80 focus:border-technical sm:pr-16 sm:text-sm"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line bg-[#f7f9fb] px-1.5 py-0.5 text-[10px] text-steel sm:inline">
          Ctrl K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e3e9f0] bg-white text-navy"
            aria-label="Notifications"
            aria-expanded={alertsOpen}
            onClick={() => {
              setAlertsOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-semibold text-white">
                {alerts.length > 9 ? "9+" : alerts.length}
              </span>
            ) : null}
          </button>
          {alertsOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-[#eef2f6] px-3 py-2">
                <p className="text-sm font-semibold text-navy">Notifications</p>
                <span className="text-xs text-steel">{alerts.length}</span>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {alerts.length ? alerts.map((alert) => (
                  <li key={alert.id} className="border-b border-[#eef2f6] last:border-0">
                    <Link href={alert.href} className="block px-3 py-2 hover:bg-[#f7fafc]" onClick={() => setAlertsOpen(false)}>
                      <span className="block text-sm text-navy">{alert.title}</span>
                      <span className="block text-xs text-steel">{alert.detail}</span>
                    </Link>
                  </li>
                )) : <li className="px-3 py-4 text-sm text-steel">Aucune notification ouverte.</li>}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open);
              setAlertsOpen(false);
            }}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{initial}</span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold text-navy">{user.name}</span>
              <span className="block text-xs text-steel">{user.title}</span>
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-2 max-h-[70dvh] w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-line bg-white p-2 text-sm shadow-lg">
              <div className="px-3 py-2">
                <p className="font-semibold text-navy">{user.name}</p>
                <p className="text-xs text-steel">{user.title}</p>
                <p className="text-xs text-steel">{user.email}</p>
                <p className="mt-1 text-xs text-navy">{user.company}</p>
              </div>
              <p className="px-3 pt-2 text-[11px] font-semibold tracking-wide text-steel uppercase">Espace</p>
              <button type="button" className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-navy hover:bg-[#f4f7fb]" onClick={() => chooseWorkspace("demo")}>
                <GraduationCap className="h-4 w-4" /> Démonstration
                {workspaceMode === "demo" ? <span className="ml-auto text-xs font-semibold text-[#1d6fe0]">Actif</span> : null}
              </button>
              <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-navy hover:bg-[#f4f7fb]" onClick={() => chooseWorkspace("real")}>
                <Briefcase className="h-4 w-4" /> Réel
                {workspaceMode === "real" ? <span className="ml-auto text-xs font-semibold text-[#1d6fe0]">Actif</span> : null}
              </button>
              <p className="hidden px-3 pt-2 text-[11px] font-semibold tracking-wide text-steel uppercase lg:block">Affichage</p>
              <button type="button" className="mt-1 hidden w-full items-center gap-2 rounded-md px-3 py-2 text-left text-navy hover:bg-[#f4f7fb] lg:flex" onClick={() => onView("sidebar")}>
                <PanelLeft className="h-4 w-4" /> Barre latérale
                {view === "sidebar" ? <span className="ml-auto text-xs font-semibold text-[#1d6fe0]">Actif</span> : null}
              </button>
              <button type="button" className="hidden w-full items-center gap-2 rounded-md px-3 py-2 text-left text-navy hover:bg-[#f4f7fb] lg:flex" onClick={() => onView("bottom")}>
                <PanelBottom className="h-4 w-4" /> Barre du bas
                {view === "bottom" ? <span className="ml-auto text-xs font-semibold text-[#1d6fe0]">Actif</span> : null}
              </button>
              <button type="button" className="hidden w-full items-center gap-2 rounded-md px-3 py-2 text-left text-navy hover:bg-[#f4f7fb] lg:flex" onClick={() => onView("top")}>
                <PanelTop className="h-4 w-4" /> Barre du haut
                {view === "top" ? <span className="ml-auto text-xs font-semibold text-[#1d6fe0]">Actif</span> : null}
              </button>
              <div className="my-1 border-t border-[#eef2f6]" />
              <Link href="/parametres?onglet=users" className="block rounded-md px-3 py-2 text-navy hover:bg-[#f4f7fb]" onClick={() => setMenuOpen(false)}>
                Profil
              </Link>
              <Link href="/parametres?onglet=general" className="block rounded-md px-3 py-2 text-navy hover:bg-[#f4f7fb]" onClick={() => setMenuOpen(false)}>
                Paramètres
              </Link>
              <form action={logout}>
                <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-navy hover:bg-[#f4f7fb]">
                  Fermer la session
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
