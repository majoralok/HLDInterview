import type { Diagram } from "./architecture-core.js";
export function createWorkbench(host: HTMLElement, options: { value: Diagram; onChange: (diagram: Diagram) => void; disabled?: boolean }): { setDisabled(value: boolean): void; destroy(): void };
