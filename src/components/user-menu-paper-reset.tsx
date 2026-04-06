"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RotateCcw } from "lucide-react";
import { PAPER_PORTFOLIO_RESET_EVENT } from "@/lib/paper-portfolio-events";

export function UserMenuPaperReset() {
  const [busy, setBusy] = useState(false);

  async function onReset() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/paper-trading/reset", { method: "POST" });
      if (!res.ok) {
        toast.error("No se pudo resetear el portfolio en la base de datos.");
        return;
      }
      toast.success("Portfolio paper reseteado.");
      window.dispatchEvent(new Event(PAPER_PORTFOLIO_RESET_EVENT));
    } catch {
      toast.error("Error de red al resetear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenuItem
      variant="destructive"
      className="cursor-pointer"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        void onReset();
      }}
    >
      <RotateCcw className="mr-2 h-4 w-4" />
      {busy ? "Reseteando portfolio…" : "Reset portfolio paper (BD)"}
    </DropdownMenuItem>
  );
}
