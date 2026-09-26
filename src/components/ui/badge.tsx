import { cn } from "@/lib/utils";

const tones = {
  navy: "bg-navy/8 text-navy",
  technical: "bg-technical/10 text-technical",
  cyan: "bg-cyan/10 text-cyan",
  success: "bg-emerald-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
  steel: "bg-background text-steel",
};

export function Badge({
  children,
  tone = "steel",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}
