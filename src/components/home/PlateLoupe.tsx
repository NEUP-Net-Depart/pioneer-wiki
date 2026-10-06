"use client";

import { useRef } from "react";

/**
 * A naturalist's hand lens over the frontispiece: move across the plate and a
 * round loupe magnifies the engraving under the pointer, with its plate
 * coordinates typed beside it. Fine pointers only; purely visual (the plate
 * keeps its alt text), so touch and keyboard readers lose nothing.
 */
export function PlateLoupe({
  src,
  zoom = 2.2,
  className,
  children,
}: {
  src: string;
  zoom?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLSpanElement>(null);

  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !box.current || !lens.current || !tag.current) return;
    const r = box.current.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const size = lens.current.offsetWidth;
    const l = lens.current.style;
    l.left = `${x}px`;
    l.top = `${y}px`;
    l.backgroundImage = `url(${src})`;
    l.backgroundSize = `${r.width * zoom}px ${r.height * zoom}px`;
    l.backgroundPosition = `${size / 2 - x * zoom}px ${size / 2 - y * zoom}px`;
    lens.current.dataset.on = "";
    const t = tag.current.style;
    t.left = `${x + size / 2 + 14}px`;
    t.top = `${y + size / 2 - 18}px`;
    tag.current.textContent = `×${zoom.toFixed(1)}  ·  ${(x / r.width).toFixed(2)} / ${(y / r.height).toFixed(2)}`;
    tag.current.dataset.on = "";
  };

  const leave = () => {
    lens.current?.removeAttribute("data-on");
    tag.current?.removeAttribute("data-on");
  };

  return (
    <div ref={box} onPointerMove={move} onPointerLeave={leave} className={className} style={{ cursor: "crosshair" }}>
      {children}
      <div ref={lens} aria-hidden="true" className="pw-loupe" />
      <span ref={tag} aria-hidden="true" className="pw-loupe-tag" />
    </div>
  );
}
