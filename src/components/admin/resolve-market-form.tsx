"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveMarket } from "@/actions/resolve-market";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type OutcomeOption = { id: string; name: string };

export function ResolveMarketForm({
  marketId,
  outcomes,
}: {
  marketId: string;
  outcomes: OutcomeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [winningOutcomeId, setWinningOutcomeId] = useState(
    outcomes[0]?.id ?? ""
  );
  const [note, setNote] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!winningOutcomeId) {
      toast.error("Elige la opción ganadora");
      return;
    }
    setLoading(true);
    const res = await resolveMarket({
      marketId,
      winningOutcomeId,
      note: note.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error al resolver");
      return;
    }
    if ("alreadyResolved" in res && res.alreadyResolved) {
      toast.message("Este mercado ya estaba resuelto");
    } else {
      toast.success("Mercado resuelto");
    }
    setOpen(false);
    setNote("");
    router.refresh();
  }

  if (outcomes.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => {
          setWinningOutcomeId(outcomes[0]?.id ?? "");
          setOpen(true);
        }}
      >
        Resolver
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Resolver mercado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Opción ganadora</Label>
                <Select
                  value={winningOutcomeId}
                  onValueChange={(v) => {
                    if (v) setWinningOutcomeId(v);
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elige una opción" />
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
                <Label htmlFor={`note-${marketId}`}>Nota (opcional)</Label>
                <Textarea
                  id={`note-${marketId}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Motivo o comentario interno"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Resolviendo…" : "Confirmar resolución"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
