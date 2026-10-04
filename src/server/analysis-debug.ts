import "server-only";

type DebugLevel = "off" | "on" | "full";

/**
 * NAVALSMART_DEBUG_ANALYSIS : « 0 » coupe le journal, « full » journalise les textes
 * intégraux. Par défaut, le journal est actif hors production.
 */
function level(): DebugLevel {
  const value = process.env.NAVALSMART_DEBUG_ANALYSIS?.trim().toLowerCase();
  if (value === "0" || value === "off" || value === "false") return "off";
  if (value === "full") return "full";
  if (value === "1" || value === "on" || value === "true") return "on";
  return process.env.NODE_ENV === "production" ? "off" : "on";
}

export function debugEnabled(): boolean {
  return level() !== "off";
}

/** Tronque un long texte, sauf en mode « full ». */
export function preview(text: string, max = 4000): string {
  if (level() === "full" || text.length <= max) return text;
  return `${text.slice(0, max)}\n… [${text.length - max} caractères non affichés — NAVALSMART_DEBUG_ANALYSIS=full pour tout voir]`;
}

export function debugAnalysis(stage: string, payload: unknown): void {
  if (!debugEnabled()) return;
  const body = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  console.info(`\n[NavalSmart analyse] ${stage}\n${body}`);
}
