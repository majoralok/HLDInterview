"use client";
import { useEffect, useRef } from "react";
import { createWorkbench } from "@/public/architecture-workbench.js";
import type { Diagram } from "@/public/architecture-core.js";

export function ArchitectureCanvas({ value, onChange, disabled }: { value: Diagram; onChange: (diagram: Diagram) => void; disabled: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const initial = useRef(value);
  const onChangeRef = useRef(onChange);
  const controller = useRef<ReturnType<typeof createWorkbench> | null>(null);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!host.current) return;
    controller.current = createWorkbench(host.current, { value: initial.current, onChange: diagram => onChangeRef.current(diagram) });
    return () => { controller.current?.destroy(); controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.setDisabled(disabled); }, [disabled]);
  return <div ref={host} />;
}
