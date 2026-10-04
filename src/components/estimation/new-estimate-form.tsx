"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createEstimateAction } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { PROJECT_CURRENCIES } from "@/domain/market";
import { projectTypeLabels } from "@/lib/labels";
import type { ProjectType } from "@/domain/types";

const field = "h-11 w-full rounded-md border border-line bg-white px-3 text-sm";

export function NewEstimateForm({ learningDefault }: { learningDefault: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = (name: string) => {
      const value = String(form.get(name) ?? "");
      return value || null;
    };
    start(async () => {
      const result = await createEstimateAction({
        name: String(form.get("name") ?? ""),
        client: String(form.get("client") ?? ""),
        vessel: String(form.get("vessel") ?? ""),
        type: String(form.get("type") ?? "REPAIR") as ProjectType,
        location: String(form.get("location") ?? ""),
        receivedAt: date("receivedAt"),
        submissionDeadline: date("submissionDeadline"),
        plannedStart: date("plannedStart"),
        plannedEnd: date("plannedEnd"),
        currency: String(form.get("currency") ?? "CAD"),
        description: String(form.get("description") ?? ""),
        learningMode: form.get("learningMode") === "on",
      });
      if ("error" in result && result.error) setError(result.error);
      else if ("id" in result) router.push(`/estimations/${result.id}?section=document`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-lg border border-line bg-card p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan">Étape 1</p>
        <h2 className="mt-1 text-xl font-semibold text-navy">Informations générales</h2>
      </div>
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom du projet" name="name" required />
        <Field label="Client" name="client" required />
        <Field label="Nom du navire" name="vessel" required />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Type de projet</span>
          <select name="type" className={field} defaultValue="REPAIR">
            {Object.entries(projectTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Field label="Lieu" name="location" />
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Devise</span>
          <select name="currency" className={field} defaultValue="CAD">
            {PROJECT_CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
        <Field label="Date de réception" name="receivedAt" type="date" />
        <Field label="Date limite de soumission" name="submissionDeadline" type="date" />
        <Field label="Date prévue de début" name="plannedStart" type="date" />
        <Field label="Date prévue de fin" name="plannedEnd" type="date" />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <textarea name="description" className="min-h-28 w-full rounded-md border border-line px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="learningMode" defaultChecked={learningDefault} />
        Mode apprentissage
      </label>
      <Button disabled={pending} type="submit">{pending ? "Création…" : "Continuer vers l'import"}</Button>
    </form>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input name={name} type={type} required={required} className={field} />
    </label>
  );
}
