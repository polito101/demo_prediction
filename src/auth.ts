import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/generated/prisma/enums";
import { authorizeCredentials } from "@/lib/auth/credentials";

const authSecret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;

if (!authSecret) {
  console.warn(
    "[auth] AUTH_SECRET/NEXTAUTH_SECRET no definido. " +
      "Usando secret de fallback (solo válido para desarrollo)."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret ?? "dev-only-insecure-secret-change-me",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantId: { label: "Tenant", type: "text" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tenantId = token.tenantId as string;
      }
      return session;
    },
  },
});
