import Link from "next/link";

const className = "relative z-10 inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold text-[#1d6fe0] hover:bg-[#e8f1fb]";

export function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </Link>
  );
}

export function ActionAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </a>
  );
}
