/**
 * Tooltip Component
 *
 * Lightweight tooltip wrapper for editor controls.
 */

import type { ReactNode } from "react";
import { STYLES } from "./constants";

interface TooltipProps {
  /** Tooltip content shown on hover/focus */
  content: string;
  /** Wrapped trigger element */
  children: ReactNode;
}

export const Tooltip = ({ content, children }: TooltipProps) => (
  <div className={STYLES.tooltipWrapper}>
    {children}
    <div aria-hidden="true" className={STYLES.tooltip}>
      {content}
    </div>
  </div>
);
