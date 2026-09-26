"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-[#e3e9f0] bg-white/95 backdrop-blur">
      <ul className="flex gap-1 overflow-x-auto px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px]",
                  active ? "bg-[#e8f1fb] font-semibold text-[#1d4e89]" : "text-steel hover:bg-[#f4f7fb]",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
