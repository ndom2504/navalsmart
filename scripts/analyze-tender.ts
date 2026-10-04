/**
 * Analyse un appel d'offres hors de l'application, sans rien enregistrer.
 * Usage : npm run analyze:tender -- <fichier.pdf|docx|txt> [--local] [--out=resultat.json] [--text=texte.txt]
 * --local ignore OPENAI_API_KEY et n'exécute que l'extraction déterministe.
 * --text enregistre le texte extrait (pages, titres, tableaux).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractDocument } from "@/server/documents";
import { analyzeTenderText } from "@/server/ai";

async function main() {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Indiquez le chemin du document à analyser.");
  if (process.argv.includes("--local")) delete process.env.OPENAI_API_KEY;
  const extension = file.split(".").pop()!.toLowerCase();
  const { text } = await extractDocument(readFileSync(file), extension);
  const dump = process.argv.find((arg) => arg.startsWith("--text="))?.slice("--text=".length);
  if (dump) writeFileSync(dump, text, "utf8");
  const analysis = await analyzeTenderText(text, new Date().toISOString());
  const data = analysis.structured;
  if (!data) throw new Error("Analyse non structurée.");
  const out = process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);
  if (out) writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
  else console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
