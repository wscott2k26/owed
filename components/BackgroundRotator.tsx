"use client";

import { useEffect, useState } from "react";

const SCENES = [1, 2, 3, 4, 5];
const ROTATE_MS = 45_000;
const FADE_CLASS = "is-active";

/**
 * Ambient background rotator — cycles five dark trade-craft scenes
 * behind the dashboard, crossfading every 45 seconds. Pure CSS art,
 * zero assets. Honors prefers-reduced-motion by holding the first scene.
 */
export default function BackgroundRotator() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SCENES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div aria-hidden="true" className="owed-bg-rotator">
      {SCENES.map((n, i) => (
        <div
          key={n}
          className={`owed-bg-scene owed-bg-scene-${n}${
            i === active ? ` ${FADE_CLASS}` : ""
          }`}
        />
      ))}
    </div>
  );
}
