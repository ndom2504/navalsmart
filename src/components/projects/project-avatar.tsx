import type { Project } from "@/domain/types";

export function projectAvatarUrl(project: Pick<Project, "id" | "avatar">): string | null {
  return project.avatar ? `/api/estimates/${project.id}/avatar?v=${encodeURIComponent(project.avatar.updatedAt)}` : null;
}

const sizes = {
  sm: "h-9 w-9 rounded-lg text-xs",
  md: "h-12 w-12 rounded-xl text-sm",
  lg: "h-20 w-20 rounded-2xl text-xl",
} as const;

const palette = ["bg-[#e8f1fb] text-[#1d4e89]", "bg-emerald-50 text-emerald-700", "bg-[#fff1e8] text-[#c2410c]", "bg-[#eef0ff] text-[#4338ca]", "bg-[#e6f6f8] text-[#0e7490]"];

function initials(name: string): string {
  return name
    .split(/[\s–—-]+/)
    .filter((part) => /^[\p{L}\d]/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function ProjectAvatar({ name, src, size = "sm", className = "" }: { name: string; src: string | null; size?: keyof typeof sizes; className?: string }) {
  if (src) return <img src={src} alt={`Image du projet ${name}`} className={`${sizes[size]} shrink-0 object-cover ${className}`} />;
  const tone = palette[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
  return (
    <span aria-hidden className={`${sizes[size]} ${tone} flex shrink-0 items-center justify-center font-semibold ${className}`}>
      {initials(name) || "P"}
    </span>
  );
}
