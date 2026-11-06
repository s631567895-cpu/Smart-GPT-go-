import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type SelectGroup = { label?: string; options: readonly string[] };

export function SearchableSelect({
  value,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options?: readonly string[];
  groups?: readonly SelectGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const resolved: readonly SelectGroup[] = groups ?? [{ options: options ?? [] }];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-input/40 px-4 py-2.5 text-left text-sm outline-none transition-colors hover:border-primary/50 focus:border-primary/60"
          >
            <span className={cn("truncate", !value && "text-muted-foreground/70")}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-64">
              <CommandEmpty>No results found.</CommandEmpty>
              {resolved.map((g, gi) => (
                <CommandGroup key={g.label ?? gi} heading={g.label}>
                  {g.options.map((opt) => (
                    <CommandItem
                      key={`${gi}-${opt}`}
                      value={opt}
                      onSelect={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                      {opt}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
