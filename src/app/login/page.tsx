import { LoginForm } from "@/components/auth/login-form";
import { getTenantFromRequest } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const tenant = await getTenantFromRequest();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <LoginForm tenantId={tenant.id} />
    </div>
  );
}
