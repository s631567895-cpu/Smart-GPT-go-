import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/** 3 dots rotating in a circle + colour-shifting "Smart GPT" wordmark. */
export function BrandThinking({ size = 28, label = true }: { size?: number; label?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="sg-orbit" style={{ width: size, height: size }}>
        <i /><i /><i />
      </span>
      {label && <span className="sg-hue font-display text-sm font-semibold">Smart GPT</span>}
    </div>
  );
}

/** Full-screen "Smart GPT" splash shown for ~2s whenever the route changes. */
export function RouteSplash({ duration = 2000 }: { duration?: number }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [pathname, duration]);

  if (!visible) return null;

  return (
    <div className="sg-splash fixed inset-0 z-[100] grid place-items-center backdrop-blur-xl">
      <div className="flex flex-col items-center gap-5">
        <span className="sg-orbit" style={{ width: 56, height: 56 }}>
          <i /><i /><i />
        </span>
        <span className="sg-hue font-display text-3xl font-bold tracking-tight">Smart GPT</span>
      </div>
    </div>
  );
}
