"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMarket } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CreateMarketForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [outcomesRaw, setOutcomesRaw] = useState("Sí\nNo");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outcomes = outcomesRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setLoading(true);
    const res = await createMarket({
      title,
      description: description || undefined,
      category: category || undefined,
      outcomes,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success("Mercado creado");
    setTitle("");
    setDescription("");
    setCategory("");
    setOutcomesRaw("Sí\nNo");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Nuevo mercado</h3>
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="desc">Descripción</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cat">Categoría</Label>
        <Input
          id="cat"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="out">Opciones (una por línea, mín. 2)</Label>
        <Textarea
          id="out"
          value={outcomesRaw}
          onChange={(e) => setOutcomesRaw(e.target.value)}
          rows={4}
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Creando…" : "Crear mercado"}
      </Button>
    </form>
  );
}
