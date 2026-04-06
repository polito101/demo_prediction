"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  findDeltaForBudget,
  lmsrBuyCost,
  lmsrPrices,
} from "@/lib/amm";
import Decimal from "decimal.js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const buySchema = z.object({
  marketId: z.string().min(1),
  outcomeId: z.string().min(1),
  amount: z.coerce.number().positive().max(1e12),
});

export async function buyShares(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: "No autenticado" };
  }

  const parsed = buySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Datos inválidos" };
  }

  const { marketId, outcomeId, amount } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const market = await tx.market.findFirst({
        where: {
          id: marketId,
          tenantId: session.user.tenantId,
          status: "OPEN",
        },
        include: { outcomes: { orderBy: { id: "asc" } } },
      });

      if (!market || market.outcomes.length === 0) {
        throw new Error("Mercado no disponible");
      }

      const idx = market.outcomes.findIndex((o) => o.id === outcomeId);
      if (idx < 0) throw new Error("Opción inválida");

      const user = await tx.user.findFirst({
        where: { id: session.user.id, tenantId: session.user.tenantId },
      });
      if (!user || user.suspended) throw new Error("Cuenta no válida");

      const balance = new Decimal(user.balance.toString());
      const pay = new Decimal(amount);
      if (balance.lt(pay)) throw new Error("Saldo insuficiente");

      const b = new Decimal(market.liquidityB.toString());
      const feeRate = new Decimal(market.feeRate.toString());
      const fee = pay.mul(feeRate);
      const net = pay.minus(fee);

      const q = market.outcomes.map(
        (o) => new Decimal(o.sharesOutstanding.toString())
      );
      const delta = findDeltaForBudget(q, b, idx, net);
      const actualCost = lmsrBuyCost(q, b, idx, delta);

      const newQ = q.map((x) => new Decimal(x));
      newQ[idx] = newQ[idx].plus(delta);
      const prices = lmsrPrices(newQ, b);

      await tx.user.update({
        where: { id: user.id },
        data: { balance: balance.minus(pay).toFixed(8) },
      });

      for (let i = 0; i < market.outcomes.length; i++) {
        await tx.outcome.update({
          where: { id: market.outcomes[i].id },
          data: {
            sharesOutstanding: newQ[i].toFixed(8),
            currentPrice: prices[i].toFixed(8),
          },
        });
      }

      const avgPrice = delta.gt(0) ? actualCost.div(delta) : new Decimal(0);

      await tx.position.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeId,
          amount: pay.toFixed(8),
          shares: delta.toFixed(8),
          priceAtPurchase: avgPrice.toFixed(8),
        },
      });

      await tx.trade.create({
        data: {
          userId: user.id,
          marketId: market.id,
          outcomeId,
          side: "BUY",
          amount: pay.toFixed(8),
          shares: delta.toFixed(8),
          price: avgPrice.toFixed(8),
        },
      });
    });

    revalidatePath("/");
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/portfolio");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al operar";
    return { ok: false as const, error: msg };
  }
}
