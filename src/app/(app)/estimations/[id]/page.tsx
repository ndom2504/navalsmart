import { notFound } from "next/navigation";
import { EstimateWorkspace } from "@/components/estimation/workspace";
import { readDatabase } from "@/server/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = await readDatabase();
  const project = database.projects.find((item) => item.id === id);
  return { title: project?.name ?? "Estimation" };
}

export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const database = await readDatabase();
  const project = database.projects.find((item) => item.id === id);
  if (!project) notFound();

  return (
    <EstimateWorkspace
      key={project.updatedAt}
      project={project}
      suppliers={database.suppliers}
      weights={database.settings.completenessWeights}
      section={query.section ?? "overview"}
    />
  );
}
