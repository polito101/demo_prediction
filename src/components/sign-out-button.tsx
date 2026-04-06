"use client";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <DropdownMenuItem
      onClick={() => signOut({ callbackUrl: "/" })}
      className="cursor-pointer"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Salir
    </DropdownMenuItem>
  );
}
