"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserSuspended, adjustUserBalance } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function UserActions({
  userId,
  isSelf,
  suspended,
}: {
  userId: string;
  isSelf: boolean;
  suspended: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  async function toggleSuspend() {
    setLoading(true);
    const res = await setUserSuspended({ userId, suspended: !suspended });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success(suspended ? "Cuenta reactivada" : "Cuenta suspendida");
    router.refresh();
  }

  async function submitAdjust() {
    setLoading(true);
    const res = await adjustUserBalance({
      userId,
      amount: Number(amount),
      reason: reason || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error ?? "Error");
      return;
    }
    toast.success("Saldo actualizado");
    setOpen(false);
    setAmount("");
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1">
      {!isSelf && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={toggleSuspend}
        >
          {suspended ? "Reactivar" : "Suspender"}
        </Button>
      )}
      {!isSelf && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Ajustar saldo
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajuste manual de saldo</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="adj">Importe (+ o −)</Label>
                  <Input
                    id="adj"
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reas">Motivo (opcional)</Label>
                  <Input
                    id="reas"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  disabled={loading || amount === ""}
                  onClick={submitAdjust}
                >
                  Guardar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
