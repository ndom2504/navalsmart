"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const primaryHrefs = ["/dashboard", "/estimations", "/appels-offres", "/couts"];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = navItems.filter((item) => primaryHrefs.includes(item.href));
  const moreItems = navItems.filter((item) => !primaryHrefs.includes(item.href));
  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <div className="no-print lg:hidden">
      {moreOpen ? (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 z-0 bg-[#071426]/45" aria-label="Fermer le menu" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 rounded-t-2xl border border-[#e3e9f0] bg-white p-3 shadow-xl">
            <p className="px-2 pb-2 text-[11px] font-semibold tracking-wide text-steel uppercase">Plus</p>
            <ul className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm",
                        active ? "bg-[#e8f1fb] font-semibold text-[#1d4e89]" : "text-navy",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e3e9f0] bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px]",
                    active ? "font-semibold text-[#1d4e89]" : "text-steel",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px]",
                moreOpen || moreActive ? "font-semibold text-[#1d4e89]" : "text-steel",
              )}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal className="h-5 w-5" />
              Plus
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
