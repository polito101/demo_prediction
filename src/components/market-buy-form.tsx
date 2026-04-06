"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buyShares } from "@/actions/trading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Outcome = { id: string; name: string };

export function MarketBuyForm({
  marketId,
  outcomes,
}: {
  marketId: string;
  outcomes: Outcome[];
}) {
  const router = useRouter();
  const [outcomeId, setOutcomeId] = useState(outcomes[0]?.id ?? "");
  const [amount, setAmount] = useState("10");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await buyShares({
      marketId,
      outcomeId,
      amount: Number(amount),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success("Operación registrada");
    router.refresh();
  }

  if (!outcomes.length) return null;

  const selectedOutcome = outcomes.find((o) => o.id === outcomeId);

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Comprar (AMM LMSR)</h3>
      <div className="space-y-2">
        <Label>Opción</Label>
        <Select
          value={outcomeId}
          onValueChange={(v) => v && setOutcomeId(v)}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Elige Sí o No">
              {selectedOutcome?.name ?? "—"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {outcomes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amt">Importe (moneda demo)</Label>
        <Input
          id="amt"
          type="number"
          min={0.01}
          step={0.01}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Procesando…" : "Comprar"}
      </Button>
    </form>
  );
}
