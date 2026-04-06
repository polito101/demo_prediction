import { prisma } from "@/lib/db";
import { headers } from "next/headers";

const FALLBACK_TENANT = {
  id: "offline-tenant",
  name: "Prediction Market",
  logoUrl: null,
  primaryColor: "#6366f1",
  domain: null,
} as const;

function isConnectionRefusedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ECONNREFUSED"
  );
}

/** Resuelve tenant por cabecera Host o dominio por defecto (dev: localhost). */
export async function getTenantFromRequest(): Promise<{
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  domain: string | null;
}> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    const hostClean = host.split(":")[0]?.toLowerCase() ?? "localhost";

    const byDomain = await prisma.tenant.findFirst({
      where: { domain: hostClean },
    });
    if (byDomain) {
      return {
        id: byDomain.id,
        name: byDomain.name,
        logoUrl: byDomain.logoUrl,
        primaryColor: byDomain.primaryColor,
        domain: byDomain.domain,
      };
    }

    const fallback = await prisma.tenant.findFirst({
      where: { domain: "localhost" },
    });
    if (fallback) {
      return {
        id: fallback.id,
        name: fallback.name,
        logoUrl: fallback.logoUrl,
        primaryColor: fallback.primaryColor,
        domain: fallback.domain,
      };
    }

    const any = await prisma.tenant.findFirst();
    if (!any) {
      throw new Error(
        "No hay tenants en la base de datos. Ejecuta: npm run db:seed"
      );
    }
    return {
      id: any.id,
      name: any.name,
      logoUrl: any.logoUrl,
      primaryColor: any.primaryColor,
      domain: any.domain,
    };
  } catch (error) {
    if (isConnectionRefusedError(error)) {
      console.warn(
        "DB no disponible (ECONNREFUSED). Usando tenant temporal offline."
      );
      return { ...FALLBACK_TENANT };
    }
    throw error;
  }
}
