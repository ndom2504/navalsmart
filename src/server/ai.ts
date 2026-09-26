import "server-only";

import OpenAI from "openai";
import { analysisForDocument } from "@/domain/analyze-document";
import { groundAnalysis } from "@/domain/grounding";
import { parseAIAnalysis } from "@/lib/validation";
import type { AIAnalysis } from "@/lib/validation/ai-analysis.schema";
import type { Analysis, SourcedItem } from "@/domain/types";
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

function cited(fact: { value: string; source: string; page: string | null; section: string | null }, id: string): SourcedItem {
  return {
    id,
    text: fact.value,
    page: fact.page,
    section: fact.section,
    excerpt: fact.source,
    provenance: "DOCUMENT",
  };
}

function analysisFromModel(data: AIAnalysis, now: string): Analysis {
  const packagedTasks = new Set(data.workPackages.flatMap((item) => item.tasks));
  const extraTasks = data.tasks.filter((task) => !packagedTasks.has(task.value));
  return {
    id: `analysis_${crypto.randomUUID()}`,
    summary: data.summary,
    engine: "OPENAI",
    disclaimer: "Proposition du modèle, filtrée : toute citation absente du document a été écartée. L'estimateur doit vérifier. Aucun montant n'est calculé par le modèle.",
    projectHints: data.project,
    scope: data.scope.map((item, index) => cited(item, `scope_${index}`)),
    requirements: data.requirements.map((item, index) => cited(item, `req_${index}`)),
    detectedWork: [
      ...data.workPackages.map((item, index) => ({
        id: `work_${index}`,
        name: item.value,
        tasks: item.tasks.length ? item.tasks : [item.value],
        page: item.page,
        section: item.section,
        excerpt: item.source,
      })),
      ...extraTasks.map((item, index) => ({
        id: `task_${index}`,
        name: item.value,
        tasks: [item.value],
        page: item.page,
        section: item.section,
        excerpt: item.source,
      })),
    ],
    quantities: data.quantities.map((item, index) => cited(item, `qty_${index}`)),
    deadlines: data.deadlines.map((item, index) => cited(item, `delay_${index}`)),
    requiredDocuments: data.documentsRequired.map((item, index) => ({
      id: `docreq_${index}`,
      name: item.value,
      page: item.page,
      section: item.section,
      excerpt: item.source,
      received: false,
    })),
    constraints: data.constraints.map((item, index) => cited(item, `constraint_${index}`)),
    risks: data.risks.map((item, index) => ({
      id: `risk_ai_${index}`,
      title: item.value,
      probability: item.probability,
      impact: item.impact,
      level: item.level,
      potentialCostCents: null,
      mitigation: "",
      owner: "Estimateur",
      status: "OPEN" as const,
      justification: item.source,
      page: item.page,
      section: item.section,
      provenance: "DOCUMENT" as const,
    })),
    assumptions: data.assumptions.map((item, index) => ({
      id: `assum_ai_${index}`,
      description: item.value,
      sourceLabel: item.source || "Proposition du modèle — à confirmer",
      page: item.page,
      section: item.section,
      potentialImpact: item.impact,
      status: "OPEN" as const,
      provenance: "AI" as const,
    })),
    missing: data.missingInformation.map((item, index) => ({
      id: `missing_ai_${index}`,
      description: item.value,
      importance: item.importance,
      sourceLabel: item.source || "",
      page: item.page,
      section: item.section,
      requiredAction: item.action,
      status: "OPEN" as const,
      note: "",
    })),
    createdAt: now,
  };
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
            "Retourne uniquement un JSON avec les clés summary, project, scope, requirements, workPackages, tasks, quantities, deadlines, documentsRequired, constraints, risks, assumptions, missingInformation.",
            "Chaque fait du document a la forme { value, source, page, section, status }.",
            "source est une citation copiée mot pour mot. status vaut AI_GENERATED.",
            "N'invente aucun fait. Si l'information est absente, utilise null ou une liste vide.",
            "Ne calcule aucun prix, aucune heure et aucun total. N'ajoute pas de champ monétaire.",
            "Un risque sans citation du document ne doit pas être proposé.",
            "Risque : { value, source, page, section, status, probability, impact, level } avec LOW, MEDIUM, HIGH ou CRITICAL.",
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
    const parsed = parseAIAnalysis(JSON.parse(content));
    if (!parsed.success) return local();
    const grounded = groundAnalysis(documentText, analysisFromModel(parsed.data, now));
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
