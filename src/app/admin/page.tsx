import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const tenantId = session.user.tenantId;

  const [volumeAgg, userCount, marketOpen, tradeCount] = await Promise.all([
    prisma.trade.aggregate({
      where: { market: { tenantId } },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { tenantId } }),
    prisma.market.count({ where: { tenantId, status: "OPEN" } }),
    prisma.trade.count({ where: { market: { tenantId } } }),
  ]);

  const volume = Number(volumeAgg._sum.amount ?? 0);
  const feeEstimate = volume * 0.02;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Panel de administración</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Volumen apostado (suma trades)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{volume.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{userCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mercados abiertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{marketOpen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Comisiones estimadas (~2% vol.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{feeEstimate.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {tradeCount} operaciones
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
