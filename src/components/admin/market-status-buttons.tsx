"use client";

import { useRouter } from "next/navigation";
import { updateMarket } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function MarketPauseButton({ marketId }: { marketId: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        const res = await updateMarket({ marketId, status: "PAUSED" });
        if (!res.ok) toast.error(res.error ?? "Error");
        else {
          toast.success("Mercado pausado");
          router.refresh();
        }
      }}
    >
      Pausar
    </Button>
  );
}

export function MarketResumeButton({ marketId }: { marketId: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        const res = await updateMarket({ marketId, status: "OPEN" });
        if (!res.ok) toast.error(res.error ?? "Error");
        else {
          toast.success("Mercado reabierto");
          router.refresh();
        }
      }}
    >
      Reabrir
    </Button>
  );
}
