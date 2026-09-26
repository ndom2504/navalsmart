"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function TopBar() {
  const pathname = usePathname();

  return (
    <nav className="border-y border-[#e3e9f0] bg-white">
      <ul className="flex gap-1 overflow-x-auto px-3 sm:px-5">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm",
                  active ? "border-[#1d6fe0] font-semibold text-[#1d4e89]" : "border-transparent text-steel hover:text-navy",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
