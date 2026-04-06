"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  marketId: z.string().min(1),
  winningOutcomeId: z.string().min(1),
  note: z.string().optional(),
});

/**
 * Reparto parimutuel: el pool es la suma de `amount` de todas las posiciones;
 * los ganadores reparten el pool proporcionalmente a sus shares.
 * Idempotente si el mercado ya está RESOLVED.
 */
export async function resolveMarket(input: unknown) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "No autorizado" };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  const { marketId, winningOutcomeId, note } = parsed.data;

  try {
    const existing = await prisma.market.findFirst({
      where: { id: marketId, tenantId: session.user.tenantId },
    });
    if (!existing) {
      return { ok: false as const, error: "Mercado no encontrado" };
    }
    if (existing.status === "RESOLVED") {
      return { ok: true as const, alreadyResolved: true as const };
    }

    await prisma.$transaction(async (tx) => {
      const market = await tx.market.findFirst({
        where: { id: marketId, tenantId: session.user.tenantId },
        include: { outcomes: true },
      });

      if (!market) throw new Error("Mercado no encontrado");
      if (market.status === "RESOLVED") return;

      const belongs = market.outcomes.some((o) => o.id === winningOutcomeId);
      if (!belongs) throw new Error("La opción no pertenece a este mercado");

      const positions = await tx.position.findMany({
        where: { marketId, settled: false },
      });

      const pool = positions.reduce(
        (s, p) => s.plus(new Decimal(p.amount.toString())),
        new Decimal(0)
      );

      const winners = positions.filter((p) => p.outcomeId === winningOutcomeId);
      const totalWinShares = winners.reduce(
        (s, p) => s.plus(new Decimal(p.shares.toString())),
        new Decimal(0)
      );

      const payouts: { positionId: string; userId: string; payout: Decimal }[] =
        [];

      for (const pos of positions) {
        let payout = new Decimal(0);
        if (pos.outcomeId === winningOutcomeId && totalWinShares.gt(0)) {
          payout = new Decimal(pos.shares.toString())
            .div(totalWinShares)
            .mul(pool);
        }
        payouts.push({
          positionId: pos.id,
          userId: pos.userId,
          payout,
        });
      }

      const addByUser = new Map<string, Decimal>();
      for (const row of payouts) {
        const prev = addByUser.get(row.userId) ?? new Decimal(0);
        addByUser.set(row.userId, prev.plus(row.payout));
      }

      for (const [userId, add] of Array.from(addByUser.entries())) {
        const u = await tx.user.findUnique({ where: { id: userId } });
        if (!u) continue;
        const newBal = new Decimal(u.balance.toString()).plus(add);
        await tx.user.update({
          where: { id: userId },
          data: { balance: newBal.toFixed(8) },
        });
      }

      for (const row of payouts) {
        await tx.position.update({
          where: { id: row.positionId },
          data: {
            settled: true,
            payout: row.payout.toFixed(8),
          },
        });
      }

      await tx.market.update({
        where: { id: marketId },
        data: {
          status: "RESOLVED",
          outcomeId: winningOutcomeId,
          resolvedAt: new Date(),
          resolutionNote: note ?? null,
        },
      });
    });

    revalidatePath("/");
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/markets");
    revalidatePath("/portfolio");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al resolver";
    return { ok: false as const, error: msg };
  }
}
