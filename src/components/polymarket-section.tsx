import Link from "next/link";
import { Pin } from "lucide-react";
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

/** Mercado Bitcoin Up/Down 5 min — destacado arriba de la lista (home). */
export function PolymarketPinnedCard({ m }: { m: PolymarketGammaMarket }) {
  const rows = parsePolymarketOutcomes(m);
  const href =
    m.slug?.startsWith("btc-updown-5m") ?? false
      ? `/polymarket/${m.id}?interval=1m`
      : `/polymarket/${m.id}`;

  return (
    <Link href={href} className="block">
      <Card className="border-primary/35 bg-primary/[0.06] shadow-sm transition-colors hover:bg-primary/[0.09]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 bg-primary text-primary-foreground">
              <Pin className="h-3 w-3" aria-hidden />
              Fijado
            </Badge>
            <Badge variant="secondary">Bitcoin · ventana 5 min</Badge>
          </div>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg leading-snug">{m.question}</CardTitle>
            {(m.image || m.icon) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.image ?? m.icon}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-lg border object-cover"
              />
            )}
          </div>
          <CardDescription className="space-y-0.5">
            {m.volume24hr != null && m.volume24hr > 0 && (
              <span className="block font-medium text-foreground">
                Volumen 24 h:{" "}
                {Math.round(m.volume24hr).toLocaleString("es-ES")} USDC
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {rows.map((o, i) => (
              <div
                key={`pinned-${m.id}-${i}`}
                className="rounded-md border border-primary/20 bg-background px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{o.name}</span>
                <span className="ml-2 font-mono font-semibold text-primary">
                  {(o.price * 100).toFixed(1)}¢
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Abre el gráfico CLOB, paper trading y precios en tiempo real.
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

export async function PolymarketSection({
  excludeMarketIds = [],
}: {
  excludeMarketIds?: string[];
} = {}) {
  const markets = await fetchPolymarketMarkets(10);
  const exclude = new Set(excludeMarketIds.map(String));
  const list = markets.filter((m) => !exclude.has(String(m.id)));

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
        {list.map((m) => (
          <PolymarketCard key={m.id} m={m} />
        ))}
      </div>
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">
          El resto de mercados coincide con el fijado; no hay más entradas en
          este listado.
        </p>
      )}
    </section>
  );
}
