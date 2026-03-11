import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({ open, onClose, title, children, maxWidthClass }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  if (!open) return null;

  const widthClass = maxWidthClass || 'w-[min(92vw,32rem)] max-w-none';

  return (
    <dialog
      ref={dialogRef}
      className={`fixed inset-0 z-50 m-auto ${widthClass} rounded-xl border border-border-default bg-surface-1 p-0 text-text-primary shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm`}
      onClose={onClose}
    >
      <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 py-4">{children}</div>
    </dialog>
  );
}
