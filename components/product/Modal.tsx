"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({ children, titleId, onClose, busy = false }: { children: ReactNode; titleId: string; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="native-modal" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}><div className="modal-panel"><button className="modal-close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button>{children}</div></dialog>;
}
