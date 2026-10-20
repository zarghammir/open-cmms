"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
}

/**
 * The actions on a row.
 *
 * The trigger's accessible name says which row it belongs to — twenty buttons
 * all called "Actions" is a list a screen reader user cannot navigate.
 */
export function DataTableRowActions({
  label,
  actions,
}: {
  /** Names this row, e.g. "Actions for AHU-KGN-11". */
  label: string;
  actions: readonly RowAction[];
}) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem key={action.key} onSelect={action.onSelect}>
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
