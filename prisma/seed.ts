import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildDemoDatabase } from "../src/domain/demo";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.DEMO_USER_PASSWORD || "Formation2026!";
  const database = buildDemoDatabase(await bcrypt.hash(password, 12));
  const user = await prisma.user.upsert({
    where: { email: database.user.email },
    update: { name: database.user.name },
    create: {
      id: database.user.id,
      name: database.user.name,
      email: database.user.email,
      passwordHash: database.user.passwordHash,
      role: database.user.role,
      jobTitle: database.user.jobTitle,
      companyName: database.user.companyName,
      settings: {
        create: {
          currency: database.settings.currency,
          contingencyPct: database.settings.contingencyPct,
          overheadPct: database.settings.overheadPct,
          marginPct: database.settings.marginPct,
          overtimeFactor: database.settings.overtimeFactor,
          defaultLearningMode: database.settings.defaultLearningMode,
          notifyMissing: database.settings.notifications.missingInfo,
          notifyRisks: database.settings.notifications.risks,
          notifyQuotes: database.settings.notifications.supplierQuotes,
          laborRates: database.settings.laborRates as unknown as Prisma.InputJsonValue,
          units: database.settings.units as unknown as Prisma.InputJsonValue,
          aiModel: database.settings.aiModel,
          completenessWeights: database.settings.completenessWeights as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });
  console.log(`Utilisateur PostgreSQL prêt : ${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
