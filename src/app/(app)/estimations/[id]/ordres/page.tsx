import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkOrderSheet } from "@/components/planning/work-order-sheet";
import { PrintButton } from "@/components/report/print-button";
import { readDatabase } from "@/server/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = await readDatabase();
  const project = database.projects.find((item) => item.id === id);
  return { title: project ? `Ordres de travail — ${project.name}` : "Ordres de travail" };
}

export default async function WorkOrdersPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = await readDatabase();
  const project = database.projects.find((item) => item.id === id);
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <PrintButton />
        <Link className="inline-flex h-10 items-center text-sm text-technical" href={`/estimations/${project.id}?section=workorders`}>Retour aux ordres de travail</Link>
        <p className="text-sm text-steel">{project.workOrders.length} fiche(s) · une par page à l&apos;impression.</p>
      </div>
      {project.workOrders.length ? (
        <div className="space-y-6">
          {project.workOrders.map((order) => <WorkOrderSheet key={order.id} project={project} order={order} companyName={database.user.companyName} />)}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-steel">Aucun ordre de travail pour ce projet.</p>
      )}
    </div>
  );
}
