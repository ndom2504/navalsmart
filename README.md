# NavalSmart

Outil d'aide à l'estimation de projets de construction et de réparation navales. L'IA propose une lecture, une structure et des alertes. L'estimateur vérifie, modifie et valide. Les montants sont produits par un moteur de calcul déterministe.

Slogan : « De l'appel d'offres à l'estimation, avec l'IA. »

Les dossiers livrés avec l'application sont fictifs. Ils ne proviennent d'aucun chantier réel.

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner `AUTH_SECRET` avec une chaîne aléatoire. Le compte de simulation est créé au premier lancement.

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Courriel : `morel@navalsmart.local`  
Mot de passe : `Formation2026!`

## Variables d'environnement

Voir `.env.example`.

- `AUTH_SECRET` : signature de session Auth.js
- `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` : compte de formation
- `DATABASE_URL` : PostgreSQL
- `OPENAI_API_KEY` : optionnel. Sans clé, l'analyse locale ne retient qu'une citation présente dans le texte
- `OPENAI_MODEL` : modèle utilisé côté serveur uniquement
- `MAX_UPLOAD_BYTES` : taille maximale d'un appel d'offres

Aucune clé n'est écrite dans le code ni exposée au navigateur.

## Base de données

Le simulateur enregistre les dossiers dans `data/navalsmart.json` afin de fonctionner sans serveur PostgreSQL. Ce fichier est ignoré par Git et créé au premier démarrage, avec le dossier « Réparation majeure – Navire Demo ».

Le modèle relationnel PostgreSQL est dans `prisma/schema.prisma`. Il couvre les entités User, Project, Tender, TenderDocument, TenderAnalysis, WorkPackage, Task, LaborCost, MaterialCost, EquipmentCost, Supplier, SupplierQuote, Subcontractor, Risk, Assumption, MissingInformation, Estimate, EstimateLine, EstimateRevision, AIReview, AIMessage et AuditLog.

PostgreSQL local :

```bash
docker compose up -d
npm run db:migrate
npm run db:seed
```

`db:seed` crée l'utilisateur et les paramètres de société dans PostgreSQL. L'interface lit encore le fichier local, qui contient le dossier de simulation complet.

## Prisma

```bash
npm run db:generate
npm run db:validate
```

La migration initiale se crée avec `npm run db:migrate` lorsque `DATABASE_URL` pointe vers PostgreSQL.

## OpenAI

L'appel est uniquement serveur. La réponse JSON est validée avec Zod, puis filtrée : un extrait qui n'existe pas dans le document est écarté. Les champs absents s'affichent « Non spécifié dans le document ».

Les questions couvertes par les données du projet (manquants, risques, main-d'œuvre, tuyauterie, lignes non vérifiées, synthèse) reçoivent une réponse calculée depuis le dossier, même si une clé est présente. Une autre question est envoyée au modèle avec ce dossier comme seul contexte. Si l'information n'y est pas, la réponse est : « Je ne dispose pas de cette information dans les données du projet. »

## Développement

```bash
npm run dev
npm test
npm run lint
```

Les tests vérifient le moteur : main-d'œuvre, matériaux, équipements et pourcentages fournis par l'utilisateur.

## Production

```bash
npm run build
npm start
```

Prévoir PostgreSQL, un `AUTH_SECRET` propre à l'environnement, et une limite d'upload. Ne pas réutiliser le mot de passe de simulation.

## Architecture

- `src/app` : pages, layout, routes API
- `src/components` : interface
- `src/domain` : types, calcul, complétude, revue, analyse documentaire, données de démonstration
- `src/server` : persistance, documents, OpenAI, actions
- `prisma` : schéma PostgreSQL

Le navigateur n'appelle pas OpenAI. Les routes API exigent une session. Les fichiers acceptés sont PDF, DOCX, XLSX et TXT, jusqu'à 20 Mo.

## Workflow

1. Nouvelle estimation
2. Importer l'appel d'offres
3. Analyser avec NavalSmart AI
4. Vérifier l'analyse
5. Structurer les travaux
6. Ajouter ou corriger les coûts
7. Revoir risques, hypothèses et informations manquantes
8. Lancer la revue
9. Valider
10. Produire le rapport PDF ou Excel

Le score de complétude est un indicateur interne. Il ne garantit pas la qualité de l'estimation.

Le mode apprentissage explique pourquoi une information compte, comment un coût est calculé et quelle question poser. Il n'invente pas de règle interne d'entreprise.
