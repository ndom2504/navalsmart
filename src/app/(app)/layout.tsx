import { cookies } from "next/headers";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import type { ShellAlert, ShellView } from "@/components/layout/app-header";
import { readDatabase } from "@/server/store";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const database = await readDatabase();
  const cookieStore = await cookies();
  const storedView = cookieStore.get("navalsmart-view")?.value;
  const initialView: ShellView = storedView === "bottom" || storedView === "top" ? storedView : "sidebar";
  const alerts: ShellAlert[] = [];
  for (const project of database.projects) {
    if (database.settings.notifications.missingInfo) {
      for (const item of project.missing.filter((entry) => entry.status === "OPEN")) {
        alerts.push({
          id: item.id,
          title: item.description,
          detail: `${project.name} · information manquante`,
          href: `/estimations/${project.id}?section=missing`,
        });
      }
    }
    if (database.settings.notifications.risks) {
      for (const risk of project.risks.filter((entry) => entry.status === "OPEN" && (entry.level === "HIGH" || entry.level === "CRITICAL"))) {
        alerts.push({
          id: risk.id,
          title: risk.title,
          detail: `${project.name} · risque ${risk.level === "CRITICAL" ? "critique" : "élevé"}`,
          href: `/estimations/${project.id}?section=risks`,
        });
      }
    }
    if (database.settings.notifications.supplierQuotes) {
      for (const quote of project.quotes.filter((entry) => entry.status === "REQUESTED" || entry.status === "TO_VERIFY")) {
        const supplier = database.suppliers.find((item) => item.id === quote.supplierId);
        alerts.push({
          id: quote.id,
          title: supplier?.name ?? "Soumission fournisseur",
          detail: `${project.name} · ${quote.status === "REQUESTED" ? "devis demandé" : "devis à vérifier"}`,
          href: `/estimations/${project.id}?section=suppliers`,
        });
      }
    }
  }

  return (
    <AppShell
      user={{
        name: database.user.name,
        title: database.user.jobTitle,
        email: database.user.email,
        company: database.user.companyName,
      }}
      alerts={alerts}
      initialView={initialView}
      workspaceMode={database.workspaceMode ?? "demo"}
    >
      {children}
    </AppShell>
  );
}
