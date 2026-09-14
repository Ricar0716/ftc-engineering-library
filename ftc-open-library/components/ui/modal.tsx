"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type ModalProps = {
  title: string;
  triggerLabel: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ title, triggerLabel, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button variant="secondary" onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        className={cn(
          "m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border border-line bg-surface p-0 text-ink shadow-lg",
          "backdrop:bg-ink/40",
          className,
        )}
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="modal-title" className="text-base font-medium">
            {title}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => dialogRef.current?.close()}>
            Close
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </dialog>
    </>
  );
}
