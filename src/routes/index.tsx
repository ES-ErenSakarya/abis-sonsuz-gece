import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import { clearChunkRetry } from "@/lib/error-component";
import { Overlay } from "@/game/Overlay";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [Scene, setScene] = useState<ComponentType | null>(null);
  const [worldError, setWorldError] = useState(false);

  useEffect(() => {
    clearChunkRetry();
  }, []);

  useEffect(() => {
    let dead = false;
    const load = () => {
      if (dead) return;
      setWorldError(false);
      void import("@/game/VillageScene")
        .then((mod) => {
          if (!dead) setScene(() => mod.VillageScene);
        })
        .catch(() => {
          if (!dead) setWorldError(true);
        });
    };
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(load);
    });
    return () => {
      dead = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      {Scene ? <Scene /> : null}
      {worldError ? (
        <button
          type="button"
          className="absolute top-4 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
          onClick={() => window.location.reload()}
        >
          Dünya açılmadı. Yenile
        </button>
      ) : null}
      <Overlay sceneReady={!!Scene} />
    </main>
  );
}
