"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTenantBranding } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function TenantSettingsForm({
  initialName,
  initialColor,
  initialLogoUrl,
}: {
  initialName: string;
  initialColor: string;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [primaryColor, setPrimaryColor] = useState(initialColor);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await updateTenantBranding({
      name,
      primaryColor,
      logoUrl: logoUrl || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success("Marca actualizada");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del sitio</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Color primario (#hex)</Label>
        <Input
          id="color"
          value={primaryColor}
          onChange={(e) => setPrimaryColor(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logo">URL del logo</Label>
        <Input
          id="logo"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…"
        />
        <p className="text-xs text-muted-foreground">
          Sube la imagen a tu CDN y pega la URL (subida directa en una versión
          futura).
        </p>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
