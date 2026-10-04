import type { WorkCategory } from "@/domain/market/trades";

export interface MarketActivity {
  id: string;
  name: string;
  category: WorkCategory;
  unit: string;
  trade: string;
  /** Les plus précis d'abord : à égalité de mots-clés, le premier ouvrage l'emporte. */
  keywords: string[];
  /** Heures de main-d'œuvre de l'équipe par unité, au Québec. */
  hoursPerUnit: number;
  /** Dollars canadiens par unité, au Québec. */
  materials: number;
  equipment: number;
  /** Forfait chiffré en pourcentage des coûts directs des autres lignes. */
  percentOfDirect?: number;
}

export const MARKET_ACTIVITIES: MarketActivity[] = [
  // Génie civil et routier
  { id: "civ-deboisement", name: "Déboisement et essouchement", category: "CIVIL", unit: "ha", trade: "Opérateur d'engins", keywords: ["deboisement", "essouchement", "defrichage", "abattage"], hoursPerUnit: 60, materials: 0, equipment: 4500 },
  { id: "civ-decapage-m2", name: "Décapage de la terre végétale", category: "CIVIL", unit: "m²", trade: "Opérateur d'engins", keywords: ["decapage", "terre vegetale"], hoursPerUnit: 0.01, materials: 0, equipment: 1.2 },
  { id: "civ-decapage-m3", name: "Décapage de la terre végétale", category: "CIVIL", unit: "m³", trade: "Opérateur d'engins", keywords: ["decapage", "terre vegetale"], hoursPerUnit: 0.04, materials: 0, equipment: 5 },
  { id: "civ-roc", name: "Excavation de roc (forage et sautage)", category: "CIVIL", unit: "m³", trade: "Opérateur d'engins", keywords: ["excavation de roc", "roc", "dynamitage", "sautage"], hoursPerUnit: 0.15, materials: 8, equipment: 18 },
  { id: "civ-excavation", name: "Excavation de masse et terrassement", category: "CIVIL", unit: "m³", trade: "Opérateur d'engins", keywords: ["excavation", "terrassement", "deblai", "nivellement"], hoursPerUnit: 0.05, materials: 0, equipment: 6.5 },
  { id: "civ-remblai-m3", name: "Remblai et fondation granulaire", category: "CIVIL", unit: "m³", trade: "Opérateur d'engins", keywords: ["remblai", "fondation granulaire", "sous fondation", "granulaire", "mg 20", "mg 56", "compactage"], hoursPerUnit: 0.06, materials: 35, equipment: 5 },
  { id: "civ-remblai-t", name: "Remblai et fondation granulaire", category: "CIVIL", unit: "t", trade: "Opérateur d'engins", keywords: ["remblai", "fondation granulaire", "sous fondation", "granulaire", "granulat", "mg 20", "mg 56"], hoursPerUnit: 0.03, materials: 18, equipment: 2.5 },
  { id: "civ-enrobe-t", name: "Revêtement en enrobé bitumineux", category: "CIVIL", unit: "t", trade: "Paveur", keywords: ["enrobe", "bitum", "asphalt", "chaussee", "pavage", "revetement bitumineux"], hoursPerUnit: 0.13, materials: 115, equipment: 12 },
  { id: "civ-enrobe-m2", name: "Revêtement en enrobé bitumineux (50 mm)", category: "CIVIL", unit: "m²", trade: "Paveur", keywords: ["enrobe", "bitum", "asphalt", "chaussee", "pavage", "revetement bitumineux"], hoursPerUnit: 0.02, materials: 14, equipment: 1.6 },
  { id: "civ-ponceau", name: "Drainage et ponceaux (conduites en tranchée)", category: "CIVIL", unit: "m", trade: "Poseur de conduites", keywords: ["drainage", "ponceau", "conduite pluviale", "drain"], hoursPerUnit: 1.5, materials: 180, equipment: 60 },
  { id: "civ-fosse", name: "Fossés de drainage", category: "CIVIL", unit: "m", trade: "Opérateur d'engins", keywords: ["fosse", "fosses"], hoursPerUnit: 0.05, materials: 0, equipment: 4 },
  { id: "civ-marquage-km", name: "Marquage routier", category: "CIVIL", unit: "km", trade: "Monteur de signalisation", keywords: ["marquage", "ligne de rive", "ligne axiale"], hoursPerUnit: 6, materials: 900, equipment: 600 },
  { id: "civ-marquage-m", name: "Marquage routier", category: "CIVIL", unit: "m", trade: "Monteur de signalisation", keywords: ["marquage", "ligne de rive", "ligne axiale"], hoursPerUnit: 0.006, materials: 0.9, equipment: 0.6 },
  { id: "civ-glissiere", name: "Glissières de sécurité", category: "CIVIL", unit: "m", trade: "Monteur de signalisation", keywords: ["glissiere", "garde fou", "barriere de securite"], hoursPerUnit: 0.3, materials: 85, equipment: 15 },
  { id: "civ-panneau", name: "Signalisation permanente (panneaux)", category: "CIVIL", unit: "unité", trade: "Monteur de signalisation", keywords: ["panneau", "signalisation permanente", "signalisation"], hoursPerUnit: 2, materials: 450, equipment: 80 },
  { id: "civ-bordure", name: "Bordures de béton", category: "CIVIL", unit: "m", trade: "Cimentier-applicateur", keywords: ["bordure"], hoursPerUnit: 0.4, materials: 35, equipment: 8 },
  { id: "civ-trottoir", name: "Trottoirs en béton", category: "CIVIL", unit: "m²", trade: "Cimentier-applicateur", keywords: ["trottoir"], hoursPerUnit: 0.8, materials: 75, equipment: 10 },
  { id: "civ-geotextile", name: "Géotextile", category: "CIVIL", unit: "m²", trade: "Manœuvre", keywords: ["geotextile"], hoursPerUnit: 0.01, materials: 2.5, equipment: 0.3 },
  { id: "civ-ensemencement", name: "Ensemencement et engazonnement", category: "CIVIL", unit: "m²", trade: "Manœuvre", keywords: ["ensemencement", "engazonnement", "gazon", "hydroensemencement", "vegetalisation"], hoursPerUnit: 0.005, materials: 0.8, equipment: 0.4 },
  { id: "civ-cloture", name: "Clôtures", category: "CIVIL", unit: "m", trade: "Manœuvre", keywords: ["cloture"], hoursPerUnit: 0.25, materials: 30, equipment: 5 },
  { id: "civ-mobilisation", name: "Mobilisation et installation de chantier", category: "CIVIL", unit: "forfait", trade: "Contremaître", keywords: ["mobilisation", "installation de chantier", "installations de chantier"], hoursPerUnit: 0, materials: 0, equipment: 0, percentOfDirect: 3.5 },
  { id: "civ-circulation", name: "Maintien de la circulation et signalisation temporaire", category: "CIVIL", unit: "forfait", trade: "Monteur de signalisation", keywords: ["signalisation temporaire", "maintien de la circulation", "circulation", "securite"], hoursPerUnit: 0, materials: 0, equipment: 0, percentOfDirect: 2 },
  { id: "civ-demobilisation", name: "Démobilisation et remise en état des lieux", category: "CIVIL", unit: "forfait", trade: "Manœuvre", keywords: ["demobilisation", "remise en etat", "nettoyage final"], hoursPerUnit: 0, materials: 0, equipment: 0, percentOfDirect: 1 },
  { id: "civ-arpentage", name: "Arpentage et implantation", category: "CIVIL", unit: "forfait", trade: "Arpenteur", keywords: ["arpentage", "implantation", "releve topographique"], hoursPerUnit: 0, materials: 0, equipment: 0, percentOfDirect: 0.8 },

  // Linéaire, ponts et réseaux
  { id: "lin-beton-ouvrage", name: "Béton de structure d'ouvrage d'art (pont)", category: "LINEAR", unit: "m³", trade: "Cimentier-applicateur", keywords: ["beton de structure", "tablier", "culee", "pile de pont", "ouvrage d art", "ouvrages d art", "pont"], hoursPerUnit: 8, materials: 320, equipment: 60 },
  { id: "lin-armature-t", name: "Armatures d'acier (ferraillage)", category: "LINEAR", unit: "t", trade: "Ferrailleur", keywords: ["armature", "ferraill", "acier d armature"], hoursPerUnit: 18, materials: 1900, equipment: 100 },
  { id: "lin-armature-kg", name: "Armatures d'acier (ferraillage)", category: "LINEAR", unit: "kg", trade: "Ferrailleur", keywords: ["armature", "ferraill", "acier d armature"], hoursPerUnit: 0.018, materials: 1.9, equipment: 0.1 },
  { id: "lin-coffrage", name: "Coffrage", category: "LINEAR", unit: "m²", trade: "Coffreur", keywords: ["coffrage"], hoursPerUnit: 1.2, materials: 35, equipment: 5 },
  { id: "lin-pieux", name: "Pieux en acier battus", category: "LINEAR", unit: "m", trade: "Grutier", keywords: ["pieu", "pieux", "battage"], hoursPerUnit: 0.8, materials: 220, equipment: 180 },
  { id: "lin-poutres", name: "Poutres préfabriquées de pont (fourniture et pose)", category: "LINEAR", unit: "m", trade: "Grutier", keywords: ["poutre", "prefabrique"], hoursPerUnit: 1.5, materials: 2500, equipment: 400 },
  { id: "lin-etancheite", name: "Membrane d'étanchéité de tablier", category: "LINEAR", unit: "m²", trade: "Couvreur", keywords: ["etancheite", "membrane d etancheite"], hoursPerUnit: 0.15, materials: 45, equipment: 3 },
  { id: "lin-pipeline", name: "Pipeline en acier soudé (pose en tranchée)", category: "LINEAR", unit: "m", trade: "Soudeur", keywords: ["pipeline", "gazoduc", "oleoduc", "conduite d acier", "conduite de transport"], hoursPerUnit: 1.8, materials: 280, equipment: 120 },
  { id: "lin-aqueduc", name: "Conduites d'aqueduc et d'égout", category: "LINEAR", unit: "m", trade: "Poseur de conduites", keywords: ["aqueduc", "egout", "sanitaire", "pluvial", "conduite"], hoursPerUnit: 2.5, materials: 220, equipment: 140 },
  { id: "lin-forage", name: "Forage directionnel", category: "LINEAR", unit: "m", trade: "Opérateur d'engins", keywords: ["forage directionnel", "forage horizontal", "forage dirige"], hoursPerUnit: 0.6, materials: 60, equipment: 250 },
  { id: "lin-ligne-electrique", name: "Ligne électrique aérienne", category: "LINEAR", unit: "km", trade: "Monteur de lignes", keywords: ["ligne electrique", "ligne aerienne", "lignes aeriennes", "ligne de transport", "ligne de distribution"], hoursPerUnit: 900, materials: 60000, equipment: 25000 },
  { id: "lin-fibre", name: "Conduits enfouis et fibre optique", category: "LINEAR", unit: "m", trade: "Manœuvre", keywords: ["fibre", "telecom", "massif de conduits"], hoursPerUnit: 0.15, materials: 12, equipment: 8 },
  { id: "lin-voie-ferree", name: "Voie ferrée (rails, traverses et ballast)", category: "LINEAR", unit: "m", trade: "Manœuvre", keywords: ["voie ferree", "rail", "ballast", "traverse"], hoursPerUnit: 1.2, materials: 450, equipment: 150 },

  // Bâtiment
  { id: "bat-beton-fondation", name: "Béton de fondations (semelles et murs)", category: "BUILDING", unit: "m³", trade: "Cimentier-applicateur", keywords: ["fondation", "semelle", "mur de fondation", "beton"], hoursPerUnit: 4, materials: 260, equipment: 30 },
  { id: "bat-dalle", name: "Dalle de béton sur sol", category: "BUILDING", unit: "m²", trade: "Cimentier-applicateur", keywords: ["dalle"], hoursPerUnit: 0.35, materials: 45, equipment: 5 },
  { id: "bat-charpente-acier", name: "Charpente d'acier (fourniture et montage)", category: "BUILDING", unit: "t", trade: "Monteur d'acier de structure", keywords: ["charpente d acier", "charpente metallique", "acier de structure", "structure metallique", "charpente"], hoursPerUnit: 14, materials: 4200, equipment: 450 },
  { id: "bat-charpente-bois", name: "Charpente et ossature de bois", category: "BUILDING", unit: "m²", trade: "Charpentier-menuisier", keywords: ["charpente de bois", "ossature de bois", "ossature bois", "bois"], hoursPerUnit: 0.6, materials: 55, equipment: 3 },
  { id: "bat-maconnerie", name: "Maçonnerie de blocs de béton", category: "BUILDING", unit: "m²", trade: "Maçon", keywords: ["maconnerie", "bloc", "brique"], hoursPerUnit: 1.2, materials: 60, equipment: 4 },
  { id: "bat-toiture", name: "Toiture à membrane", category: "BUILDING", unit: "m²", trade: "Couvreur", keywords: ["toiture", "couverture", "toit"], hoursPerUnit: 0.35, materials: 65, equipment: 5 },
  { id: "bat-gypse", name: "Cloisons sèches en gypse", category: "BUILDING", unit: "m²", trade: "Charpentier-menuisier", keywords: ["gypse", "cloison seche", "cloisons seches", "placoplatre", "plaque de platre"], hoursPerUnit: 0.45, materials: 28, equipment: 1 },
  { id: "bat-peinture", name: "Peinture intérieure", category: "BUILDING", unit: "m²", trade: "Peintre", keywords: ["peinture interieure", "peinture des murs"], hoursPerUnit: 0.12, materials: 3.5, equipment: 0.3 },
  { id: "bat-isolation", name: "Isolation thermique", category: "BUILDING", unit: "m²", trade: "Charpentier-menuisier", keywords: ["isolation", "isolant"], hoursPerUnit: 0.15, materials: 18, equipment: 0.5 },
  { id: "bat-ouvertures", name: "Portes et fenêtres", category: "BUILDING", unit: "unité", trade: "Charpentier-menuisier", keywords: ["fenetre", "porte"], hoursPerUnit: 4, materials: 900, equipment: 10 },
  { id: "bat-plomberie", name: "Appareils de plomberie", category: "BUILDING", unit: "unité", trade: "Plombier", keywords: ["plomberie", "appareil sanitaire", "lavabo", "toilette", "evier"], hoursPerUnit: 8, materials: 650, equipment: 20 },
  { id: "bat-ventilation", name: "Conduits de ventilation", category: "BUILDING", unit: "kg", trade: "Mécanicien en ventilation", keywords: ["conduit de ventilation", "conduits de ventilation", "ventilation", "gaine"], hoursPerUnit: 0.12, materials: 9, equipment: 0.5 },
  { id: "bat-electricite", name: "Électricité du bâtiment (distribution et éclairage)", category: "BUILDING", unit: "m²", trade: "Électricien", keywords: ["electricite", "electrique"], hoursPerUnit: 0.35, materials: 40, equipment: 2 },

  // Naval
  { id: "nav-toles", name: "Remplacement de tôles d'acier et raidisseurs", category: "NAVAL", unit: "m²", trade: "Soudeur", keywords: ["tole", "raidisseur", "borde", "structure", "coque"], hoursPerUnit: 16, materials: 260, equipment: 40 },
  { id: "nav-acier-t", name: "Renouvellement d'acier de coque", category: "NAVAL", unit: "t", trade: "Soudeur", keywords: ["renouvellement d acier", "acier", "tole", "coque"], hoursPerUnit: 120, materials: 2600, equipment: 400 },
  { id: "nav-tuyauterie", name: "Remplacement de tuyauterie de bord", category: "NAVAL", unit: "m", trade: "Tuyauteur", keywords: ["tuyauterie", "tuyau"], hoursPerUnit: 3.5, materials: 110, equipment: 10 },
  { id: "nav-peinture", name: "Préparation de surface et système de peinture marine", category: "NAVAL", unit: "m²", trade: "Peintre", keywords: ["peinture", "grenaillage", "sablage", "preparation de surface", "anticorrosion"], hoursPerUnit: 0.35, materials: 18, equipment: 6 },
  { id: "nav-sol", name: "Revêtement de sol de locaux", category: "NAVAL", unit: "m²", trade: "Menuisier aménageur", keywords: ["revetement de sol", "plancher", "couvre sol"], hoursPerUnit: 1.2, materials: 85, equipment: 2 },
  { id: "nav-cloisons", name: "Cloisons de locaux", category: "NAVAL", unit: "m²", trade: "Menuisier aménageur", keywords: ["cloison"], hoursPerUnit: 2, materials: 120, equipment: 3 },
  { id: "nav-luminaires", name: "Remplacement de luminaires", category: "NAVAL", unit: "unité", trade: "Électricien", keywords: ["luminaire", "eclairage"], hoursPerUnit: 2.5, materials: 280, equipment: 5 },
  { id: "nav-prises", name: "Prises de courant industrielles", category: "NAVAL", unit: "unité", trade: "Électricien", keywords: ["prise"], hoursPerUnit: 2, materials: 120, equipment: 2 },
  { id: "nav-registres", name: "Registres et clapets de ventilation", category: "NAVAL", unit: "unité", trade: "Mécanicien", keywords: ["registre", "clapet"], hoursPerUnit: 4, materials: 450, equipment: 10 },
  { id: "nav-calorifuge", name: "Calorifugeage de locaux", category: "NAVAL", unit: "m²", trade: "Menuisier aménageur", keywords: ["calorifug"], hoursPerUnit: 0.8, materials: 35, equipment: 2 },

  // Industriel
  { id: "ind-reservoir", name: "Réservoirs en acier (fabrication sur site)", category: "INDUSTRIAL", unit: "t", trade: "Chaudronnier", keywords: ["reservoir", "cuve", "chaudronnerie"], hoursPerUnit: 60, materials: 3500, equipment: 400 },
  { id: "ind-montage", name: "Montage mécanique d'équipements", category: "INDUSTRIAL", unit: "t", trade: "Mécanicien de chantier", keywords: ["montage mecanique", "equipement", "pompe", "compresseur", "machine"], hoursPerUnit: 30, materials: 0, equipment: 250 },
  { id: "ind-tuyauterie", name: "Tuyauterie industrielle en acier au carbone", category: "INDUSTRIAL", unit: "m", trade: "Tuyauteur", keywords: ["tuyauterie industrielle", "tuyauterie de procede", "industriel", "procede", "usine", "tuyauterie"], hoursPerUnit: 4, materials: 150, equipment: 25 },
  { id: "ind-soudure", name: "Soudures bout à bout", category: "INDUSTRIAL", unit: "po-diam", trade: "Soudeur", keywords: ["soudure", "soudage"], hoursPerUnit: 0.9, materials: 8, equipment: 3 },
  { id: "ind-supports", name: "Supports, passerelles et charpente légère", category: "INDUSTRIAL", unit: "kg", trade: "Chaudronnier", keywords: ["support", "charpente legere", "passerelle", "garde corps"], hoursPerUnit: 0.04, materials: 4.5, equipment: 0.3 },
  { id: "ind-cablage", name: "Câblage et chemins de câbles", category: "INDUSTRIAL", unit: "m", trade: "Électricien", keywords: ["cable", "cablage", "chemin de cable", "chemins de cables"], hoursPerUnit: 0.12, materials: 9, equipment: 0.5 },
  { id: "ind-instrument", name: "Instrumentation (boucle complète)", category: "INDUSTRIAL", unit: "unité", trade: "Instrumentiste", keywords: ["instrument", "transmetteur", "boucle"], hoursPerUnit: 16, materials: 1800, equipment: 30 },
  { id: "ind-calorifuge", name: "Calorifuge de tuyauterie", category: "INDUSTRIAL", unit: "m", trade: "Manœuvre", keywords: ["calorifug", "isolation de tuyauterie"], hoursPerUnit: 0.6, materials: 40, equipment: 2 },
];
