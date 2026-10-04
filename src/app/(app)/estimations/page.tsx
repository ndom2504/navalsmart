import Link from "next/link";
import { ProjectTable } from "@/components/projects/project-table";
import { Button } from "@/components/ui/button";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Estimations" };

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const database = await readDatabase();
  const projects = [...database.projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter((project) => {
      if (!query) return true;
      const haystack = [project.name, project.client, project.vessel, project.tender?.title, ...(project.tender?.documents ?? []).map((document) => document.fileName)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Estimations</h1>
          <p className="mt-1 text-sm text-steel">Dossiers en cours, à valider et déjà figés.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild><Link href="/estimations/nouvelle">+ Estimation vide</Link></Button>
          <Button asChild><Link href="/estimations/importer">Nouvelle estimation depuis un appel d&apos;offres</Link></Button>
        </div>
      </div>
      <section className="rounded-lg border border-line bg-card p-4">
        {projects.length ? <ProjectTable projects={projects} /> : <p className="text-sm text-steel">{query ? `Aucun dossier ne correspond à « ${q} ».` : "Aucune estimation. Créez le premier dossier."}</p>}
      </section>
    </div>
  );
}
