import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  fetchPolymarketMarkets,
  parsePolymarketOutcomes,
  type PolymarketGammaMarket,
} from "@/lib/polymarket";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function PolymarketCard({ m }: { m: PolymarketGammaMarket }) {
  const rows = parsePolymarketOutcomes(m);
  const href = `/polymarket/${m.id}`;

  return (
    <Link href={href} className="block h-full">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{m.question}</CardTitle>
            <Badge variant="outline" className="shrink-0 gap-1">
              PM
              <ChevronRight className="h-3 w-3" />
            </Badge>
          </div>
          <CardDescription className="space-y-0.5">
            {m.volume24hr != null && m.volume24hr > 0 && (
              <span className="block font-medium text-foreground">
                Volumen 24 h:{" "}
                {Math.round(m.volume24hr).toLocaleString("es-ES")} USDC
              </span>
            )}
            {m.volumeNum != null && (
              <span className="block text-xs">
                Volumen total ~{Math.round(m.volumeNum).toLocaleString("es-ES")}{" "}
                USDC
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {rows.map((o, i) => (
              <div
                key={`${m.id}-${i}`}
                className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
              >
                <span className="text-muted-foreground">{o.name}</span>
                <span className="ml-2 font-mono font-semibold">
                  {(o.price * 100).toFixed(1)}¢
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Ver histórico de precios, volumen y liquidez en la página del mercado.
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export async function PolymarketSection() {
  const markets = await fetchPolymarketMarkets(10);

  if (markets.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Mercados reales (Polymarket)</h2>
        <p className="text-sm text-muted-foreground">
          No se pudieron cargar datos de Polymarket. Revisa la conexión o
          inténtalo más tarde.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Mercados reales (Polymarket)</h2>
        <p className="text-sm text-muted-foreground">
          Mercados <strong>activos</strong> ordenados por{" "}
          <strong>mayor volumen en 24 h</strong> (datos públicos de la{" "}
          <Link
            href="https://gamma-api.polymarket.com"
            className="text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            Gamma API
          </Link>
          ). Pulsa una tarjeta para ver el detalle con gráfico e histórico CLOB.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {markets.map((m) => (
          <PolymarketCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  );
}
