import Link from "next/link";
import { prisma } from "@/lib/db";
import { getTenantFromRequest } from "@/lib/tenant";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PolymarketSection } from "@/components/polymarket-section";

export const dynamic = "force-dynamic";

function statusLabel(s: string) {
  switch (s) {
    case "OPEN":
      return "Abierto";
    case "PAUSED":
      return "Pausado";
    case "CLOSED":
      return "Cerrado";
    case "RESOLVED":
      return "Resuelto";
    default:
      return s;
  }
}

export default async function HomePage() {
  const tenant = await getTenantFromRequest();

  const markets = await prisma.market.findMany({
    where: { tenantId: tenant.id, status: { in: ["OPEN", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      outcomes: { orderBy: { id: "asc" } },
    },
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mercados</h1>
        <p className="text-muted-foreground">
          Explora mercados reales de Polymarket y, más abajo, la simulación local
          (AMM) de esta demo.
        </p>
      </div>

      <PolymarketSection />

      <Separator />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Simulación local (white-label)</h2>
          <p className="text-sm text-muted-foreground">
            Mercados creados en tu tenant con LMSR — operables aquí (login
            requerido).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {markets.map((m) => (
            <Link key={m.id} href={`/markets/${m.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{m.title}</CardTitle>
                    <Badge variant="secondary">{statusLabel(m.status)}</Badge>
                  </div>
                  {m.category && (
                    <CardDescription>{m.category}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {m.outcomes.map((o) => (
                      <div
                        key={o.id}
                        className="rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">{o.name}</span>
                        <span className="ml-2 font-mono font-semibold text-primary">
                          {(Number(o.currentPrice) * 100).toFixed(1)}¢
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {markets.length === 0 && (
          <p className="text-muted-foreground">
            No hay mercados locales. Un administrador puede crear uno desde el
            panel.
          </p>
        )}
      </section>
    </div>
  );
}
