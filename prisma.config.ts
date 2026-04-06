import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const root = process.cwd();
// Por defecto dotenv NO pisa variables ya definidas en el sistema. Si tenías
// DATABASE_URL apuntando a otro host (p. ej. Prisma Postgres en 51213/51214),
// el CLI ignoraba el .env con :5432. Forzamos que los .env del proyecto ganen.
config({ path: resolve(root, ".env"), override: true });
config({ path: resolve(root, ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
