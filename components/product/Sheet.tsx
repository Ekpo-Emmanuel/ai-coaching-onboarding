"use client";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

const DISMISS_PX = 88;

export function Sheet({ children, titleId, onClose, busy = false, showClose = false, className }: {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
  busy?: boolean;
  showClose?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef({ y: 0, active: false });
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);

  function dismissBackdrop(event: { currentTarget: HTMLDialogElement; clientX: number; clientY: number; target: EventTarget | null }) {
    if (busy || window.matchMedia("(min-width: 900px)").matches) return;
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) onClose();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (busy || window.matchMedia("(min-width: 900px)").matches) return;
    const target = event.target as Element | null;
    if (!target?.closest(".sheet-handle")) return;
    drag.current = { y: event.clientY, active: true };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    setOffset(Math.max(0, event.clientY - drag.current.y));
  }

  function onPointerUp() {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    setOffset((current) => {
      if (current >= DISMISS_PX) {
        onClose();
        return current;
      }
      return 0;
    });
  }

  return <dialog
    ref={ref}
    className={className ? `native-sheet ${className}` : "native-sheet"}
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => dismissBackdrop(event)}
  >
    <div
      className="sheet-panel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform: `translateY(${offset}px)`,
        transition: dragging ? "none" : "transform .18s ease-out",
        animation: dragging || offset ? "none" : undefined,
      }}
    >
      <div className="sheet-handle" aria-hidden="true"><span className="sheet-handle-bar" /></div>
      <button className={showClose ? "modal-close" : "modal-close sheet-close-wide"} type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button>
      {children}
    </div>
  </dialog>;
}
