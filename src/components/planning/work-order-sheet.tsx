import { workOrderStatusLabel } from "@/domain/planning";
import type { Project, WorkOrder } from "@/domain/types";
import { formatDate, formatNumber } from "@/lib/format";
import { provenanceLabels } from "@/lib/labels";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-line py-2">
      <p className="text-[11px] uppercase tracking-wide text-steel">{label}</p>
      <p className="mt-0.5 min-h-5 text-sm text-navy">{value}</p>
    </div>
  );
}

function blank(value: string | null | undefined, fallback = "________________") {
  return value && value.trim() ? value : <span className="text-steel">{fallback}</span>;
}

/** Fiche d'ordre de travail au format impression. Les cases vides se remplissent à la main sur le chantier. */
export function WorkOrderSheet({ project, order, companyName }: { project: Project; order: WorkOrder; companyName: string }) {
  const workPackage = project.workPackages.find((item) => item.id === order.workPackageId);
  const dependencies = order.dependsOn
    .map((dependency) => project.workOrders.find((item) => item.id === dependency))
    .filter((item): item is WorkOrder => Boolean(item));
  const blockers = order.blockers
    .map((blocker) => project.missing.find((item) => item.id === blocker))
    .filter((item) => item !== undefined);

  return (
    <section className="print-page mx-auto max-w-[820px] rounded-xl border border-line bg-white p-6 text-sm sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-navy pb-4">
        <div>
          <p className="text-xs tracking-[0.16em] text-steel">{companyName || "NAVALSMART"} · ORDRE DE TRAVAIL</p>
          <h1 className="mt-2 text-2xl font-semibold text-navy">{order.number} — {order.title}</h1>
          <p className="mt-1 text-steel">{workPackage ? `${workPackage.code} · ${workPackage.name}` : "Hors lot"}</p>
        </div>
        <div className="text-right">
          <p className="rounded border border-navy px-3 py-1 text-sm font-semibold text-navy">{workOrderStatusLabel(order.status)}</p>
          <p className="mt-2 text-xs text-steel">Avancement : {order.progressPct} %</p>
        </div>
      </header>

      <div className="mt-4 grid gap-x-6 sm:grid-cols-3">
        <Field label="Projet" value={project.name} />
        <Field label="Navire" value={blank(project.vessel)} />
        <Field label="Client" value={blank(project.client)} />
        <Field label="Lieu" value={blank(project.location)} />
        <Field label="Métier" value={blank(order.trade)} />
        <Field label="Responsable / équipe" value={blank(order.assignee)} />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-navy">Dates et charge</h2>
      <div className="grid gap-x-6 sm:grid-cols-4">
        <Field label={`Début prévu${order.datesProvenance === "AI" ? " (proposé)" : ""}`} value={order.plannedStart ? formatDate(order.plannedStart) : blank(null)} />
        <Field label={`Fin prévue${order.datesProvenance === "AI" ? " (proposée)" : ""}`} value={order.plannedEnd ? formatDate(order.plannedEnd) : blank(null)} />
        <Field label="Début réel" value={order.actualStart ? formatDate(order.actualStart) : blank(null)} />
        <Field label="Fin réelle" value={order.actualEnd ? formatDate(order.actualEnd) : blank(null)} />
        <Field label="Heures prévues" value={order.plannedHours === null ? blank(null, "Non chiffrées") : `${formatNumber(order.plannedHours, 1)} h`} />
        <Field label="Heures réelles" value={order.actualHours === null ? blank(null) : `${formatNumber(order.actualHours, 1)} h`} />
        <Field label="Quantité" value={order.quantity === null ? blank(null) : `${formatNumber(order.quantity, 2)} ${order.unit ?? ""}`} />
        <Field label="Réalisé" value={blank(null)} />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-navy">Description et consignes</h2>
      <p className="mt-2 min-h-16 whitespace-pre-wrap rounded border border-line p-3 leading-6">{order.description || order.excerpt || " "}</p>
      {order.excerpt && order.description ? <p className="mt-2 text-xs italic text-steel">Extrait de l&apos;appel d&apos;offres : « {order.excerpt} »</p> : null}

      {dependencies.length || blockers.length ? (
        <>
          <h2 className="mt-6 text-sm font-semibold text-navy">Préalables</h2>
          <ul className="mt-2 space-y-1">
            {dependencies.map((item) => <li key={item.id}>☐ {item.number} — {item.title} <span className="text-xs text-steel">({workOrderStatusLabel(item.status)})</span></li>)}
            {blockers.map((item) => <li key={item.id}>☐ Information à obtenir : {item.description} <span className="text-xs text-steel">({item.status === "OPEN" ? "ouverte" : "levée"})</span></li>)}
          </ul>
        </>
      ) : null}

      <h2 className="mt-6 text-sm font-semibold text-navy">Contrôle et réception</h2>
      <div className="mt-2 grid gap-4 sm:grid-cols-3">
        {["Exécuté par", "Contrôlé par", "Réceptionné par"].map((label) => (
          <div key={label} className="rounded border border-line p-3">
            <p className="text-[11px] uppercase tracking-wide text-steel">{label}</p>
            <p className="mt-6 border-t border-dashed border-line pt-1 text-[11px] text-steel">Nom, date et signature</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-steel">Observations :</p>
      <div className="mt-1 h-20 rounded border border-line" />

      <footer className="mt-4 flex flex-wrap justify-between gap-2 text-[11px] text-steel">
        <span>Tâche : {provenanceLabels[order.provenance]}{order.page ? ` · Page ${order.page}` : ""}{order.section ? ` · Section ${order.section}` : ""} · Dates : {provenanceLabels[order.datesProvenance]}</span>
        <span>Édité le {formatDate(new Date().toISOString())}</span>
      </footer>
    </section>
  );
}
