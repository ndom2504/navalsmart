"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";

const steps = [
  "Lecture du document",
  "Extraction des informations du projet",
  "Lots, quantités et exigences",
  "Risques et informations manquantes",
  "Jalons et ordres de travail",
];

interface Result {
  id: string;
  name: string;
  workPackages: number;
  workOrders: number;
  milestones: number;
  engine: "LOCAL" | "OPENAI" | null;
}

export function TenderImport() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function choose(next: File | undefined) {
    if (!next) return;
    setError(null);
    setResult(null);
    if (!/\.(pdf|docx|xlsx|txt)$/i.test(next.name)) {
      setError("Format accepté : PDF, DOCX, XLSX ou TXT.");
      return;
    }
    setFile(next);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStep(0);
    const timer = window.setInterval(() => setStep((value) => Math.min(value + 1, steps.length - 1)), 900);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/tenders/import", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      if (!response.ok || !payload.id) {
        setError(payload.error ?? "Import impossible.");
        return;
      }
      setStep(steps.length);
      setResult(payload as Result);
      router.refresh();
    } catch {
      setError("Import impossible. Vérifiez la connexion.");
    } finally {
      window.clearInterval(timer);
      setBusy(false);
    }
  }

  if (result) {
    return (
      <section className="space-y-4 rounded-2xl border border-[#e6edf4] bg-white p-6 shadow-sm">
        <p className="flex items-center gap-2 text-lg font-semibold text-navy"><Check className="h-5 w-5 text-success" /> Estimation créée</p>
        <p className="text-sm text-navy">{result.name}</p>
        <ul className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["Lots de travaux", result.workPackages],
            ["Ordres de travail", result.workOrders],
            ["Jalons", result.milestones],
          ].map(([label, value]) => (
            <li key={label} className="rounded-xl border border-[#e6edf4] p-3">
              <p className="text-xs text-steel">{label}</p>
              <p className="text-xl font-semibold text-navy">{value}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-steel">
          Seuls les champs présents dans le document ont été remplis ; les autres restent vides. Les dates des ordres de travail sont proposées et restent à valider.
          {result.engine === "LOCAL" ? " Analyse effectuée par l'extraction locale." : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/estimations/${result.id}`}>Ouvrir l&apos;estimation</Link></Button>
          <Button variant="secondary" asChild><Link href={`/estimations/${result.id}?section=planning`}>Voir le planning</Link></Button>
          <Button variant="secondary" onClick={() => { setResult(null); setFile(null); }}>Importer un autre document</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#e6edf4] bg-white p-6 shadow-sm">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${dragging ? "border-[#1d6fe0] bg-[#f3f8fe]" : "border-line hover:bg-background"}`}
      >
        <FileUp className="h-8 w-8 text-[#1d6fe0]" />
        <span className="text-sm font-medium text-navy">{file ? file.name : "Déposez l'appel d'offres ici ou cliquez pour choisir"}</span>
        <span className="text-xs text-steel">{file ? formatBytes(file.size) : "PDF, DOCX, XLSX ou TXT · 20 Mo maximum"}</span>
      </button>
      <input ref={input} className="hidden" type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={(event) => choose(event.target.files?.[0])} />

      {busy ? (
        <ol className="space-y-1.5 text-sm">
          {steps.map((label, index) => (
            <li key={label} className={`flex items-center gap-2 ${index <= step ? "text-navy" : "text-steel"}`}>
              {index < step ? <Check className="h-4 w-4 text-success" /> : index === step ? <Loader2 className="h-4 w-4 animate-spin text-[#1d6fe0]" /> : <span className="h-4 w-4" />}
              {label}
            </li>
          ))}
        </ol>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!file || busy} onClick={submit}>{busy ? "Analyse en cours…" : "Créer l'estimation"}</Button>
        <p className="text-xs text-steel">Le nom, le client, le navire, le lieu, la date limite, la devise, les lots, les risques, les jalons et les ordres de travail sont repris du document quand il les contient.</p>
      </div>
    </section>
  );
}
