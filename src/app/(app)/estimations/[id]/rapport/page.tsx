import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/report/print-button";
import { financialSummary } from "@/domain/calculations";
import { formatDate, formatMoney } from "@/lib/format";
import { projectStatusLabels, projectTypeLabels, provenanceLabels, riskLevelLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = await readDatabase();
  const project = database.projects.find((item) => item.id === id);
  if (!project) notFound();
  const summary = financialSummary(project);

  return (
    <article className="space-y-8 bg-white p-2 sm:p-6">
      <div className="no-print flex gap-3">
        <PrintButton />
        <a className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm" href={`/api/estimates/${project.id}/export`}>Excel</a>
        <Link className="inline-flex h-10 items-center text-sm text-technical" href={`/estimations/${project.id}`}>Retour</Link>
      </div>

      <header className="border-b border-line pb-6">
        <p className="text-xs tracking-[0.16em] text-steel">NAVALSMART</p>
        <h1 className="mt-3 text-3xl font-semibold text-navy">{project.name}</h1>
        <p className="mt-2 text-steel">Rapport d&apos;estimation · {project.client} · {project.vessel}</p>
        <p className="mt-4 max-w-2xl text-sm leading-6">Ce rapport rassemble les données saisies et calculées. Les propositions de l&apos;IA restent à vérifier. Il ne constitue pas une soumission validée tant que l&apos;estimateur ne l&apos;a pas signée.</p>
      </header>

      <Section title="Informations du projet">
        <p>Type : {projectTypeLabels[project.type]} · Lieu : {project.location || "Non précisé"}</p>
        <p>Réception : {formatDate(project.receivedAt)} · Limite : {formatDate(project.submissionDeadline)}</p>
        <p>Début : {formatDate(project.plannedStart)} · Fin : {formatDate(project.plannedEnd)} · Statut : {projectStatusLabels[project.status]}</p>
        <p className="mt-2">{project.description}</p>
      </Section>

      <Section title="Résumé exécutif">
        <p>{project.analysis?.summary ?? "Aucune synthèse d'analyse n'est enregistrée."}</p>
      </Section>

      <Section title="Portée des travaux">
        {project.analysis?.scope.length ? project.analysis.scope.map((item) => <p key={item.id}>{item.text}</p>) : <p>Non spécifié dans le document.</p>}
      </Section>

      <Section title="Structure des travaux">
        {project.workPackages.map((pkg) => (
          <p key={pkg.id}><strong>{pkg.name}.</strong> {pkg.tasks.map((task) => task.name).join(", ") || "Aucune tâche."}</p>
        ))}
      </Section>

      <Section title="Main-d'œuvre">
        {project.labor.length ? project.labor.map((item) => <p key={item.id}>{item.trade} · {item.hours} h · {formatMoney(item.hourlyRateCents, project.currency, 2)}</p>) : <p>Voir les heures des lignes d&apos;estimation.</p>}
      </Section>
      <Section title="Matériaux">
        {project.materials.length ? project.materials.map((item) => <p key={item.id}>{item.description} · {item.quantity} {item.unit}</p>) : <p>Aucun matériau détaillé.</p>}
      </Section>
      <Section title="Équipements">
        {project.equipment.length ? project.equipment.map((item) => <p key={item.id}>{item.name} · {item.quantity} × {item.duration} {item.durationUnit}</p>) : <p>Aucun équipement.</p>}
      </Section>
      <Section title="Sous-traitants">
        {project.subcontractors.length ? project.subcontractors.map((item) => <p key={item.id}>{item.name} · {item.priceCents == null ? "prix non reçu" : formatMoney(item.priceCents, project.currency)}</p>) : <p>Aucun sous-traitant.</p>}
      </Section>

      <Section title="Coûts">
        {summary.lines.map((line) => {
          const source = project.lines.find((item) => item.id === line.id);
          return <p key={line.id}>{source?.description} · {formatMoney(line.directCents, project.currency)} · {source ? provenanceLabels[source.provenance] : ""}</p>;
        })}
      </Section>

      <Section title="Risques">
        {project.risks.map((risk) => <p key={risk.id}>{risk.title} · {riskLevelLabels[risk.level]} · {risk.justification}</p>)}
      </Section>
      <Section title="Hypothèses">
        {project.assumptions.map((item) => <p key={item.id}>{item.description}</p>)}
      </Section>
      <Section title="Informations manquantes">
        {project.missing.map((item) => <p key={item.id}>{item.description} · {item.status} · {item.requiredAction}</p>)}
      </Section>

      <Section title="Résumé financier">
        <p>Coût direct : {formatMoney(summary.directCents, project.currency)}</p>
        <p>Frais indirects ({project.overheadPct} %) : {formatMoney(summary.indirectCents, project.currency)}</p>
        <p>Provision ({project.contingencyPct} %) : {formatMoney(summary.riskAllowanceCents, project.currency)}</p>
        <p>Coût estimé : {formatMoney(summary.estimatedCents, project.currency)}</p>
        <p>Prix proposé ({project.marginPct} %) : {formatMoney(summary.bidCents, project.currency)}</p>
        <p className="text-xs text-steel">CALCUL SYSTÈME. Les pourcentages sont ceux du dossier.</p>
      </Section>

      <Section title="Notes de validation">
        <p>{project.validationNote || "Estimation non encore validée par l'estimateur."}</p>
        <p className="mt-6 text-sm text-steel">{database.user.name} · {database.user.companyName}</p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <div className="mt-2 space-y-1 text-sm leading-6">{children}</div>
    </section>
  );
}
