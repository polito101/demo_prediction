import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const hash = await bcrypt.hash("Demo123!", 10);

  const tenant = await prisma.tenant.upsert({
    where: { domain: "localhost" },
    create: {
      name: "Demo Predict",
      domain: "localhost",
      primaryColor: "#6366f1",
      logoUrl: null,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: "admin@demo.local" },
    },
    create: {
      tenantId: tenant.id,
      email: "admin@demo.local",
      name: "Admin Demo",
      passwordHash: hash,
      role: "ADMIN",
      balance: "10000",
    },
    update: { passwordHash: hash },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: "user@demo.local" },
    },
    create: {
      tenantId: tenant.id,
      email: "user@demo.local",
      name: "Usuario Demo",
      passwordHash: hash,
      role: "USER",
      balance: "1000",
    },
    update: { passwordHash: hash },
  });

  const exists = await prisma.market.findFirst({
    where: { tenantId: tenant.id, title: "¿Lloverá mañana en Madrid?" },
  });

  if (!exists) {
    await prisma.market.create({
      data: {
        tenantId: tenant.id,
        title: "¿Lloverá mañana en Madrid?",
        description: "Mercado de demostración con AMM (LMSR).",
        category: "Clima",
        status: "OPEN",
        liquidityB: "100",
        feeRate: "0.02",
        outcomes: {
          create: [
            { name: "Sí", currentPrice: "0.5", sharesOutstanding: "0" },
            { name: "No", currentPrice: "0.5", sharesOutstanding: "0" },
          ],
        },
      },
    });
  }

  console.log("Seed OK — tenant:", tenant.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
