import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function ConnectingOverlay({
  show,
  label = "Connecting",
  sublabel,
}: {
  show: boolean;
  label?: string;
  sublabel?: string;
}) {
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!show) return;
    const i = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(i);
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-xl animate-fade-in">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
          <div className="absolute inset-3 rounded-full bg-foreground/90" />
        </div>
        <div className="text-center">
          <div className="text-base font-semibold tracking-tight">
            {label}
            <span className="inline-block w-5 text-left">{dots}</span>
          </div>
          {sublabel && (
            <div className="mt-1 text-xs text-muted-foreground mono">{sublabel}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RouterConnecting() {
  const status = useRouterState({ select: (s) => s.status });
  const isLoading = status === "pending";
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(t);
  }, [isLoading]);
  return <ConnectingOverlay show={show} label="Connecting" sublabel="opening page" />;
}
