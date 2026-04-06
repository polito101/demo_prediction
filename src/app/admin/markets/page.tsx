import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateMarketForm } from "@/components/admin/create-market-form";
import { ResolveMarketForm } from "@/components/admin/resolve-market-form";
import {
  MarketPauseButton,
  MarketResumeButton,
} from "@/components/admin/market-status-buttons";

export const dynamic = "force-dynamic";

export default async function AdminMarketsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const markets = await prisma.market.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      outcomes: { orderBy: { id: "asc" } },
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Mercados</h1>

      <CreateMarketForm />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Opciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Link
                    href={`/markets/${m.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {m.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge>{m.status}</Badge>
                </TableCell>
                <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                  {m.outcomes.map((o) => o.name).join(" · ")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-2">
                    {m.status === "OPEN" && (
                      <MarketPauseButton marketId={m.id} />
                    )}
                    {m.status === "PAUSED" && (
                      <MarketResumeButton marketId={m.id} />
                    )}
                    {(m.status === "OPEN" || m.status === "PAUSED") && (
                      <ResolveMarketForm
                        marketId={m.id}
                        outcomes={m.outcomes.map((o) => ({
                          id: o.id,
                          name: o.name,
                        }))}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
