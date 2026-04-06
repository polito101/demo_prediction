"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function requireAdmin() {
  return auth().then((s) => {
    if (!s?.user?.id || s.user.role !== "ADMIN") {
      throw new Error("No autorizado");
    }
    return s;
  });
}

const marketCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  resolutionDate: z.string().optional(),
  outcomes: z.array(z.string().min(1)).min(2).max(8),
  liquidityB: z.coerce.number().positive().default(100),
  feeRate: z.coerce.number().min(0).max(1).default(0.02),
});

export async function createMarket(input: unknown) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { ok: false as const, error: "No autorizado" };

  const parsed = marketCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  const d = parsed.data;
  const n = d.outcomes.length;
  const initialPrice = (1 / n).toFixed(8);
  let resDate: Date | null = null;
  if (d.resolutionDate?.trim()) {
    const t = Date.parse(d.resolutionDate);
    if (!Number.isNaN(t)) resDate = new Date(t);
  }

  try {
    await prisma.market.create({
      data: {
        tenantId: session.user.tenantId,
        title: d.title,
        description: d.description || null,
        category: d.category || null,
        imageUrl: d.imageUrl || null,
        resolutionDate: resDate,
        status: "OPEN",
        liquidityB: String(d.liquidityB),
        feeRate: String(d.feeRate),
        outcomes: {
          create: d.outcomes.map((name) => ({
            name,
            currentPrice: initialPrice,
            sharesOutstanding: "0",
          })),
        },
      },
    });
    revalidatePath("/");
    revalidatePath("/admin/markets");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear";
    return { ok: false as const, error: msg };
  }
}

const marketUpdateSchema = z.object({
  marketId: z.string(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["OPEN", "CLOSED", "PAUSED"]).optional(),
});

export async function updateMarket(input: unknown) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { ok: false as const, error: "No autorizado" };

  const parsed = marketUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  const { marketId, ...rest } = parsed.data;

  try {
    await prisma.market.updateMany({
      where: { id: marketId, tenantId: session.user.tenantId },
      data: {
        ...(rest.title !== undefined && { title: rest.title }),
        ...(rest.description !== undefined && { description: rest.description }),
        ...(rest.category !== undefined && { category: rest.category }),
        ...(rest.status !== undefined && { status: rest.status }),
      },
    });
    revalidatePath("/");
    revalidatePath("/admin/markets");
    revalidatePath(`/markets/${marketId}`);
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar";
    return { ok: false as const, error: msg };
  }
}

const tenantSchema = z.object({
  name: z.string().min(1).max(120),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export async function updateTenantBranding(input: unknown) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { ok: false as const, error: "No autorizado" };

  const parsed = tenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  try {
    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        name: parsed.data.name,
        ...(parsed.data.primaryColor && {
          primaryColor: parsed.data.primaryColor,
        }),
        logoUrl: parsed.data.logoUrl || null,
      },
    });
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al guardar";
    return { ok: false as const, error: msg };
  }
}

const adjustSchema = z.object({
  userId: z.string(),
  amount: z.coerce.number(),
  reason: z.string().optional(),
});

export async function adjustUserBalance(input: unknown) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { ok: false as const, error: "No autorizado" };

  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  const { userId, amount, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, tenantId: session.user.tenantId },
      });
      if (!user) throw new Error("Usuario no encontrado");

      const bal = Number(user.balance);
      const next = bal + amount;
      if (next < 0) throw new Error("El saldo no puede quedar negativo");

      await tx.user.update({
        where: { id: userId },
        data: { balance: String(next) },
      });

      await tx.balanceAdjustment.create({
        data: {
          userId,
          adminId: session.user.id,
          amount: String(amount),
          reason: reason ?? null,
        },
      });
    });
    revalidatePath("/admin/users");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al ajustar";
    return { ok: false as const, error: msg };
  }
}

const suspendSchema = z.object({
  userId: z.string(),
  suspended: z.boolean(),
});

export async function setUserSuspended(input: unknown) {
  const session = await requireAdmin().catch(() => null);
  if (!session) return { ok: false as const, error: "No autorizado" };

  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  try {
    await prisma.user.updateMany({
      where: {
        id: parsed.data.userId,
        tenantId: session.user.tenantId,
        NOT: { id: session.user.id },
      },
      data: { suspended: parsed.data.suspended },
    });
    revalidatePath("/admin/users");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return { ok: false as const, error: msg };
  }
}
