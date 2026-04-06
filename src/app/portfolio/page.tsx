import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/portfolio");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      positions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { market: true, outcome: true },
      },
    },
  });

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { market: true, outcome: true },
  });

  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Saldo disponible:{" "}
            <span className="font-mono font-semibold text-foreground">
              {Number(user.balance).toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Ver mercados
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Posiciones recientes</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mercado</TableHead>
                <TableHead>Opción</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Shares</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-[200px] truncate">
                    <Link
                      href={`/markets/${p.marketId}`}
                      className="text-primary hover:underline"
                    >
                      {p.market.title}
                    </Link>
                  </TableCell>
                  <TableCell>{p.outcome.name}</TableCell>
                  <TableCell className="font-mono">
                    {Number(p.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {Number(p.shares).toFixed(4)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {Number(p.priceAtPurchase).toFixed(4)}
                  </TableCell>
                  <TableCell>
                    {p.settled
                      ? `Liquidado (${Number(p.payout ?? 0).toFixed(2)})`
                      : "Abierta"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {user.positions.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin posiciones aún.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Historial de operaciones</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Mercado</TableHead>
                <TableHead>Lado</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Precio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {t.createdAt.toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {t.market.title}
                  </TableCell>
                  <TableCell>{t.outcome.name}</TableCell>
                  <TableCell className="font-mono">
                    {Number(t.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {Number(t.price).toFixed(4)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {trades.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin operaciones aún.</p>
        )}
      </section>
    </div>
  );
}
