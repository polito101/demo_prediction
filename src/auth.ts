import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@/generated/prisma/enums";
import { authorizeCredentials } from "@/lib/auth/credentials";

/** Render inyecta `RENDER_EXTERNAL_URL` (https://…onrender.com); Auth.js usa `AUTH_URL`. */
const renderUrl = process.env.RENDER_EXTERNAL_URL;
if (renderUrl && !process.env.AUTH_URL) process.env.AUTH_URL = renderUrl;
if (renderUrl && !process.env.NEXTAUTH_URL) process.env.NEXTAUTH_URL = renderUrl;

const authSecret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? null;

if (!authSecret) {
  console.warn(
    "[auth] AUTH_SECRET/NEXTAUTH_SECRET no definido. " +
      "Usando secret de fallback (solo válido para desarrollo)."
  );
}

/** Auth.js puede emitir JWTSessionError desde otra copia de @auth/core (p. ej. vía next-auth); `instanceof` falla. */
function isJwtSessionError(error: Error): boolean {
  const t = "type" in error ? (error as { type?: string }).type : undefined;
  return error.name === "JWTSessionError" || t === "JWTSessionError";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret ?? "dev-only-insecure-secret-change-me",
  /** Evita ruido en consola cuando hay cookie antigua firmada con otro secret (Auth.js la borra igual). */
  logger: {
    error(error) {
      if (isJwtSessionError(error)) return;
      const red = "\x1b[31m";
      const reset = "\x1b[0m";
      const name =
        "type" in error && typeof error.type === "string"
          ? error.type
          : error.name;
      console.error(`${red}[auth][error]${reset} ${name}: ${error.message}`);
    },
  },
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
