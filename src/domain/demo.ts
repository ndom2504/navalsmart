import { heuristicAnalysis } from "@/domain/analyze-document";
import { financialSummary } from "@/domain/calculations";
import { DEMO_TENDER_TEXT } from "@/domain/demo-tender";
import { groundAnalysis } from "@/domain/grounding";
import type {
  AppSettings,
  Assumption,
  CostOrigins,
  Database,
  EquipmentCost,
  EstimateLine,
  LaborCost,
  LineStatus,
  MaterialCost,
  MissingInformation,
  Project,
  ProjectStatus,
  ProjectType,
  Risk,
  Subcontractor,
  Supplier,
  SupplierQuote,
  WorkPackage,
} from "@/domain/types";

const userOrigins: CostOrigins = {
  hours: "USER",
  rate: "USER",
  materials: "USER",
  equipment: "USER",
  subcontract: "USER",
  logistics: "USER",
  other: "USER",
};

export const defaultSettings = (): AppSettings => ({
  currency: "CAD",
  contingencyPct: 8,
  overheadPct: 12,
  marginPct: 10,
  overtimeFactor: 1.5,
  defaultLearningMode: true,
  notifications: { missingInfo: true, risks: true, supplierQuotes: true },
  laborRates: [
    { trade: "Soudeur", hourlyRateCents: 6500 },
    { trade: "Charpentier fer", hourlyRateCents: 7800 },
    { trade: "Mécanicien", hourlyRateCents: 8200 },
    { trade: "Électricien", hourlyRateCents: 7500 },
    { trade: "Tuyauteur", hourlyRateCents: 7400 },
    { trade: "Peintre", hourlyRateCents: 5800 },
    { trade: "Inspecteur", hourlyRateCents: 9500 },
    { trade: "Manutentionnaire", hourlyRateCents: 5200 },
  ],
  units: ["heures", "jour", "t", "kg", "m", "m²", "L", "forfait"],
  aiModel: "gpt-4.1-mini",
  completenessWeights: {
    scope: 1,
    packages: 1,
    quantities: 1,
    labor: 1,
    materials: 1,
    suppliers: 1,
    subcontractors: 1,
    risks: 1,
    assumptions: 1,
    missing: 1,
    documents: 1,
  },
});

function line(input: {
  id: string;
  workPackageId: string;
  taskId: string;
  lot: string;
  description: string;
  hours: number;
  rateCents: number;
  status: LineStatus;
  page: string | null;
  section: string | null;
  sourceLabel: string;
  explanation: string;
  origins?: CostOrigins;
  logisticsCents?: number;
  otherCents?: number;
}): EstimateLine {
  return {
    id: input.id,
    workPackageId: input.workPackageId,
    taskId: input.taskId,
    lot: input.lot,
    description: input.description,
    quantity: input.hours,
    unit: "heures",
    hours: input.hours,
    hourlyRateCents: input.rateCents,
    materialsCents: 0,
    equipmentCents: 0,
    subcontractCents: 0,
    logisticsCents: input.logisticsCents ?? 0,
    otherCents: input.otherCents ?? 0,
    sourceLabel: input.sourceLabel,
    page: input.page,
    section: input.section,
    provenance: input.origins?.hours === "DOCUMENT" ? "DOCUMENT" : "USER",
    status: input.status,
    explanation: input.explanation,
    origins: input.origins ?? userOrigins,
  };
}

function labor(lineId: string, category: string, trade: string, hours: number, rateCents: number): LaborCost {
  return {
    id: `labor_${lineId}`,
    taskId: lineId.replace("line_", "task_"),
    estimateLineId: lineId,
    category,
    trade,
    workers: 1,
    hours,
    hourlyRateCents: rateCents,
    overtimeHours: 0,
    productivityFactor: 1,
    overtimeFactor: 1.5,
  };
}

const suppliers: Supplier[] = [
  {
    id: "sup_acier",
    name: "Aciers du Large — fictif",
    contact: "appro.fictif@aciers-du-large.example",
    category: "Acier",
    description: "Fournisseur fictif de tôles. Aucun prix réel.",
    currency: "CAD",
  },
  {
    id: "sup_cables",
    name: "Câbles Nord — fictif",
    contact: "devis.fictif@cables-nord.example",
    category: "Électricité",
    description: "Fournisseur fictif de câbles marine.",
    currency: "CAD",
  },
  {
    id: "sup_peinture",
    name: "Peintures Quai — fictif",
    contact: "ventes.fictif@peintures-quai.example",
    category: "Peinture",
    description: "Fournisseur fictif de revêtements.",
    currency: "CAD",
  },
];

function buildDemoProject(nowAnalysis: ReturnType<typeof groundAnalysis>): Project {
  const packages: WorkPackage[] = [
    packageOf("wp_structure", "01", "Structure / coque", ["Découpe", "Remplacement de plaques", "Soudage", "Inspection"]),
    packageOf("wp_meca", "02", "Mécanique", ["Dépose équipement", "Réparation", "Installation"]),
    packageOf("wp_elec", "03", "Électricité", ["Câblage", "Installation", "Tests"]),
    packageOf("wp_pipe", "04", "Tuyauterie", ["Dépose", "Fabrication", "Installation"]),
    packageOf("wp_paint", "05", "Peinture", ["Préparation", "Application"]),
  ];

  const specs = [
    spec("decoupe", "wp_structure", "Structure / coque", "Découpe", 180, 7200, "USER_VERIFIED", "4", "3.2", "Appel d'offres", "Tâche citée dans la portée. Heures et taux saisis par l'estimateur."),
    spec("plaques", "wp_structure", "Structure / coque", "Remplacement de plaques", 800, 7800, "USER_MODIFIED", "5", "4.1", "Hypothèse estimateur", "La quantité d'acier n'est pas dans le document. Les heures sont une estimation de l'utilisateur.", { ...userOrigins, materials: "USER" }, 6_500_000, 0),
    spec("soudage", "wp_structure", "Structure / coque", "Soudage", 620, 6500, "USER_MODIFIED", "5", "4.1", "Appel d'offres", "Le document indique 500 heures à la section 4.1. L'estimateur a modifié cette base à 620 heures. Le taux ne figure pas dans le document.", { ...userOrigins, hours: "USER", rate: "USER" }),
    spec("inspection", "wp_structure", "Structure / coque", "Inspection", 160, 9500, "USER_VERIFIED", "3", "2.1", "Appel d'offres", "Le contrôle non destructif est exigé. Le montant de sous-traitance est une soumission fictive.", userOrigins, 0, 1_200_000),
    spec("depose_meca", "wp_meca", "Mécanique", "Dépose équipement", 400, 8200, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Tâche détectée dans la portée. Heures non écrites dans le document : proposition à vérifier.", aiHours()),
    spec("reparation", "wp_meca", "Mécanique", "Réparation", 600, 8800, "USER_VERIFIED", "4", "3.2", "Appel d'offres", "Tâche citée. Heures confirmées par l'estimateur pour la simulation."),
    spec("install_meca", "wp_meca", "Mécanique", "Installation", 350, 8200, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Tâche détectée. Heures proposées, non citées comme quantité."),
    spec("cablage", "wp_elec", "Électricité", "Câblage", 900, 7500, "USER_VERIFIED", "5", "4.1", "Appel d'offres", "Le document indique 900 heures. Le taux vient du barème de simulation.", { ...userOrigins, hours: "DOCUMENT" }),
    spec("install_elec", "wp_elec", "Électricité", "Installation", 280, 7500, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Tâche détectée dans la portée électrique."),
    spec("tests_elec", "wp_elec", "Électricité", "Tests", 80, 9500, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Les essais sont cités. La durée ne l'est pas."),
    spec("depose_pipe", "wp_pipe", "Tuyauterie", "Dépose", 220, 7000, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Tâche citée sans quantité horaire."),
    spec("fab_pipe", "wp_pipe", "Tuyauterie", "Fabrication", 640, 7400, "USER_VERIFIED", "4", "3.2", "Appel d'offres", "Fabrication citée. Heures vérifiées pour la simulation."),
    spec("install_pipe", "wp_pipe", "Tuyauterie", "Installation", 360, 7400, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Installation citée sans heures dans le document."),
    spec("prep_paint", "wp_paint", "Peinture", "Préparation", 300, 5800, "AI_GENERATED", "5", "4.1", "Appel d'offres", "La durée de peinture n'est pas précisée. Ces heures sont une proposition."),
    spec("app_paint", "wp_paint", "Peinture", "Application", 500, 5800, "AI_GENERATED", "4", "3.2", "Appel d'offres", "Application citée. Heures non écrites dans le document."),
  ];

  const lines = specs.map((item) =>
    line({
      id: `line_${item.key}`,
      workPackageId: item.packageId,
      taskId: `task_${item.key}`,
      lot: item.lot,
      description: item.task,
      hours: item.hours,
      rateCents: item.rateCents,
      status: item.status,
      page: item.page,
      section: item.section,
      sourceLabel: item.sourceLabel,
      explanation: item.explanation,
      origins: item.origins,
      logisticsCents: item.logisticsCents,
      otherCents: item.otherCents,
    }),
  );

  const materials: MaterialCost[] = [
    {
      id: "mat_acier",
      estimateLineId: "line_plaques",
      supplierId: "sup_acier",
      description: "Tôles d'acier de coque — quantité provisoire",
      quantity: 100,
      unit: "t",
      unitPriceCents: 640_000,
      transportCents: 800_000,
      wasteCents: 200_000,
      },
    {
      id: "mat_meca",
      estimateLineId: "line_reparation",
      supplierId: null,
      description: "Pièces mécaniques de remplacement — fictives",
      quantity: 1,
      unit: "forfait",
      unitPriceCents: 18_000_000,
      transportCents: 300_000,
      wasteCents: 200_000,
    },
    {
      id: "mat_cables",
      estimateLineId: "line_cablage",
      supplierId: "sup_cables",
      description: "Câbles marine — fictifs",
      quantity: 1200,
      unit: "m",
      unitPriceCents: 7500,
      transportCents: 400_000,
      wasteCents: 200_000,
    },
    {
      id: "mat_pipe",
      estimateLineId: "line_fab_pipe",
      supplierId: null,
      description: "Tubes et raccords — fictifs",
      quantity: 180,
      unit: "m",
      unitPriceCents: 110_000,
      transportCents: 800_000,
      wasteCents: 400_000,
    },
    {
      id: "mat_paint",
      estimateLineId: "line_prep_paint",
      supplierId: "sup_peinture",
      description: "Revêtement — fictif",
      quantity: 400,
      unit: "L",
      unitPriceCents: 11_000,
      transportCents: 250_000,
      wasteCents: 150_000,
    },
  ];

  const equipment: EquipmentCost[] = [
    { id: "eq_decoupe", estimateLineId: "line_decoupe", name: "Équipement de découpe", quantity: 1, duration: 12, durationUnit: "jours", rateCents: 150_000, transportCents: 0 },
    { id: "eq_grue", estimateLineId: "line_plaques", name: "Grue mobile", quantity: 1, duration: 20, durationUnit: "jours", rateCents: 400_000, transportCents: 500_000 },
    { id: "eq_soudage", estimateLineId: "line_soudage", name: "Machines à souder", quantity: 4, duration: 15, durationUnit: "jours", rateCents: 70_000, transportCents: 0 },
    { id: "eq_manut", estimateLineId: "line_depose_meca", name: "Manutention", quantity: 1, duration: 10, durationUnit: "jours", rateCents: 320_000, transportCents: 400_000 },
  ];

  const quotes: SupplierQuote[] = [
    {
      id: "quote_acier",
      supplierId: "sup_acier",
      workPackageId: "wp_structure",
      priceCents: null,
      currency: "CAD",
      validUntil: null,
      leadTime: "Non reçu",
      included: "Tôles, selon nuance à confirmer",
      excluded: "Mise en forme, soudage",
      documentName: null,
      status: "REQUESTED",
    },
    {
      id: "quote_cables",
      supplierId: "sup_cables",
      workPackageId: "wp_elec",
      priceCents: 9_600_000,
      currency: "CAD",
      validUntil: "2026-11-30",
      leadTime: "4 semaines",
      included: "Câbles et tourets",
      excluded: "Pose et essais",
      documentName: "soumission-cables-fictive.pdf",
      status: "RECEIVED",
    },
    {
      id: "quote_peinture",
      supplierId: "sup_peinture",
      workPackageId: "wp_paint",
      priceCents: 4_800_000,
      currency: "CAD",
      validUntil: "2026-10-31",
      leadTime: "2 semaines",
      included: "Peinture",
      excluded: "Préparation de surface",
      documentName: "soumission-peinture-fictive.pdf",
      status: "TO_VERIFY",
    },
  ];

  const subcontractors: Subcontractor[] = [
    {
      id: "sub_ndt",
      workPackageId: "wp_structure",
      estimateLineId: "line_inspection",
      name: "Contrôle NDT — fictif",
      contact: "ndt.fictif@example.com",
      category: "Inspection",
      description: "Contrôle non destructif des soudures, périmètre fictif.",
      priceCents: 7_500_000,
      currency: "CAD",
      validUntil: "2026-12-15",
      leadTime: "Selon avancement",
      included: "Contrôle et rapport",
      excluded: "Réparations éventuelles",
      documentName: "offre-ndt-fictive.pdf",
      status: "RECEIVED",
    },
    {
      id: "sub_calo",
      workPackageId: "wp_paint",
      estimateLineId: "line_app_paint",
      name: "Calorifuge Quai — fictif",
      contact: "calo.fictif@example.com",
      category: "Calorifuge",
      description: "Dépose de calorifuge ancien, sous réserve du rapport amiante.",
      priceCents: 6_000_000,
      currency: "CAD",
      validUntil: null,
      leadTime: "À confirmer",
      included: "Dépose",
      excluded: "Traitement amiante s'il est confirmé",
      documentName: null,
      status: "TO_VERIFY",
    },
  ];

  const risks: Risk[] = [
    {
      id: "risk_delay",
      title: "Pénalités de retard",
      probability: "MEDIUM",
      impact: "HIGH",
      level: "HIGH",
      potentialCostCents: null,
      mitigation: "Confirmer le calendrier et le montant des pénalités avant soumission.",
      owner: "Morel",
      status: "OPEN",
      justification: "Des pénalités de retard s'appliquent si la date de fin n'est pas respectée. Le montant des pénalités n'est pas indiqué.",
      page: "7",
      section: "5.1",
      provenance: "DOCUMENT",
    },
    {
      id: "risk_asbestos",
      title: "Présence possible d'amiante",
      probability: "MEDIUM",
      impact: "HIGH",
      level: "HIGH",
      potentialCostCents: null,
      mitigation: "Obtenir un rapport d'analyse avant la dépose des calorifuges.",
      owner: "Morel",
      status: "OPEN",
      justification: "Le donneur d'ordre signale un doute sur la présence d'amiante dans certains calorifuges, sans rapport d'analyse.",
      page: "10",
      section: "8.1",
      provenance: "DOCUMENT",
    },
    {
      id: "risk_drydock",
      title: "Accès à la cale sèche non garanti",
      probability: "MEDIUM",
      impact: "MEDIUM",
      level: "MEDIUM",
      potentialCostCents: null,
      mitigation: "Prévoir une méthode de travail à quai ou une réserve de planning.",
      owner: "Morel",
      status: "OPEN",
      justification: "L'accès à la cale sèche n'est pas garanti pour toute la durée des travaux.",
      page: "9",
      section: "7.1",
      provenance: "DOCUMENT",
    },
  ];

  const assumptions: Assumption[] = [
    {
      id: "assum_availability",
      description: "L'estimation suppose que le navire sera disponible à la date prévue.",
      sourceLabel: "Hypothèse de l'estimateur. Le document dit que la date reste à confirmer.",
      page: "7",
      section: "5.1",
      potentialImpact: "Décalage du planning et exposition aux pénalités si la date n'est pas tenue.",
      status: "OPEN",
      provenance: "USER",
    },
    {
      id: "assum_weld",
      description: "Les 500 heures de soudage citées ont été portées à 620 heures.",
      sourceLabel: "DONNÉE UTILISATEUR. Base documentaire : section 4.1.",
      page: "5",
      section: "4.1",
      potentialImpact: "Le coût de soudage change directement avec les heures.",
      status: "ACCEPTED",
      provenance: "USER",
    },
    {
      id: "assum_rates",
      description: "Les taux horaires proviennent du barème de simulation, pas de l'appel d'offres.",
      sourceLabel: "Barème de simulation fictif",
      page: null,
      section: null,
      potentialImpact: "Tous les montants de main-d'œuvre suivent ces taux.",
      status: "ACCEPTED",
      provenance: "USER",
    },
  ];

  const missing: MissingInformation[] = [
    {
      id: "miss_steel",
      description: "Quantité exacte d'acier non spécifiée",
      importance: "CRITICAL",
      sourceLabel: "la quantité exacte d'acier n'est pas spécifiée",
      page: "5",
      section: "4.1",
      requiredAction: "Faire un relevé d'épaisseur ou obtenir la quantité de l'armateur.",
      status: "OPEN",
      note: "Une quantité provisoire de 100 t est saisie comme hypothèse, pas comme fait du document.",
    },
    {
      id: "miss_price",
      description: "Prix fournisseur non reçu",
      importance: "HIGH",
      sourceLabel: "Les prix des fournisseurs ne figurent pas dans ce document.",
      page: "10",
      section: "8.1",
      requiredAction: "Relancer Aciers du Large — fictif, et comparer le périmètre.",
      status: "OPEN",
      note: "",
    },
    {
      id: "miss_paint",
      description: "Durée exacte des travaux de peinture non précisée",
      importance: "MEDIUM",
      sourceLabel: "La durée exacte des travaux de peinture n'est pas précisée.",
      page: "5",
      section: "4.1",
      requiredAction: "Quantifier les surfaces avant de figer les heures de peinture.",
      status: "OPEN",
      note: "",
    },
    {
      id: "miss_asbestos",
      description: "Rapport d'analyse amiante absent",
      importance: "HIGH",
      sourceLabel: "sans rapport d'analyse",
      page: "10",
      section: "8.1",
      requiredAction: "Demander le rapport ou chiffrer une réserve explicite.",
      status: "OPEN",
      note: "",
    },
  ];

  const project: Project = {
    id: "proj_demo_reparation",
    name: "Réparation majeure – Navire Demo",
    client: "Client maritime fictif",
    vessel: "Navire Demo",
    type: "REPAIR",
    location: "Chantier fictif, port de simulation",
    receivedAt: "2026-08-12",
    submissionDeadline: "2026-10-15",
    plannedStart: "2026-11-03",
    plannedEnd: "2027-03-27",
    currency: "CAD",
    description: "Dossier fictif de formation. Réparation de coque, mécanique, électricité, tuyauterie et peinture. Aucune donnée réelle de chantier.",
    status: "IN_ESTIMATION",
    learningMode: true,
    contingencyPct: 8,
    overheadPct: 12,
    marginPct: 10,
    overtimeFactor: 1.5,
    validationNote: "",
    tender: {
      id: "tender_demo",
      title: "Appel d'offres fictif — Navire Demo",
      documents: [
        {
          id: "doc_demo",
          fileName: "appel-offres-demo.txt",
          mimeType: "text/plain",
          sizeBytes: new TextEncoder().encode(DEMO_TENDER_TEXT).length,
          pageCount: 10,
          storedPath: "",
          extractedText: DEMO_TENDER_TEXT,
          status: "COMPLETED",
          importedAt: "2026-08-12T15:30:00.000Z",
        },
      ],
    },
    analysis: nowAnalysis,
    workPackages: packages,
    lines,
    labor: lines.map((item) => labor(item.id, item.lot, tradeFor(item.lot), item.hours, item.hourlyRateCents)),
    materials,
    equipment,
    quotes,
    subcontractors,
    risks,
    assumptions,
    missing,
    reviews: [],
    messages: [],
    revisions: [],
    audit: [
      {
        id: "audit_demo_create",
        actor: "Morel",
        entity: "Estimation",
        summary: "Création du dossier fictif Réparation majeure – Navire Demo.",
        source: "USER",
        createdAt: "2026-08-12T15:40:00.000Z",
      },
      {
        id: "audit_demo_hours",
        actor: "Morel",
        entity: "Main-d'œuvre",
        summary: "Morel a modifié la main-d'œuvre du soudage : 500 h → 620 h.",
        source: "USER MODIFIED",
        createdAt: "2026-09-25T14:10:00.000Z",
      },
    ],
    createdAt: "2026-08-12T15:40:00.000Z",
    updatedAt: "2026-09-25T14:10:00.000Z",
  };

  project.revisions = [
    {
      id: "rev_demo_1",
      label: "Situation au 25 septembre 2026",
      snapshot: financialSummary(project),
      createdAt: "2026-09-25T14:12:00.000Z",
    },
  ];
  return project;
}

function packageOf(id: string, code: string, name: string, tasks: string[]): WorkPackage {
  return {
    id,
    name,
    code,
    sortOrder: Number(code),
    tasks: tasks.map((task, index) => ({
      id: `task_${taskKey(id, task)}`,
      name: task,
      description: "",
      sortOrder: index + 1,
    })),
  };
}

function taskKey(packageId: string, task: string): string {
  const map: Record<string, string> = {
    "wp_structure:Découpe": "decoupe",
    "wp_structure:Remplacement de plaques": "plaques",
    "wp_structure:Soudage": "soudage",
    "wp_structure:Inspection": "inspection",
    "wp_meca:Dépose équipement": "depose_meca",
    "wp_meca:Réparation": "reparation",
    "wp_meca:Installation": "install_meca",
    "wp_elec:Câblage": "cablage",
    "wp_elec:Installation": "install_elec",
    "wp_elec:Tests": "tests_elec",
    "wp_pipe:Dépose": "depose_pipe",
    "wp_pipe:Fabrication": "fab_pipe",
    "wp_pipe:Installation": "install_pipe",
    "wp_paint:Préparation": "prep_paint",
    "wp_paint:Application": "app_paint",
  };
  return map[`${packageId}:${task}`] ?? task;
}

function spec(
  key: string,
  packageId: string,
  lot: string,
  task: string,
  hours: number,
  rateCents: number,
  status: LineStatus,
  page: string,
  section: string,
  sourceLabel: string,
  explanation: string,
  origins: CostOrigins = userOrigins,
  logisticsCents = 0,
  otherCents = 0,
) {
  return { key, packageId, lot, task, hours, rateCents, status, page, section, sourceLabel, explanation, origins, logisticsCents, otherCents };
}

function aiHours(): CostOrigins {
  return { ...userOrigins, hours: "AI", rate: "USER" };
}

function tradeFor(lot: string): string {
  if (lot.startsWith("Structure")) return "Charpentier fer";
  if (lot.startsWith("Mécanique")) return "Mécanicien";
  if (lot.startsWith("Électricité")) return "Électricien";
  if (lot.startsWith("Tuyauterie")) return "Tuyauteur";
  return "Peintre";
}

function satellite(input: {
  id: string;
  name: string;
  client: string;
  vessel: string;
  type: ProjectType;
  status: ProjectStatus;
  updatedAt: string;
  hours: number;
  rateCents: number;
  materialsCents: number;
  lot: string;
  task: string;
  missing: number;
  risks: number;
}): Project {
  const lineId = `${input.id}_line`;
  const risks: Risk[] = Array.from({ length: input.risks }, (_, index) => ({
    id: `${input.id}_risk_${index + 1}`,
    title: index === 0 ? "Fenêtre d'accès au navire incertaine" : "Prix de spécialité non comparé",
    probability: "MEDIUM",
    impact: index === 0 ? "MEDIUM" : "LOW",
    level: index === 0 ? "MEDIUM" : "LOW",
    potentialCostCents: null,
    mitigation: "Confirmer la contrainte avant de figer le prix de simulation.",
    owner: "Morel",
    status: "OPEN",
    justification: "Constat de simulation, sans document d'appel d'offres associé.",
    page: null,
    section: null,
    provenance: "USER",
  }));
  const missing: MissingInformation[] = Array.from({ length: input.missing }, (_, index) => ({
    id: `${input.id}_missing_${index + 1}`,
    description: index === 0 ? "Plans non reçus pour ce dossier fictif" : "Délai d'approvisionnement non confirmé",
    importance: index === 0 ? "HIGH" : "MEDIUM",
    sourceLabel: "Dossier de simulation incomplet",
    page: null,
    section: null,
    requiredAction: "Obtenir la pièce ou écrire une hypothèse.",
    status: "OPEN",
    note: "",
  }));
  return {
    id: input.id,
    name: input.name,
    client: input.client,
    vessel: input.vessel,
    type: input.type,
    location: "Port de simulation",
    receivedAt: input.updatedAt.slice(0, 10),
    submissionDeadline: "2026-11-30",
    plannedStart: "2027-01-06",
    plannedEnd: "2027-04-30",
    currency: "CAD",
    description: "Dossier fictif utilisé pour le tableau de bord. Il ne représente aucun contrat réel.",
    status: input.status,
    learningMode: false,
    contingencyPct: 8,
    overheadPct: 12,
    marginPct: 10,
    overtimeFactor: 1.5,
    validationNote: input.status === "VALIDATED" ? "Validée pour la simulation de formation." : "",
    tender: null,
    analysis: null,
    workPackages: [
      {
        id: `${input.id}_wp`,
        name: input.lot,
        code: "01",
        sortOrder: 1,
        tasks: [{ id: `${input.id}_task`, name: input.task, description: "", sortOrder: 1 }],
      },
    ],
    lines: [
      {
        id: lineId,
        workPackageId: `${input.id}_wp`,
        taskId: `${input.id}_task`,
        lot: input.lot,
        description: input.task,
        quantity: input.hours,
        unit: "heures",
        hours: input.hours,
        hourlyRateCents: input.rateCents,
        materialsCents: input.materialsCents,
        equipmentCents: 0,
        subcontractCents: 0,
        logisticsCents: 0,
        otherCents: 0,
        sourceLabel: "Saisie de simulation",
        page: null,
        section: null,
        provenance: "USER",
        status: "USER_VERIFIED",
        explanation: "Poste fictif destiné au tableau de bord.",
        origins: userOrigins,
      },
    ],
    labor: [],
    materials: [],
    equipment: [],
    quotes: [],
    subcontractors: [],
    risks,
    assumptions: [],
    missing,
    reviews: [],
    messages: [],
    revisions: [],
    audit: [
      {
        id: `${input.id}_audit`,
        actor: "Morel",
        entity: "Estimation",
        summary: `Création du dossier fictif ${input.name}.`,
        source: "USER",
        createdAt: input.updatedAt,
      },
    ],
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
  };
}

export function buildRealDatabase(user: Database["user"], settings: AppSettings): Database {
  return {
    user,
    settings,
    suppliers: [],
    projects: [],
  };
}

export function buildDemoDatabase(passwordHash: string): Database {
  const analysis = groundAnalysis(
    DEMO_TENDER_TEXT,
    heuristicAnalysis(DEMO_TENDER_TEXT, "2026-08-12T15:45:00.000Z"),
  );
  return {
    user: {
      id: "user_morel",
      name: "Morel",
      email: "morel@navalsmart.local",
      passwordHash,
      role: "ESTIMATOR",
      jobTitle: "Coordonnateur de projets",
      companyName: "Atelier maritime fictif",
    },
    settings: defaultSettings(),
    suppliers,
    projects: [
      buildDemoProject(analysis),
      satellite({
        id: "proj_atlas",
        name: "Conversion de citerne – Navire Atlas",
        client: "Armateur fictif Atlas",
        vessel: "Navire Atlas",
        type: "CONVERSION",
        status: "TO_VALIDATE",
        updatedAt: "2026-09-18T11:00:00.000Z",
        hours: 5000,
        rateCents: 8000,
        materialsCents: 140_000_000,
        lot: "Conversion",
        task: "Transformation des citernes",
        missing: 2,
        risks: 2,
      }),
      satellite({
        id: "proj_borealis",
        name: "Maintenance quinquennale – Navire Boréalis",
        client: "Armateur fictif Boréal",
        vessel: "Navire Boréalis",
        type: "MAINTENANCE",
        status: "IN_ESTIMATION",
        updatedAt: "2026-08-20T11:00:00.000Z",
        hours: 2200,
        rateCents: 7000,
        materialsCents: 54_600_000,
        lot: "Maintenance",
        task: "Arrêt quinquennal",
        missing: 1,
        risks: 1,
      }),
      satellite({
        id: "proj_crios",
        name: "Travaux électriques – Navire Crios",
        client: "Armateur fictif Crios",
        vessel: "Navire Crios",
        type: "ELECTRICAL",
        status: "IN_ANALYSIS",
        updatedAt: "2026-07-14T11:00:00.000Z",
        hours: 1600,
        rateCents: 7500,
        materialsCents: 36_000_000,
        lot: "Électricité",
        task: "Remplacement de tableaux",
        missing: 2,
        risks: 1,
      }),
      satellite({
        id: "proj_delta",
        name: "Construction de barge – Navire Delta",
        client: "Armateur fictif Delta",
        vessel: "Navire Delta",
        type: "CONSTRUCTION",
        status: "VALIDATED",
        updatedAt: "2026-06-02T11:00:00.000Z",
        hours: 8000,
        rateCents: 7600,
        materialsCents: 89_200_000,
        lot: "Coque",
        task: "Construction de la coque",
        missing: 0,
        risks: 1,
      }),
      satellite({
        id: "proj_elara",
        name: "Remplacement de grue – Navire Elara",
        client: "Armateur fictif Elara",
        vessel: "Navire Elara",
        type: "MECHANICAL",
        status: "TO_VALIDATE",
        updatedAt: "2026-08-28T11:00:00.000Z",
        hours: 900,
        rateCents: 8200,
        materialsCents: 27_620_000,
        lot: "Appareil de levage",
        task: "Remplacement de la grue",
        missing: 1,
        risks: 1,
      }),
      satellite({
        id: "proj_fjord",
        name: "Carénage – Navire Fjord",
        client: "Armateur fictif Fjord",
        vessel: "Navire Fjord",
        type: "MAINTENANCE",
        status: "DRAFT",
        updatedAt: "2026-04-16T11:00:00.000Z",
        hours: 600,
        rateCents: 6000,
        materialsCents: 8_400_000,
        lot: "Carène",
        task: "Préparation de carène",
        missing: 1,
        risks: 0,
      }),
      satellite({
        id: "proj_ganymede",
        name: "Réfection de la timonerie – Navire Ganymède",
        client: "Armateur fictif Ganymède",
        vessel: "Navire Ganymède",
        type: "REPAIR",
        status: "IN_ESTIMATION",
        updatedAt: "2026-05-21T11:00:00.000Z",
        hours: 1100,
        rateCents: 7200,
        materialsCents: 18_080_000,
        lot: "Timonerie",
        task: "Réfection intérieure",
        missing: 1,
        risks: 1,
      }),
    ],
  };
}

export function emptyProject(input: {
  id: string;
  name: string;
  client: string;
  vessel: string;
  type: ProjectType;
  location: string;
  receivedAt: string | null;
  submissionDeadline: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  currency: string;
  description: string;
  learningMode: boolean;
  settings: AppSettings;
  now: string;
}): Project {
  return {
    id: input.id,
    name: input.name,
    client: input.client,
    vessel: input.vessel,
    type: input.type,
    location: input.location,
    receivedAt: input.receivedAt,
    submissionDeadline: input.submissionDeadline,
    plannedStart: input.plannedStart,
    plannedEnd: input.plannedEnd,
    currency: input.currency,
    description: input.description,
    status: "DRAFT",
    learningMode: input.learningMode,
    contingencyPct: input.settings.contingencyPct,
    overheadPct: input.settings.overheadPct,
    marginPct: input.settings.marginPct,
    overtimeFactor: input.settings.overtimeFactor,
    validationNote: "",
    tender: null,
    analysis: null,
    workPackages: [],
    lines: [],
    labor: [],
    materials: [],
    equipment: [],
    quotes: [],
    subcontractors: [],
    risks: [],
    assumptions: [],
    missing: [],
    reviews: [],
    messages: [],
    revisions: [],
    audit: [
      {
        id: `audit_${input.id}`,
        actor: "Morel",
        entity: "Estimation",
        summary: `Création de l'estimation ${input.name}.`,
        source: "USER",
        createdAt: input.now,
      },
    ],
    createdAt: input.now,
    updatedAt: input.now,
  };
}
