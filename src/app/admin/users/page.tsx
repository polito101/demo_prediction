import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "@/components/admin/user-actions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const users = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { positions: true, trades: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Ops / Pos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[220px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">
                  {Number(u.balance).toFixed(2)}
                </TableCell>
                <TableCell>
                  {u._count.trades} / {u._count.positions}
                </TableCell>
                <TableCell>
                  {u.suspended ? (
                    <Badge variant="destructive">Suspendido</Badge>
                  ) : (
                    <Badge variant="outline">Activo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <UserActions
                    userId={u.id}
                    isSelf={u.id === session.user.id}
                    suspended={u.suspended}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
