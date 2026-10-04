import { notFound } from "next/navigation";
import { EstimateWorkspace } from "@/components/estimation/workspace";
import { detectMarketRegion, marketRegion, projectMarketRegion } from "@/domain/market";
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

  const detected = marketRegion(detectMarketRegion(project.location, project.currency) ?? database.settings.market.defaultRegion);
  const active = marketRegion(projectMarketRegion(project, database.settings));

  return (
    <EstimateWorkspace
      key={project.updatedAt}
      project={project}
      suppliers={database.suppliers}
      weights={database.settings.completenessWeights}
      unitCostCount={database.settings.unitCosts.length}
      market={{
        selected: project.marketRegion ?? null,
        detected: detected ? { code: detected.code, label: detected.label } : null,
        active: active ? { code: active.code, label: active.label } : null,
      }}
      section={query.section ?? "overview"}
    />
  );
}
