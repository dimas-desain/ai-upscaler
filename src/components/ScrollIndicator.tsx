"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  targetId: string;
};

export default function ScrollIndicator({ targetId }: Props) {
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const styles = useMemo(() => {
    return {
      bar: {
        transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
      } as React.CSSProperties,
    };
  }, [progress]);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;

    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 1) {
        setProgress(0);
        setShowHint(false);
        return;
      }
      const p = el.scrollTop / max;
      setProgress(p);
      setShowHint(el.scrollTop < max - 4);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [targetId]);

  return (
    <>
      {/* Progress bar (only visible when scrollable) */}
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-[2px] bg-transparent">
        <div
          className={[
            "h-full origin-left bg-blue-500/80",
            progress > 0 || showHint ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={styles.bar}
        />
      </div>

      {/* Subtle hint to scroll when there is overflow */}
      <div
        className={[
          "pointer-events-none fixed bottom-3 left-1/2 z-40 -translate-x-1/2 transition-opacity",
          showHint ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur">
          <span>Scroll</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>
      </div>
    </>
  );
}

