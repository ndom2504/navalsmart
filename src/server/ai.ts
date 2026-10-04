import "server-only";

import OpenAI from "openai";
import { analysisForDocument } from "@/domain/analyze-document";
import { chunkDocument, type DocumentChunk } from "@/domain/chunking";
import { structureDocument, type StructuredDocument } from "@/domain/document-structure";
import { groundAnalysis } from "@/domain/grounding";
import { groundTenderAnalysis, mergeTenderAnalyses, toAnalysis } from "@/domain/tender-analysis";
import { extractTenderFacts } from "@/domain/tender-extraction";
import {
  emptyTenderAnalysis,
  LIST_KEYS,
  parseTenderAnalysis,
  tenderAnalysisSchema,
  type TenderAnalysis,
} from "@/lib/validation/tender-analysis.schema";
import type { Analysis } from "@/domain/types";
import { answerFromProject } from "@/domain/chat";
import { financialSummary } from "@/domain/calculations";
import type { Project } from "@/domain/types";
import { debugAnalysis, preview } from "@/server/analysis-debug";

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function modelName(preferred?: string): string {
  return process.env.OPENAI_MODEL || preferred || "gpt-4.1-mini";
}

const EXTRACTION_PROMPT = [
  "Tu es l'extracteur d'appels d'offres de NavalSmart, outil d'estimation navale. Tu extrais des données structurées ; tu ne rédiges pas de résumé.",
  "Réponds uniquement par un objet JSON conforme au format décrit plus bas.",
  "",
  "Règles :",
  "1. N'invente jamais un nom de projet, un client, un navire, une quantité, une date ou un montant. Donnée absente : null ou []. N'écris jamais « Non spécifié dans le document ».",
  "2. Chaque élément porte source = { page, section, excerpt }. page = numéro donné par « === PAGE n === ». section = numéro de section (ex. \"5\", \"Annexe A\"). excerpt = citation copiée mot pour mot du document (une phrase ou une ligne de tableau), sans reformulation et sans la puce.",
  "3. sourceType : SOURCE_DOCUMENT pour un fait écrit dans le document ; AI_DATA pour une déduction ou une formulation de ta part (risque inféré, hypothèse proposée, question au client). N'utilise jamais USER_DATA ni SYSTEM_CALCULATION.",
  "4. confidence : HIGH si le fait est écrit explicitement, MEDIUM s'il demande une interprétation, LOW s'il est incertain.",
  "5. Quantités de travaux : value = nombre (1 800 → 1800 ; 21,4 → 21.4), unit = unité écrite (m², m, unités…). qualifiers parmi APPROXIMATE (environ, approximativement), MINIMUM, MAXIMUM, TOLERANCE (± x %, avec tolerancePct), INDICATIVE (quantité indicative), TO_CONFIRM (à confirmer). qualifierText = mots exacts (« environ », « ±25 % »). workPackageCode = code du lot (ex. \"WP-02\") quand le document le rattache. Une même quantité citée à plusieurs endroits n'apparaît qu'une fois, avec tous ses qualificatifs. Les caractéristiques du navire (longueur, jauge, capacité) ne sont pas des quantités de travaux.",
  "6. Toute phrase contenant « à confirmer », « à vérifier », « sera confirmé », « sujet à confirmation », « non précisé », « ne précise pas », « sera communiqué » ou « sera approuvé » devient un élément de missingInformation : kind DEPENDENCY si l'information sera fournie plus tard ou dépend d'un événement (visite, inspection, disponibilité du navire), sinon MISSING_INFORMATION ; trigger = l'expression trouvée.",
  "7. Risques : chacun cite le passage du document qui le motive (source.excerpt obligatoire). Un risque que tu déduis est AI_DATA ; SOURCE_DOCUMENT seulement si le document nomme lui-même le risque. Niveaux LOW, MEDIUM, HIGH, CRITICAL. Aucun montant.",
  "8. Aucun calcul financier : pas de prix, de taux, de total ni d'heures estimées.",
  "9. Dates au format AAAA-MM-JJ (date, value), heure HH:MM (time), texte d'origine dans text.",
  "10. project.name = intitulé des travaux, sans « Appel d'offres – », en casse de phrase. project.client = émetteur ou acheteur, sans la mention entre parenthèses. project.vessel = nom du navire seul. project.location = port, chantier ou lieu d'exécution des travaux.",
  "",
  "Format :",
  "{",
  " \"project\": { \"name\": Fait|null, \"reference\": Fait|null, \"client\": Fait|null, \"vessel\": Fait|null, \"location\": Fait|null },",
  " \"submission\": { \"deadline\": { \"value\": \"AAAA-MM-JJ\"|null, \"time\": \"HH:MM\"|null, \"text\": string, Trace }|null, \"currency\": { \"value\": \"CAD\", Trace }|null, \"validityDays\": { \"value\": 90, Trace }|null },",
  " \"workPackages\": [{ \"code\": string|null, \"title\": string, \"description\": string|null, \"tasks\": [string], Trace }],",
  " \"quantities\": [{ \"label\": string, \"value\": number, \"unit\": string, \"qualifiers\": [string], \"qualifierText\": string|null, \"tolerancePct\": number|null, \"workPackageCode\": string|null, \"toConfirm\": boolean, Trace }],",
  " \"requirements\": [{ \"text\": string, \"category\": string|null, Trace }],",
  " \"schedule\": [{ \"label\": string, \"date\": \"AAAA-MM-JJ\"|null, \"time\": \"HH:MM\"|null, \"text\": string, \"kind\": \"DEADLINE\"|\"MILESTONE\"|\"DURATION\"|\"PERIOD\", \"toConfirm\": boolean, Trace }],",
  " \"requiredDocuments\": [{ \"name\": string, Trace }],",
  " \"constraints\": [{ \"text\": string, Trace }],",
  " \"risks\": [{ \"title\": string, \"description\": string|null, \"probability\": Niveau, \"impact\": Niveau, \"level\": Niveau, \"mitigation\": string|null, Trace }],",
  " \"missingInformation\": [{ \"description\": string, \"kind\": \"MISSING_INFORMATION\"|\"DEPENDENCY\", \"importance\": Niveau, \"action\": string|null, \"trigger\": string|null, Trace }],",
  " \"assumptions\": [{ \"description\": string, \"impact\": string|null, Trace }],",
  " \"questionsForClient\": [{ \"question\": string, \"reason\": string|null, Trace }]",
  "}",
  "Fait = { \"value\": string, Trace }. Trace = \"source\": { \"page\": number|null, \"section\": string|null, \"excerpt\": string|null }, \"sourceType\": string, \"confidence\": \"HIGH\"|\"MEDIUM\"|\"LOW\".",
].join("\n");

interface ChunkOutcome {
  data: TenderAnalysis | null;
  failure: string | null;
}

async function analyzeChunk(openai: OpenAI, model: string, chunk: DocumentChunk): Promise<ChunkOutcome> {
  const label = `morceau ${chunk.index + 1}/${chunk.total}`;
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 16_000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: chunk.total > 1
            ? `Extrais uniquement ce qui figure dans ce morceau du document.\n\n${chunk.text}`
            : `Voici le document complet.\n\n${chunk.text}`,
        },
      ],
    });
    const choice = completion.choices[0];
    const content = choice?.message?.content ?? "";
    debugAnalysis(`4. Réponse brute de l'IA — ${label}`, {
      model: completion.model,
      finishReason: choice?.finish_reason ?? null,
      usage: completion.usage ?? null,
      content: preview(content, 20_000),
    });
    if (!content) return { data: null, failure: `${label} : réponse vide` };
    if (choice?.finish_reason === "length") return { data: null, failure: `${label} : réponse tronquée (limite de jetons)` };

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (error) {
      return { data: null, failure: `${label} : JSON illisible (${(error as Error).message})` };
    }
    const parsed = parseTenderAnalysis(json);
    if ("error" in parsed) {
      debugAnalysis(`5. Résultat Zod — ${label}`, { success: false, error: parsed.error });
      return { data: null, failure: `${label} : réponse refusée par Zod` };
    }
    debugAnalysis(`5. Résultat Zod — ${label}`, {
      success: true,
      received: parsed.report.received,
      accepted: parsed.report.accepted,
      rejectedItems: parsed.report.issues,
    });
    return { data: parsed.data, failure: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugAnalysis(`4. Appel IA en échec — ${label}`, { error: message });
    return { data: null, failure: `${label} : ${message}` };
  }
}

function combineChunks(document: StructuredDocument, outcomes: TenderAnalysis[]): TenderAnalysis {
  return outcomes.reduce((merged, current) => mergeTenderAnalyses(document, merged, current), emptyTenderAnalysis());
}

function counts(data: TenderAnalysis): Record<string, number> {
  return Object.fromEntries(LIST_KEYS.map((key) => [key, data[key].length]));
}

/**
 * Chaîne d'analyse : texte extrait → structure (pages, sections, paragraphes, tableaux)
 * → morceaux sans phrase coupée → IA → Zod → ancrage dans le document → fusion avec
 * l'extraction déterministe → validation Zod finale → projection pour l'interface.
 */
export async function analyzeTenderText(documentText: string, now: string, preferredModel?: string): Promise<Analysis> {
  if (documentText.includes("NAVALSMART-DEMO-TENDER-V1")) {
    return groundAnalysis(documentText, analysisForDocument(documentText, now));
  }

  const document = structureDocument(documentText);
  debugAnalysis("1. Texte extrait", {
    characters: documentText.length,
    pageCount: document.pageCount,
    text: preview(documentText),
  });
  debugAnalysis("2. Structure détectée", {
    title: document.title,
    blocks: document.blocks.length,
    tables: document.blocks.filter((block) => block.kind === "table_row").length,
    sections: document.sections.map((section) => `${section.number ?? "—"} ${section.title} (p. ${section.page ?? "?"})`),
    metadata: document.metadata,
  });

  const local = extractTenderFacts(document);
  const chunks = chunkDocument(document);
  debugAnalysis("3. Morceaux envoyés à l'IA", chunks.map((chunk) => ({
    index: chunk.index + 1,
    total: chunk.total,
    pages: chunk.pages,
    sections: chunk.sections,
    blocks: chunk.blockCount,
    characters: chunk.text.length,
    text: preview(chunk.text, 1500),
  })));

  const openai = client();
  const failures: string[] = [];
  let modelData: TenderAnalysis | null = null;
  if (!openai) {
    failures.push("OPENAI_API_KEY absente : extraction déterministe seule.");
  } else {
    const model = modelName(preferredModel);
    const outcomes = await Promise.all(chunks.map((chunk) => analyzeChunk(openai, model, chunk)));
    failures.push(...outcomes.flatMap((outcome) => outcome.failure ? [outcome.failure] : []));
    const accepted = outcomes.flatMap((outcome) => outcome.data ? [outcome.data] : []);
    if (accepted.length) {
      const grounded = groundTenderAnalysis(document, combineChunks(document, accepted));
      debugAnalysis("6. Ancrage des réponses IA dans le document", {
        kept: counts(grounded.data),
        dropped: grounded.report.dropped,
        reclassified: grounded.report.reclassified,
      });
      modelData = grounded.data;
    }
  }

  const merged = mergeTenderAnalyses(document, modelData ?? emptyTenderAnalysis(), local);
  const final = tenderAnalysisSchema.safeParse(merged);
  if (!final.success) {
    debugAnalysis("7. Validation Zod finale en échec", final.error.issues);
  }
  const data = final.success ? final.data : local;
  const usedModel = Boolean(modelData);
  const disclaimer = usedModel
    ? "Extraction structurée : le modèle propose, chaque citation est retrouvée dans le document (page et section recalculées), puis l'extraction déterministe complète les manques. Les risques, hypothèses et questions marqués DONNÉE IA sont des propositions à valider. Aucun montant n'est calculé par le modèle."
    : `Extraction déterministe locale : seules des données retrouvées dans le document sont retenues. Les risques et questions marqués DONNÉE IA sont des propositions à valider. Aucun montant n'est calculé.${failures.length ? ` Modèle non utilisé : ${failures.join(" ; ")}` : ""}`;

  const analysis = toAnalysis(data, {
    id: `analysis_${crypto.randomUUID()}`,
    now,
    engine: usedModel ? "OPENAI" : "LOCAL",
    disclaimer,
  });
  debugAnalysis("7. Données finales validées", {
    engine: analysis.engine,
    zod: final.success ? "valide" : "invalide — extraction locale retenue",
    failures,
    project: {
      name: data.project.name?.value ?? null,
      reference: data.project.reference?.value ?? null,
      client: data.project.client?.value ?? null,
      vessel: data.project.vessel?.value ?? null,
    },
    submission: {
      deadline: data.submission.deadline ? `${data.submission.deadline.value ?? "?"} ${data.submission.deadline.time ?? ""}`.trim() : null,
      currency: data.submission.currency?.value ?? null,
      validityDays: data.submission.validityDays?.value ?? null,
    },
    counts: counts(data),
    workPackages: data.workPackages.map((item) => `${item.code ?? "—"} ${item.title} [p.${item.source.page ?? "?"} §${item.source.section ?? "?"}]`),
    quantities: analysis.quantities.map((item) => `${item.text} [p.${item.page ?? "?"} §${item.section ?? "?"}]`),
    missingInformation: data.missingInformation.map((item) => `${item.kind} · ${item.description} [p.${item.source.page ?? "?"} §${item.source.section ?? "?"}]`),
  });
  return analysis;
}

export async function answerQuestion(project: Project, message: string, preferredModel?: string): Promise<string> {
  const local = answerFromProject(message, project);
  const fallback = "Je ne dispose pas de cette information dans les données du projet.";
  if (local !== fallback || !client()) return local;

  const openai = client();
  if (!openai) return local;
  const summary = financialSummary(project);
  try {
    const completion = await openai.chat.completions.create({
      model: modelName(preferredModel),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "Tu es NavalSmart AI, assistant d'estimation navale.",
            "Tu es professionnel, précis, analytique, pédagogique et concis.",
            "Tu réponds uniquement à partir du JSON fourni.",
            "Si l'information n'y est pas, réponds exactement : Je ne dispose pas de cette information dans les données du projet.",
            "Distingue SOURCE DOCUMENT, DONNÉE UTILISATEUR, DONNÉE IA et CALCUL SYSTÈME.",
            "Ne présente jamais une proposition comme un fait certain.",
            "Ne recalcule pas les montants : utilise les totaux déjà fournis.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            question: message,
            calculated: summary,
            project: {
              name: project.name,
              client: project.client,
              vessel: project.vessel,
              status: project.status,
              parameters: {
                contingencyPct: project.contingencyPct,
                overheadPct: project.overheadPct,
                marginPct: project.marginPct,
              },
              lines: project.lines,
              labor: project.labor,
              materials: project.materials,
              equipment: project.equipment,
              risks: project.risks,
              assumptions: project.assumptions,
              missing: project.missing,
              quotes: project.quotes,
              subcontractors: project.subcontractors,
            },
          }),
        },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text || fallback;
  } catch {
    return local;
  }
}
