"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProjectAction } from "@/server/actions";
import { Modal } from "@/components/ui/modal";

/** Bouton « Supprimer l'estimation » avec confirmation. `redirectTo` : page affichée après la suppression. */
export function DeleteProjectButton({ projectId, name, redirectTo, className, label = "Supprimer l'estimation" }: {
  projectId: string;
  name: string;
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const result = await deleteProjectAction(projectId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "inline-flex items-center gap-2 text-sm font-medium text-danger hover:underline"}>
        <Trash2 className="h-4 w-4" /> {label}
      </button>
      <Modal open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }} title="Supprimer l'estimation">
        <div className="space-y-4 text-sm">
          <p className="text-navy">
            Vous allez supprimer <strong>{name}</strong>.
          </p>
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-3 leading-6 text-danger">
            Suppression définitive : lots, lignes chiffrées, planning, ordres de travail, risques, historique, documents d&apos;appel d&apos;offres importés et image du projet.
          </p>
          {error ? <p className="text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-md border border-line px-4 font-medium text-navy">
              Annuler
            </button>
            <button type="button" disabled={pending} onClick={confirm} className="inline-flex h-10 items-center gap-2 rounded-md bg-danger px-4 font-semibold text-white disabled:opacity-60">
              <Trash2 className="h-4 w-4" /> {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
