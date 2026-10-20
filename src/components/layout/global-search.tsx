"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

/**
 * Global search. The registers it searches arrive with WA-27, so submitting
 * says exactly that instead of failing quietly or returning nothing.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const t = useTranslations("shell.search");
  const [value, setValue] = useState("");

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        toast.info(t("hint"));
      }}
    >
      <label className="sr-only" htmlFor="global-search">
        {t("label")}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        id="global-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t("placeholder")}
        className="h-8 pl-7"
      />
    </form>
  );
}
