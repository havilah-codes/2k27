"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-line bg-paper-elevated px-6 py-12 text-center">
      <h2 className="text-xl font-black tracking-tight text-ink">Something jammed.</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        The page hit an unexpected error. Try reloading — your anonymous bits are safe.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-faint">Error digest: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          Back home
        </Button>
      </div>
    </div>
  );
}
