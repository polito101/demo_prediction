import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { TenantSettingsForm } from "@/components/admin/tenant-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  if (!tenant) redirect("/");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marca blanca</h1>
      <TenantSettingsForm
        initialName={tenant.name}
        initialColor={tenant.primaryColor}
        initialLogoUrl={tenant.logoUrl}
      />
    </div>
  );
}
