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
      <NewEstimateForm learningDefault={database.settings.defaultLearningMode} />
    </div>
  );
}
