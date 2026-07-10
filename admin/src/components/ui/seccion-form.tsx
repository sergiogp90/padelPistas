import { cn } from "@/lib/utils";

export function SeccionForm({
  titulo,
  descripcion,
  children,
  className,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-seccion", className)}>
      <header className="border-b border-border px-7 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {titulo}
        </h2>
        {descripcion ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{descripcion}</p>
        ) : null}
      </header>
      <div className="space-y-6 px-7 py-7">{children}</div>
    </section>
  );
}
