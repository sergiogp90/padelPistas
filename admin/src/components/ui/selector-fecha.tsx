"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SelectorFechaProps {
  id?: string;
  name: string;
  defaultValue?: Date;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  placeholder?: string;
}

function formatearFechaISO(fecha: Date): string {
  const ano = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatearFechaVisible(fecha: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

export function SelectorFecha({
  id,
  name,
  defaultValue,
  ariaInvalid,
  ariaDescribedBy,
  placeholder = "Selecciona fecha",
}: SelectorFechaProps) {
  const [fecha, setFecha] = useState<Date | undefined>(defaultValue);
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          id={id}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-colors hover:bg-muted/30",
            "outline-none focus-visible:border-clay-500 focus-visible:ring-2 focus-visible:ring-clay-500/30",
            !fecha && "text-muted-foreground",
          )}
        >
          <span>{fecha ? formatearFechaVisible(fecha) : placeholder}</span>
          <CalendarIcon className="size-4 opacity-60" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={fecha}
            onSelect={(d) => {
              setFecha(d);
              if (d) setAbierto(false);
            }}
            locale={es}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <input
        type="hidden"
        name={name}
        value={fecha ? formatearFechaISO(fecha) : ""}
      />
    </>
  );
}
