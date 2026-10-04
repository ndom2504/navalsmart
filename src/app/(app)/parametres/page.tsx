import { projectAvatarUrl } from "@/components/projects/project-avatar";
import { SettingsForm, type SettingsTab } from "@/components/settings/settings-form";
import { projectStatusLabels } from "@/lib/labels";
import { readDatabase } from "@/server/store";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const query = await searchParams;
  const tabs: SettingsTab[] = ["general", "users", "projects", "estimates", "costs", "suppliers", "risks", "reports", "integrations"];
  const initialTab = tabs.find((tab) => tab === query.onglet) ?? "general";
  const database = await readDatabase();
  const openai = Boolean(process.env.OPENAI_API_KEY);
  return (
    <SettingsForm
        settings={database.settings}
        openaiConfigured={openai}
        supplierCount={database.suppliers.length}
        workspaceMode={database.workspaceMode ?? "demo"}
        projects={database.projects.map((project) => ({
          id: project.id,
          name: project.name,
          avatarUrl: projectAvatarUrl(project),
          client: project.client,
          statusLabel: projectStatusLabels[project.status],
        }))}
        profile={{
          name: database.user.name,
          email: database.user.email,
          jobTitle: database.user.jobTitle,
          companyName: database.user.companyName,
          role: database.user.role,
        }}
        initialTab={initialTab}
    />
  );
}
