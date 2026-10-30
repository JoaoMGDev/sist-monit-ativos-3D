import { useEffect, useRef } from "react";
import { Boxes } from "lucide-react";

/** Passagem curta entre o login aceito e a área autenticada. */
export function AuthSplash({ onDone }: { onDone: () => void }) {
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  const barRef = useRef<HTMLDivElement>(null);
  onDoneRef.current = onDone;

  useEffect(() => {
    const finish = () => {
      if (done.current) return;
      done.current = true;
      onDoneRef.current();
    };
    const bar = barRef.current;
    bar?.addEventListener("animationend", finish);
    const timer = window.setTimeout(finish, 900);
    return () => {
      bar?.removeEventListener("animationend", finish);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label="Entrando no AtivosTI"
    >
      <div className="flex items-center gap-2.5 text-foreground">
        <Boxes className="h-6 w-6" />
        <span className="text-lg font-semibold tracking-tight">AtivosTI</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Entrando</p>
      <div className="mt-5 h-0.5 w-40 overflow-hidden rounded-full bg-border">
        <div ref={barRef} className="auth-fill h-full w-full bg-primary" />
      </div>
    </div>
  );
}
