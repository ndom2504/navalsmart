import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { buildDemoDatabase, buildRealDatabase, CIVIL_TRADES, CIVIL_UNITS } from "@/domain/demo";
import type { Database, Project, WorkspaceMode } from "@/domain/types";

interface StoreFile {
  version: 2;
  active: WorkspaceMode;
  workspaces: Record<WorkspaceMode, Database>;
}

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "navalsmart.json");

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isStoreFile(value: unknown): value is StoreFile {
  if (!value || typeof value !== "object") return false;
  const record = value as StoreFile;
  return record.version === 2
    && (record.active === "demo" || record.active === "real")
    && Boolean(record.workspaces?.demo?.user)
    && Boolean(record.workspaces?.real?.user);
}

function isLegacyDatabase(value: unknown): value is Database {
  if (!value || typeof value !== "object") return false;
  const record = value as Database;
  return Array.isArray(record.projects) && Boolean(record.user?.email);
}

/** Complète les données enregistrées avant l'ajout du planning, des ordres de travail et de la bibliothèque de coûts. */
function normalize(store: StoreFile): StoreFile {
  for (const database of Object.values(store.workspaces)) {
    if (!database.settings.unitCosts) {
      database.settings.unitCosts = [];
      const trades = new Set(database.settings.laborRates.map((rate) => rate.trade));
      database.settings.laborRates.push(...CIVIL_TRADES.filter((trade) => !trades.has(trade)).map((trade) => ({ trade, hourlyRateCents: 0 })));
      const units = new Set(database.settings.units);
      database.settings.units.push(...CIVIL_UNITS.filter((unit) => !units.has(unit)));
    }
    database.settings.market ??= { enabled: true, defaultRegion: "CA-QC" };
    database.aiMarketActivities ??= [];
    for (const project of database.projects) {
      project.milestones ??= [];
      project.workOrders ??= [];
    }
  }
  return store;
}

function present(database: Database, mode: WorkspaceMode): Database {
  const copy = { ...database };
  delete copy.workspaceMode;
  return { ...copy, workspaceMode: mode };
}

async function writeStore(store: StoreFile): Promise<void> {
  const payload: StoreFile = {
    version: 2,
    active: store.active,
    workspaces: {
      demo: { ...store.workspaces.demo },
      real: { ...store.workspaces.real },
    },
  };
  delete payload.workspaces.demo.workspaceMode;
  delete payload.workspaces.real.workspaceMode;
  await fs.writeFile(dataFile, JSON.stringify(payload, null, 2), "utf8");
}

async function freshStore(): Promise<StoreFile> {
  const password = process.env.DEMO_USER_PASSWORD || "Formation2026!";
  const email = process.env.DEMO_USER_EMAIL || "morel@navalsmart.local";
  const passwordHash = await bcrypt.hash(password, 12);
  const demo = buildDemoDatabase(passwordHash);
  demo.user.email = email.toLowerCase();
  return {
    version: 2,
    active: "demo",
    workspaces: {
      demo,
      real: buildRealDatabase(demo.user, structuredClone(demo.settings)),
    },
  };
}

async function loadStore(): Promise<StoreFile> {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fs.readFile(dataFile, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (isStoreFile(parsed)) return normalize(parsed);
    if (isLegacyDatabase(parsed)) {
      const demo = { ...parsed };
      delete demo.workspaceMode;
      const store: StoreFile = {
        version: 2,
        active: "demo",
        workspaces: {
          demo,
          real: buildRealDatabase(demo.user, structuredClone(demo.settings)),
        },
      };
      await writeStore(store);
      return normalize(store);
    }
    throw new Error("Fichier de données illisible.");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    const store = await freshStore();
    await writeStore(store);
    return store;
  }
}

export function readDatabase(): Promise<Database> {
  return withLock(async () => {
    const store = await loadStore();
    return present(store.workspaces[store.active], store.active);
  });
}

export function updateDatabase(mutate: (database: Database) => void): Promise<Database> {
  return withLock(async () => {
    const store = await loadStore();
    const database = store.workspaces[store.active];
    mutate(database);
    delete database.workspaceMode;
    await writeStore(store);
    return present(database, store.active);
  });
}

export function switchWorkspace(mode: WorkspaceMode): Promise<Database> {
  return withLock(async () => {
    const store = await loadStore();
    if (store.active !== mode) {
      store.workspaces[mode].user = store.workspaces[store.active].user;
      store.active = mode;
      await writeStore(store);
    }
    return present(store.workspaces[store.active], store.active);
  });
}

export function findProject(database: Database, projectId: string): Project | undefined {
  return database.projects.find((project) => project.id === projectId);
}

export async function verifyCredentials(email: string, password: string) {
  const database = await readDatabase();
  if (database.user.email.toLowerCase() !== email.toLowerCase()) return null;
  const matches = await bcrypt.compare(password, database.user.passwordHash);
  if (!matches) return null;
  return database.user;
}
