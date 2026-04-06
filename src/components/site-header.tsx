
import Link from "next/link";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, User } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

type Tenant = {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
};

export async function SiteHeader({ tenant }: { tenant: Tenant }) {
  const session = await auth();

  return (
    <header
      className="border-b bg-card/80 backdrop-blur"
      style={
        {
          "--tenant-primary": tenant.primaryColor,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt=""
              width={32}
              height={32}
              className="rounded-md object-contain"
            />
          ) : (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-white"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              {tenant.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>{tenant.name}</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link href="/" className={buttonVariants({ variant: "ghost" })}>
            Mercados
          </Link>
          {session?.user && (
            <Link href="/portfolio" className={buttonVariants({ variant: "ghost" })}>
              Portfolio
            </Link>
          )}
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin" className={buttonVariants({ variant: "ghost" })}>
              <LayoutDashboard className="mr-1 inline h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        <div>
          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "cursor-pointer"
                )}
              >
                <User className="mr-1 h-4 w-4" />
                {session.user.email}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Link href="/portfolio" className="w-full">
                    Mi portfolio
                  </Link>
                </DropdownMenuItem>
                <SignOutButton />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "sm" }),
                "text-white hover:opacity-90"
              )}
              style={{ backgroundColor: tenant.primaryColor }}
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
