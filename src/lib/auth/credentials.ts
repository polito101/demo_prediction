import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password" | "tenantId", unknown>>
) {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;
  const tenantId = credentials?.tenantId as string | undefined;
  if (!email || !password) return null;

  const user = await prisma.user.findFirst({
    where: tenantId ? { tenantId, email } : { email },
  });

  if (!user?.passwordHash || user.suspended) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    tenantId: user.tenantId,
  };
}
