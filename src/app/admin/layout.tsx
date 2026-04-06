import Link from "next/link";
import { LayoutDashboard, Settings, Store, Users } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      <aside className="space-y-1 text-sm">
        <p className="mb-2 font-semibold text-muted-foreground">CRM</p>
        <Link
          href="/admin"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
        >
          <Users className="h-4 w-4" />
          Usuarios
        </Link>
        <Link
          href="/admin/markets"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
        >
          <Store className="h-4 w-4" />
          Mercados
        </Link>
        <Link
          href="/admin/settings"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Marca
        </Link>
        <Link
          href="/"
          className="mt-4 block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted"
        >
          ← Sitio público
        </Link>
      </aside>
      <div>{children}</div>
    </div>
  );
}
