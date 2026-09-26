"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Sparkles, X } from "lucide-react";
import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#071426] text-white">
      <img src="/brand/sidebar-shipyard.jpg" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full object-cover object-center" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#071426_0%,#071426_46%,rgba(7,20,38,0.72)_68%,rgba(7,20,38,0.35)_100%)]" />

      <div className="relative flex items-center gap-3 px-5 py-5">
        <img src="/brand/mark.png" alt="" className="h-11 w-auto" />
        <div>
          <p className="text-sm font-semibold tracking-[0.12em]">NAVALSMART</p>
          <p className="text-[10px] tracking-[0.14em] text-white/55">AI-POWERED NAVAL ESTIMATION</p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                active ? "bg-[#1d6fe0] text-white shadow-sm" : "text-white/75 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link href="/estimations/nouvelle" onClick={() => setOpen(false)} className="relative mx-3 mb-4 mt-3 flex items-start gap-3 rounded-xl border border-white/15 bg-[#0c2344]/80 p-3 backdrop-blur-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1d6fe0]/30 text-[#7ec8ff]">
          <Sparkles className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold">IA au service de vos estimations</span>
          <span className="mt-1 block text-xs leading-5 text-white/70">Analysez, structurez, calculez, décidez.</span>
        </span>
      </Link>
    </div>
  );

  return (
    <>
      <div className="no-print sticky top-0 z-30 flex items-center justify-between bg-[#071426] px-4 py-3 text-white lg:hidden">
        <p className="text-sm font-semibold tracking-[0.12em]">NAVALSMART</p>
        <button type="button" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[248px] lg:block">{nav}</aside>
      {open ? (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-navy/50" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72">
            <button className="absolute top-4 right-3 z-10" type="button" aria-label="Fermer" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
