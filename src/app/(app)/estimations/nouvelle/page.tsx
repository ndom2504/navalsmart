import Link from "next/link";
import { NewEstimateForm } from "@/components/estimation/new-estimate-form";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Nouvelle estimation" };

export default async function NewEstimatePage() {
  const database = await readDatabase();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Nouvelle estimation</h1>
        <p className="mt-1 text-sm text-steel">Décrivez le dossier, puis importez l&apos;appel d&apos;offres.</p>
      </div>
      <Link href="/estimations/importer" className="flex items-center justify-between gap-3 rounded-xl border border-[#cfe0f5] bg-[#f3f8fe] px-4 py-3 text-sm text-[#1d4e89]">
        <span><strong>Vous avez l&apos;appel d&apos;offres ?</strong> Déposez-le : le projet, ses lots, ses jalons et ses ordres de travail sont créés automatiquement.</span>
        <span className="shrink-0 font-semibold">Importer →</span>
      </Link>
      <NewEstimateForm learningDefault={database.settings.defaultLearningMode} />
    </div>
  );
}
