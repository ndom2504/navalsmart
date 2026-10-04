export type SkillLevel = "SKILLED" | "SEMI" | "UNSKILLED" | "SUPERVISION";

/** Année des valeurs du référentiel de marché. */
export const MARKET_YEAR = 2025;

/** Dollars canadiens pour une unité de devise : taux indicatifs moyens de l'année du référentiel. */
export const CAD_PER_UNIT: Record<string, number> = {
  CAD: 1,
  USD: 1.38,
  EUR: 1.5,
  AED: 0.376,
  QAR: 0.379,
  SAR: 0.368,
  KWD: 4.5,
  OMR: 3.58,
  BHD: 3.66,
  MAD: 0.137,
  DZD: 0.0103,
  TND: 0.44,
  EGP: 0.028,
  XOF: 0.00229,
  XAF: 0.00229,
  NGN: 0.00089,
  GHS: 0.092,
  KES: 0.0107,
  ZAR: 0.075,
};

/** Devises proposées pour un projet : celles des marchés du référentiel. */
export const PROJECT_CURRENCIES: { code: string; label: string }[] = [
  { code: "CAD", label: "CAD — dollar canadien" },
  { code: "USD", label: "USD — dollar américain" },
  { code: "EUR", label: "EUR — euro" },
  { code: "AED", label: "AED — dirham des Émirats" },
  { code: "QAR", label: "QAR — riyal qatarien" },
  { code: "SAR", label: "SAR — riyal saoudien" },
  { code: "MAD", label: "MAD — dirham marocain" },
  { code: "DZD", label: "DZD — dinar algérien" },
  { code: "TND", label: "TND — dinar tunisien" },
  { code: "EGP", label: "EGP — livre égyptienne" },
  { code: "XOF", label: "XOF — franc CFA (Afrique de l'Ouest)" },
  { code: "XAF", label: "XAF — franc CFA (Afrique centrale)" },
  { code: "NGN", label: "NGN — naira" },
  { code: "GHS", label: "GHS — cedi" },
  { code: "KES", label: "KES — shilling kényan" },
  { code: "ZAR", label: "ZAR — rand" },
];

export interface MarketRegion {
  code: string;
  label: string;
  currency: string;
  /** Coût de la main-d'œuvre par niveau de qualification, rapporté au Québec. */
  laborIndex: Record<SkillLevel, number>;
  /** Matériaux et équipement, rapportés au Québec (en dollars canadiens). */
  costIndex: number;
  /** Multiplicateur des heures par unité (climat, organisation du travail). */
  productivityFactor: number;
  basis: string;
  pattern: RegExp;
}

const GULF_BASIS = "Coût horaire indicatif d'une main-d'œuvre expatriée : salaire, hébergement, transport, visa et assurance compris. L'encadrement expatrié qualifié coûte nettement plus. Productivité réduite par la chaleur et l'arrêt des travaux extérieurs à la mi-journée en été.";

const AFRICA_BASIS = "Coût horaire chargé indicatif de la main-d'œuvre locale : salaire de marché ou minimum conventionnel du BTP, charges sociales, primes et transport compris. L'encadrement qualifié, souvent expatrié, coûte nettement plus. L'indice des matériaux et de l'équipement comprend importation, droits et acheminement. Productivité réduite sur les chantiers à forte main-d'œuvre et en saison des pluies.";

export const MARKET_REGIONS: MarketRegion[] = [
  {
    code: "CA-QC",
    label: "Canada — Québec",
    currency: "CAD",
    laborIndex: { SKILLED: 1, SEMI: 1, UNSKILLED: 1, SUPERVISION: 1 },
    costIndex: 1,
    productivityFactor: 1,
    basis: "Taux horaires chargés indicatifs : salaires des conventions collectives de la construction, avantages sociaux et charges de l'employeur compris, hors frais généraux et profit.",
    pattern: /\b(quebec|montreal|laval|gatineau|sherbrooke|saguenay|trois-rivieres|levis|rimouski|sept-iles|baie-comeau|becancour|sorel)\b/,
  },
  {
    code: "CA-AB",
    label: "Canada — Alberta",
    currency: "CAD",
    laborIndex: { SKILLED: 1.1, SEMI: 1.08, UNSKILLED: 1.05, SUPERVISION: 1.12 },
    costIndex: 1.05,
    productivityFactor: 1,
    basis: "Taux horaires chargés indicatifs du marché albertain (syndiqué et ouvert), avantages et charges compris, primes de chantier éloigné et pension exclues.",
    pattern: /\b(alberta|calgary|edmonton|fort mcmurray|red deer|lethbridge|grande prairie|medicine hat|cold lake)\b/,
  },
  {
    code: "CA-ON",
    label: "Canada — Ontario",
    currency: "CAD",
    laborIndex: { SKILLED: 1.06, SEMI: 1.04, UNSKILLED: 1.02, SUPERVISION: 1.06 },
    costIndex: 1.03,
    productivityFactor: 1,
    basis: "Taux horaires chargés indicatifs des conventions collectives ontariennes, avantages et charges compris, hors frais généraux et profit.",
    pattern: /\b(ontario|toronto|ottawa|hamilton|mississauga|windsor|sudbury|thunder bay|kingston|sault ste marie)\b/,
  },
  {
    code: "CA-BC",
    label: "Canada — Colombie-Britannique",
    currency: "CAD",
    laborIndex: { SKILLED: 1.08, SEMI: 1.06, UNSKILLED: 1.04, SUPERVISION: 1.08 },
    costIndex: 1.08,
    productivityFactor: 1,
    basis: "Taux horaires chargés indicatifs du marché britanno-colombien, avantages et charges compris, hors frais généraux et profit.",
    pattern: /\b(colombie-britannique|british columbia|vancouver|victoria|surrey|kelowna|prince george|prince rupert|kitimat|nanaimo)\b/,
  },
  {
    code: "CA-ATL",
    label: "Canada — Provinces atlantiques",
    currency: "CAD",
    laborIndex: { SKILLED: 0.85, SEMI: 0.85, UNSKILLED: 0.85, SUPERVISION: 0.88 },
    costIndex: 1,
    productivityFactor: 1,
    basis: "Taux horaires chargés indicatifs du Nouveau-Brunswick, de la Nouvelle-Écosse, de l'Île-du-Prince-Édouard et de Terre-Neuve-et-Labrador, avantages et charges compris.",
    pattern: /\b(nouveau-brunswick|new brunswick|nouvelle-ecosse|nova scotia|terre-neuve|newfoundland|labrador|ile-du-prince-edouard|prince edward island|halifax|dartmouth|moncton|saint john|fredericton|st\.? john's|charlottetown|sydney)\b/,
  },
  {
    code: "FR",
    label: "France",
    currency: "EUR",
    laborIndex: { SKILLED: 0.88, SEMI: 0.86, UNSKILLED: 0.92, SUPERVISION: 0.86 },
    costIndex: 1.05,
    productivityFactor: 1,
    basis: "Coût employeur horaire indicatif : grilles conventionnelles du BTP et de la métallurgie, charges patronales comprises, hors frais généraux et marge.",
    pattern: /\b(france|paris|marseille|lyon|toulouse|nantes|bordeaux|lille|brest|toulon|saint-nazaire|le havre|cherbourg|lorient|dunkerque|rouen|la rochelle)\b/,
  },
  {
    code: "US",
    label: "États-Unis",
    currency: "USD",
    laborIndex: { SKILLED: 0.92, SEMI: 0.9, UNSKILLED: 0.85, SUPERVISION: 0.98 },
    costIndex: 0.92,
    productivityFactor: 1,
    basis: "Coût horaire chargé indicatif du marché ouvert (salaires de marché, avantages et charges compris). Les chantiers syndiqués ou soumis au « prevailing wage » coûtent davantage.",
    pattern: /\b(etats-unis|usa|united states|texas|houston|california|californie|florida|floride|new york|louisiane|louisiana|alaska|maine|virginia|virginie|seattle|boston|chicago|new jersey|pennsylvania)\b/,
  },
  {
    code: "AE",
    label: "Émirats arabes unis (Dubaï, Abou Dabi)",
    currency: "AED",
    laborIndex: { SKILLED: 0.16, SEMI: 0.14, UNSKILLED: 0.11, SUPERVISION: 0.43 },
    costIndex: 0.8,
    productivityFactor: 1.2,
    basis: GULF_BASIS,
    pattern: /\b(dubai|dubaï|abu dhabi|abou dabi|emirats|uae|sharjah|ajman|fujairah|ras al[- ]khaimah|jebel ali)\b/,
  },
  {
    code: "QA",
    label: "Qatar",
    currency: "QAR",
    laborIndex: { SKILLED: 0.16, SEMI: 0.14, UNSKILLED: 0.11, SUPERVISION: 0.45 },
    costIndex: 0.9,
    productivityFactor: 1.2,
    basis: GULF_BASIS,
    pattern: /\b(qatar|doha|lusail|ras laffan|al wakrah|mesaieed)\b/,
  },
  {
    code: "SA",
    label: "Arabie saoudite",
    currency: "SAR",
    laborIndex: { SKILLED: 0.15, SEMI: 0.13, UNSKILLED: 0.1, SUPERVISION: 0.42 },
    costIndex: 0.78,
    productivityFactor: 1.2,
    basis: GULF_BASIS,
    pattern: /\b(arabie saoudite|saudi|riyad|riyadh|djeddah|jeddah|dammam|neom|jubail|yanbu|khobar)\b/,
  },
  {
    code: "GCC",
    label: "Autres pays du Golfe (Koweït, Oman, Bahreïn)",
    currency: "USD",
    laborIndex: { SKILLED: 0.15, SEMI: 0.13, UNSKILLED: 0.1, SUPERVISION: 0.42 },
    costIndex: 0.85,
    productivityFactor: 1.2,
    basis: GULF_BASIS,
    pattern: /\b(koweit|kuwait|oman|mascate|muscat|sohar|duqm|bahrein|bahrain|manama)\b/,
  },
  {
    code: "MA",
    label: "Maroc",
    currency: "MAD",
    laborIndex: { SKILLED: 0.1, SEMI: 0.08, UNSKILLED: 0.055, SUPERVISION: 0.24 },
    costIndex: 0.85,
    productivityFactor: 1.25,
    basis: `${AFRICA_BASIS} Référence : SMIG du BTP et salaires de marché des grands chantiers portuaires et industriels.`,
    pattern: /\b(maroc|morocco|casablanca|rabat|tanger|tangier|agadir|marrakech|kenitra|jorf lasfar|nador|mohammedia|safi|el jadida|dakhla|laayoune)\b/,
  },
  {
    code: "DZ",
    label: "Algérie",
    currency: "DZD",
    laborIndex: { SKILLED: 0.08, SEMI: 0.065, UNSKILLED: 0.045, SUPERVISION: 0.22 },
    costIndex: 0.85,
    productivityFactor: 1.3,
    basis: `${AFRICA_BASIS} Référence : SNMG et grilles du BTP, charges CNAS comprises.`,
    pattern: /\b(algerie|algeria|alger|algiers|oran|constantine|annaba|bejaia|skikda|arzew|hassi messaoud|djen djen|setif|blida)\b/,
  },
  {
    code: "TN",
    label: "Tunisie",
    currency: "TND",
    laborIndex: { SKILLED: 0.08, SEMI: 0.065, UNSKILLED: 0.045, SUPERVISION: 0.2 },
    costIndex: 0.85,
    productivityFactor: 1.25,
    basis: `${AFRICA_BASIS} Référence : convention collective du BTP, charges CNSS comprises.`,
    pattern: /\b(tunisie|tunisia|tunis|sfax|sousse|bizerte|gabes|rades|zarzis|monastir|enfidha)\b/,
  },
  {
    code: "EG",
    label: "Égypte",
    currency: "EGP",
    laborIndex: { SKILLED: 0.05, SEMI: 0.04, UNSKILLED: 0.03, SUPERVISION: 0.18 },
    costIndex: 0.75,
    productivityFactor: 1.3,
    basis: `${AFRICA_BASIS} Valeurs sensibles au taux de change de la livre égyptienne.`,
    pattern: /\b(egypte|egypt|le caire|cairo|alexandrie|alexandria|port[- ]?said|suez|ain sokhna|damiette|damietta|ismailia|hurghada|nouvelle capitale administrative)\b/,
  },
  {
    code: "UEMOA",
    label: "Afrique de l'Ouest francophone (Sénégal, Côte d'Ivoire, Mali, Burkina Faso, Bénin, Togo, Niger, Guinée, Mauritanie)",
    currency: "XOF",
    laborIndex: { SKILLED: 0.06, SEMI: 0.045, UNSKILLED: 0.03, SUPERVISION: 0.35 },
    costIndex: 1.15,
    productivityFactor: 1.4,
    basis: `${AFRICA_BASIS} Référence : SMIG et conventions du BTP des pays de l'UEMOA ; matériaux en grande partie importés par Dakar, Abidjan, Lomé ou Cotonou.`,
    pattern: /\b(senegal|dakar|thies|cote d.ivoire|ivory coast|abidjan|san[- ]pedro|yamoussoukro|mali|bamako|burkina|ouagadougou|bobo[- ]dioulasso|benin|cotonou|porto[- ]novo|togo|lome|(?<!delta du )niger(?! delta)|niamey|guinee[- ]bissau|bissau|guinee(?![- ]equatoriale)|conakry|kamsar|mauritanie|mauritania|nouakchott|nouadhibou)\b/,
  },
  {
    code: "CEMAC",
    label: "Afrique centrale (Cameroun, Gabon, Congo, Tchad, Centrafrique, Guinée équatoriale)",
    currency: "XAF",
    laborIndex: { SKILLED: 0.065, SEMI: 0.05, UNSKILLED: 0.035, SUPERVISION: 0.38 },
    costIndex: 1.25,
    productivityFactor: 1.4,
    basis: `${AFRICA_BASIS} Logistique d'acheminement élevée vers l'intérieur et les sites pétroliers ; encadrement souvent expatrié.`,
    pattern: /\b(cameroun|cameroon|douala|yaounde|kribi|limbe|gabon|libreville|port[- ]gentil|owendo|brazzaville|pointe[- ]noire|republique du congo|congo[- ]brazzaville|tchad|chad|n.?djamena|centrafrique|central african|bangui|guinee[- ]equatoriale|equatorial guinea|malabo)\b/,
  },
  {
    code: "NG",
    label: "Nigéria",
    currency: "NGN",
    laborIndex: { SKILLED: 0.05, SEMI: 0.035, UNSKILLED: 0.025, SUPERVISION: 0.35 },
    costIndex: 1.05,
    productivityFactor: 1.4,
    basis: `${AFRICA_BASIS} Valeurs sensibles au taux de change du naira ; sûreté des sites du delta du Niger non comprise.`,
    pattern: /\b(nigeria|delta du niger|niger delta|lagos|lekki|abuja|port harcourt|onne|warri|calabar|bonny|kano|kaduna|ibadan|escravos)\b/,
  },
  {
    code: "GH",
    label: "Ghana",
    currency: "GHS",
    laborIndex: { SKILLED: 0.06, SEMI: 0.045, UNSKILLED: 0.03, SUPERVISION: 0.32 },
    costIndex: 1.05,
    productivityFactor: 1.35,
    basis: `${AFRICA_BASIS} Référence : salaire minimum national et conventions du secteur de la construction.`,
    pattern: /\b(ghana|accra|tema|takoradi|sekondi|kumasi)\b/,
  },
  {
    code: "EAC",
    label: "Afrique de l'Est (Kenya, Tanzanie, Ouganda, Rwanda, Éthiopie, Djibouti)",
    currency: "KES",
    laborIndex: { SKILLED: 0.055, SEMI: 0.04, UNSKILLED: 0.028, SUPERVISION: 0.3 },
    costIndex: 1.05,
    productivityFactor: 1.35,
    basis: `${AFRICA_BASIS} Valeurs exprimées en shillings kényans ; matériaux importés par Mombasa, Dar es Salaam ou Djibouti.`,
    pattern: /\b(kenya|nairobi|mombasa|lamu|tanzanie|tanzania|dar es salaam|dodoma|tanga|ouganda|uganda|kampala|rwanda|kigali|ethiopie|ethiopia|addis[- ]abeba|addis ababa|djibouti|doraleh)\b/,
  },
  {
    code: "ZA",
    label: "Afrique du Sud",
    currency: "ZAR",
    laborIndex: { SKILLED: 0.18, SEMI: 0.13, UNSKILLED: 0.09, SUPERVISION: 0.38 },
    costIndex: 0.85,
    productivityFactor: 1.15,
    basis: "Coût horaire chargé indicatif : conventions du Bargaining Council de la construction et de la métallurgie (MEIBC), cotisations comprises, hors frais généraux et marge. Matériaux en grande partie produits localement.",
    pattern: /\b(afrique du sud|south africa|johannesburg|pretoria|le cap|cape town|durban|port elizabeth|gqeberha|richards bay|saldanha|ngqura|coega|east london|mossel bay)\b/,
  },
  {
    code: "AFC",
    label: "Afrique centrale et australe (RD Congo, Angola, Mozambique, Zambie)",
    currency: "USD",
    laborIndex: { SKILLED: 0.07, SEMI: 0.05, UNSKILLED: 0.035, SUPERVISION: 0.42 },
    costIndex: 1.3,
    productivityFactor: 1.45,
    basis: `${AFRICA_BASIS} Marchés en grande partie facturés en dollars américains ; sites miniers et pétroliers éloignés, logistique et sûreté coûteuses.`,
    pattern: /\b(rdc|rd congo|republique democratique du congo|kinshasa|lubumbashi|matadi|kolwezi|angola|luanda|lobito|soyo|mozambique|maputo|beira|nacala|zambie|zambia|lusaka|ndola|kitwe)\b/,
  },
];

const CURRENCY_REGION: Record<string, string> = {
  EUR: "FR",
  USD: "US",
  AED: "AE",
  QAR: "QA",
  SAR: "SA",
  KWD: "GCC",
  OMR: "GCC",
  BHD: "GCC",
  MAD: "MA",
  DZD: "DZ",
  TND: "TN",
  EGP: "EG",
  XOF: "UEMOA",
  XAF: "CEMAC",
  NGN: "NG",
  GHS: "GH",
  KES: "EAC",
  ZAR: "ZA",
};

export function marketRegion(code: string | null | undefined): MarketRegion | null {
  return MARKET_REGIONS.find((region) => region.code === code) ?? null;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Marché déduit du lieu des travaux, puis de la devise ; null quand rien ne l'indique. */
export function detectMarketRegion(location: string, currency?: string | null): string | null {
  const folded = fold(location);
  const byPlace = MARKET_REGIONS.find((region) => region.pattern.test(folded));
  if (byPlace) return byPlace.code;
  return currency ? CURRENCY_REGION[currency] ?? null : null;
}
