import "server-only";

import OpenAI from "openai";
import { analysisForDocument } from "@/domain/analyze-document";
import { groundAnalysis } from "@/domain/grounding";
import { modelAnalysisSchema } from "@/domain/schemas";
import type { Analysis } from "@/domain/types";
import { answerFromProject } from "@/domain/chat";
import { financialSummary } from "@/domain/calculations";
import type { Project } from "@/domain/types";

function client(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function modelName(preferred?: string): string {
  return process.env.OPENAI_MODEL || preferred || "gpt-4.1-mini";
}

export async function analyzeTenderText(documentText: string, now: string, preferredModel?: string): Promise<Analysis> {
  const local = () => groundAnalysis(documentText, analysisForDocument(documentText, now));
  const openai = client();
  if (!openai) return local();

  try {
    const completion = await openai.chat.completions.create({
      model: modelName(preferredModel),
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Tu aides un estimateur naval. Tu ne remplaces pas son jugement.",
            "Retourne uniquement un JSON avec les clés summary, project, scope, requirements, workPackages, quantities, deadlines, requiredDocuments, constraints, risks, assumptions, missingInformation.",
            "N'invente aucun fait. Chaque élément factuel doit contenir un excerpt copié mot pour mot du document.",
            "Si l'information est absente, utilise null ou une liste vide.",
            "Ne calcule aucun prix.",
            "Un risque sans phrase du document qui le justifie ne doit pas être proposé.",
            "project: { name, client, vessel, deadline } avec null si absent.",
          ].join(" "),
        },
        {
          role: "user",
          content: documentText.slice(0, 100_000),
        },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return local();
    const parsed = modelAnalysisSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return local();
    const data = parsed.data;
    const proposed: Analysis = {
      id: `analysis_${crypto.randomUUID()}`,
      summary: data.summary,
      engine: "OPENAI",
      disclaimer: "Proposition du modèle, filtrée : toute citation absente du document a été écartée. L'estimateur doit vérifier.",
      projectHints: data.project,
      scope: data.scope.map((item, index) => ({ id: `scope_${index}`, ...item, provenance: "DOCUMENT" as const })),
      requirements: data.requirements.map((item, index) => ({ id: `req_${index}`, ...item, provenance: "DOCUMENT" as const })),
      detectedWork: data.workPackages.map((item, index) => ({ id: `work_${index}`, ...item })),
      quantities: data.quantities.map((item, index) => ({ id: `qty_${index}`, ...item, provenance: "DOCUMENT" as const })),
      deadlines: data.deadlines.map((item, index) => ({ id: `delay_${index}`, ...item, provenance: "DOCUMENT" as const })),
      requiredDocuments: data.requiredDocuments.map((item, index) => ({ id: `docreq_${index}`, received: false, ...item })),
      constraints: data.constraints.map((item, index) => ({ id: `constraint_${index}`, ...item, provenance: "DOCUMENT" as const })),
      risks: data.risks.map((item, index) => ({
        id: `risk_ai_${index}`,
        title: item.title,
        probability: item.probability === "CRITICAL" ? "HIGH" : item.probability,
        impact: item.impact === "CRITICAL" ? "HIGH" : item.impact,
        level: item.level,
        potentialCostCents: null,
        mitigation: "",
        owner: "Estimateur",
        status: "OPEN",
        justification: item.justification,
        page: item.page,
        section: item.section,
        provenance: "DOCUMENT",
      })),
      assumptions: data.assumptions.map((item, index) => ({
        id: `assum_ai_${index}`,
        description: item.description,
        sourceLabel: "Proposition du modèle — à confirmer",
        page: null,
        section: null,
        potentialImpact: item.impact,
        status: "OPEN",
        provenance: "AI",
      })),
      missing: data.missingInformation.map((item, index) => ({
        id: `missing_ai_${index}`,
        description: item.description,
        importance: item.importance,
        sourceLabel: item.excerpt ?? "",
        page: item.page,
        section: item.section,
        requiredAction: item.action,
        status: "OPEN",
        note: "",
      })),
      createdAt: now,
    };
    const grounded = groundAnalysis(documentText, proposed);
    if (!grounded.scope.length && !grounded.quantities.length && !grounded.requirements.length) {
      return local();
    }
    return grounded;
  } catch {
    return local();
  }
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
