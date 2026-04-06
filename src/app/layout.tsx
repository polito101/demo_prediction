import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { getTenantFromRequest } from "@/lib/tenant";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prediction Market",
  description: "Mercados de predicción white-label",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getTenantFromRequest();

  return (
    <html lang="es">
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`
        )}
        style={
          {
            "--primary": tenant.primaryColor,
            "--ring": tenant.primaryColor,
          } as React.CSSProperties
        }
      >
        <Providers>
          <SiteHeader tenant={tenant} />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <Toaster richColors position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
