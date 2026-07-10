import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

export function Campo({
  label,
  htmlFor,
  ayuda,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          aria-live="polite"
          className="flex items-center gap-1.5 text-sm text-danger"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-sm text-muted-foreground">{ayuda}</p>
      ) : null}
    </div>
  );
}
