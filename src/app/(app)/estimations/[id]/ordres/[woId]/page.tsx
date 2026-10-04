import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkOrderSheet } from "@/components/planning/work-order-sheet";
import { PrintButton } from "@/components/report/print-button";
import { readDatabase } from "@/server/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string; woId: string }> }) {
  const { id, woId } = await params;
  const database = await readDatabase();
  const order = database.projects.find((item) => item.id === id)?.workOrders.find((item) => item.id === woId);
  return { title: order ? `${order.number} — ${order.title}` : "Ordre de travail" };
}

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string; woId: string }> }) {
  const { id, woId } = await params;
  const database = await readDatabase();
  const project = database.projects.find((item) => item.id === id);
  const order = project?.workOrders.find((item) => item.id === woId);
  if (!project || !order) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <PrintButton />
        <Link className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm" href={`/estimations/${project.id}/ordres`}>Tous les ordres</Link>
        <Link className="inline-flex h-10 items-center text-sm text-technical" href={`/estimations/${project.id}?section=workorders`}>Retour aux ordres de travail</Link>
      </div>
      <WorkOrderSheet project={project} order={order} companyName={database.user.companyName} />
    </div>
  );
}
