/**
 * ToolbarButton Component
 *
 * Individual button in the editor toolbar with active state styling.
 */

import { Tooltip } from "./Tooltip";
import { STYLES } from "./constants";

interface ToolbarButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Whether button is in active state */
  active?: boolean;
  /** Tooltip text */
  tooltip: string;
  /** Button content (icon) */
  children: React.ReactNode;
  /** Mouse down handler (for focus management) */
  onMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * ToolbarButton - Formatting toolbar button
 *
 * Renders a button with active/inactive styling for the editor toolbar.
 * Prevents focus stealing to maintain editor selection.
 *
 * @param props - Component props
 *
 * @example
 * <ToolbarButton
 *   onClick={() => execCommand("bold")}
 *   active={activeStyles.bold}
 *   tooltip="Bold (Ctrl+B)"
 *   onMouseDown={preventFocus}
 * >
 *   <Bold size={16} />
 * </ToolbarButton>
 */
export const ToolbarButton = ({
  onClick,
  active = false,
  tooltip,
  children,
  onMouseDown,
}: ToolbarButtonProps) => (
  <Tooltip content={tooltip}>
    <button
      type="button"
      onMouseDown={onMouseDown}
      onClick={onClick}
      aria-label={tooltip}
      className={`${STYLES.toolbarButton} ${
        active ? STYLES.toolbarButtonActive : STYLES.toolbarButtonInactive
      }`}
    >
      {children}
    </button>
  </Tooltip>
);
