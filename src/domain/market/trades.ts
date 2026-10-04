import type { SkillLevel } from "@/domain/market/regions";

export type WorkCategory = "NAVAL" | "CIVIL" | "BUILDING" | "INDUSTRIAL" | "LINEAR";

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  NAVAL: "Naval",
  CIVIL: "Génie civil et routier",
  BUILDING: "Bâtiment",
  INDUSTRIAL: "Industriel",
  LINEAR: "Linéaire, ponts et réseaux",
};

export interface MarketTrade {
  trade: string;
  skill: SkillLevel;
  /** Taux horaire chargé de référence au Québec, en dollars canadiens. */
  baseCad: number;
  categories: WorkCategory[];
}

export const MARKET_TRADES: MarketTrade[] = [
  { trade: "Soudeur", skill: "SKILLED", baseCad: 82, categories: ["NAVAL", "INDUSTRIAL", "LINEAR"] },
  { trade: "Charpentier fer", skill: "SKILLED", baseCad: 84, categories: ["NAVAL"] },
  { trade: "Mécanicien", skill: "SKILLED", baseCad: 86, categories: ["NAVAL"] },
  { trade: "Électricien", skill: "SKILLED", baseCad: 85, categories: ["NAVAL", "BUILDING", "INDUSTRIAL"] },
  { trade: "Tuyauteur", skill: "SKILLED", baseCad: 87, categories: ["NAVAL", "INDUSTRIAL"] },
  { trade: "Peintre", skill: "SEMI", baseCad: 72, categories: ["NAVAL", "BUILDING", "INDUSTRIAL"] },
  { trade: "Inspecteur", skill: "SUPERVISION", baseCad: 95, categories: ["NAVAL", "INDUSTRIAL"] },
  { trade: "Manutentionnaire", skill: "UNSKILLED", baseCad: 62, categories: ["NAVAL", "INDUSTRIAL"] },
  { trade: "Menuisier aménageur", skill: "SKILLED", baseCad: 78, categories: ["NAVAL"] },
  { trade: "Opérateur d'engins", skill: "SKILLED", baseCad: 84, categories: ["CIVIL", "LINEAR"] },
  { trade: "Manœuvre", skill: "UNSKILLED", baseCad: 62, categories: ["CIVIL", "BUILDING", "LINEAR"] },
  { trade: "Camionneur", skill: "SEMI", baseCad: 68, categories: ["CIVIL", "LINEAR"] },
  { trade: "Paveur", skill: "SEMI", baseCad: 70, categories: ["CIVIL"] },
  { trade: "Poseur de conduites", skill: "SEMI", baseCad: 74, categories: ["CIVIL", "LINEAR"] },
  { trade: "Monteur de signalisation", skill: "SEMI", baseCad: 66, categories: ["CIVIL"] },
  { trade: "Charpentier-menuisier", skill: "SKILLED", baseCad: 80, categories: ["BUILDING"] },
  { trade: "Coffreur", skill: "SKILLED", baseCad: 80, categories: ["BUILDING", "LINEAR"] },
  { trade: "Ferrailleur", skill: "SKILLED", baseCad: 82, categories: ["BUILDING", "LINEAR"] },
  { trade: "Cimentier-applicateur", skill: "SKILLED", baseCad: 76, categories: ["BUILDING", "CIVIL", "LINEAR"] },
  { trade: "Maçon", skill: "SKILLED", baseCad: 80, categories: ["BUILDING"] },
  { trade: "Plombier", skill: "SKILLED", baseCad: 86, categories: ["BUILDING"] },
  { trade: "Mécanicien en ventilation", skill: "SKILLED", baseCad: 88, categories: ["BUILDING"] },
  { trade: "Couvreur", skill: "SKILLED", baseCad: 76, categories: ["BUILDING"] },
  { trade: "Monteur d'acier de structure", skill: "SKILLED", baseCad: 88, categories: ["BUILDING", "INDUSTRIAL", "LINEAR"] },
  { trade: "Mécanicien de chantier", skill: "SKILLED", baseCad: 88, categories: ["INDUSTRIAL"] },
  { trade: "Instrumentiste", skill: "SKILLED", baseCad: 90, categories: ["INDUSTRIAL"] },
  { trade: "Grutier", skill: "SKILLED", baseCad: 92, categories: ["BUILDING", "INDUSTRIAL", "LINEAR"] },
  { trade: "Chaudronnier", skill: "SKILLED", baseCad: 86, categories: ["INDUSTRIAL"] },
  { trade: "Monteur de lignes", skill: "SKILLED", baseCad: 92, categories: ["LINEAR"] },
  { trade: "Arpenteur", skill: "SEMI", baseCad: 80, categories: ["CIVIL", "LINEAR", "BUILDING"] },
  { trade: "Contremaître", skill: "SUPERVISION", baseCad: 105, categories: ["NAVAL", "CIVIL", "BUILDING", "INDUSTRIAL", "LINEAR"] },
];
