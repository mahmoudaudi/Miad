"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Deterministic per-index pseudo-randomness.
 *
 * Upstream called Math.random() while rendering, which yields a different
 * delay and duration on the server than the client and so a hydration
 * mismatch. This uses integer-only LCG maths instead: unlike Math.random or
 * Math.sin, integer arithmetic is bit-identical in Node and the browser, and
 * the result is rounded so the inline style is stable.
 */
function jitter(seed: number, spread: number): number {
  let x = (seed * 1103515245 + 12345) & 0x7fffffff;
  x = (x * 1103515245 + 12345) & 0x7fffffff;
  return Math.round((((x >>> 8) % 1000) / 1000) * spread * 100) / 100;
}

export const Meteors = ({
  number,
  className,
}: {
  number?: number;
  className?: string;
}) => {
  const count = number || 20;
  const meteors = new Array(count).fill(true);

  return (
    <div
      aria-hidden="true"
      data-meteors=""
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {meteors.map((_, idx) => (
        <span
          key={"meteor" + idx}
          className={cn(
            // Theme-aware fills: the upstream slate/#64748b pair sat on a cool
            // gray, which does not belong on this warm palette in either mode.
            "animate-meteor-effect absolute h-0.5 w-0.5 rotate-[45deg] rounded-[9999px] bg-ink/40",
            "before:absolute before:top-1/2 before:h-[1px] before:w-[50px] before:-translate-y-[50%] before:transform before:bg-gradient-to-r before:from-ink/45 before:to-transparent before:content-['']",
            className,
          )}
          style={{
            // Above the container so they enter from off-screen, as upstream.
            top: "-40px",
            // Spread across the full width so the field also works on mobile,
            // where a fixed 800px range left most of the screen empty.
            left: `${(idx * 100) / count + jitter(idx, 3) - 1.5}%`,
            animationDelay: `${jitter(idx + 7, 5)}s`,
            animationDuration: `${5 + jitter(idx + 3, 5)}s`,
          }}
        ></span>
      ))}
    </div>
  );
};
