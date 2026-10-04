"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { ProjectAvatar } from "@/components/projects/project-avatar";

const ACCEPT = "image/png,image/jpeg,image/webp";

/** Import, remplacement et retrait de l'image du projet. `compact` : la vignette seule, cliquable. */
export function ProjectAvatarEditor({ projectId, name, src, compact = false, size = compact ? "md" : "lg" }: {
  projectId: string;
  name: string;
  src: string | null;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send(request: () => Promise<Response>) {
    setError(null);
    start(async () => {
      const response = await request().catch(() => null);
      if (!response?.ok) {
        const body = await response?.json().catch(() => null);
        setError(body?.error ?? "Import impossible.");
        return;
      }
      router.refresh();
    });
  }

  function upload(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("L'image doit peser au plus 10 Mo.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    send(() => fetch(`/api/estimates/${projectId}/avatar`, { method: "POST", body: form }));
  }

  const input = <input className="hidden" type="file" accept={ACCEPT} disabled={pending} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />;

  if (compact) {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <label className={`group relative cursor-pointer ${pending ? "opacity-60" : ""}`} title={src ? "Changer l'image du projet" : "Importer une image du projet"}>
          <ProjectAvatar name={name} src={src} size={size} className="ring-2 ring-white/70" />
          <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#1d6fe0] text-white shadow ring-2 ring-white">
            <Camera className="h-3.5 w-3.5" />
          </span>
          <span className="sr-only">{src ? "Changer l'image du projet" : "Importer une image du projet"}</span>
          {input}
        </label>
        {error ? <span className="max-w-40 text-xs text-danger">{error}</span> : null}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <ProjectAvatar name={name} src={src} size={size} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-navy hover:bg-background ${pending ? "opacity-60" : ""}`}>
            <ImagePlus className="h-4 w-4" /> {src ? "Changer l'image" : "Importer une image"}
            {input}
          </label>
          {src ? (
            <button type="button" disabled={pending} onClick={() => send(() => fetch(`/api/estimates/${projectId}/avatar`, { method: "DELETE" }))} className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-steel hover:text-danger">
              <Trash2 className="h-4 w-4" /> Retirer
            </button>
          ) : null}
        </div>
        <p className="text-xs text-steel">PNG, JPEG ou WebP, 10 Mo au plus. Affichée sur les cartes et les listes de projets.</p>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
