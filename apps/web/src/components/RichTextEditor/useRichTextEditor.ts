/**
 * useRichTextEditor Hook
 *
 * Custom hook managing rich text editor state and formatting.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import type { ActiveStyles } from "./types";
import {
  DEFAULT_ACTIVE_STYLES,
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_TEXT_COLOR,
} from "./constants";
import { isContentEmpty, getActiveStyles, executeCommand } from "./utils";
import {
  normalizeRichTextHighlightRoot,
  normalizeRichTextHighlights,
} from "../../lib/rich-text-highlight";

interface UseRichTextEditorOptions {
  /** Initial/controlled HTML value */
  value: string;
  /** Callback when content changes */
  onChange: (html: string) => void;
}

interface UseRichTextEditorReturn {
  /** Ref for the contenteditable div */
  editorRef: React.RefObject<HTMLDivElement | null>;
  /** Current text color */
  textColor: string;
  /** Current text highlight color */
  backgroundColor: string;
  /** Whether the editor is empty */
  isEmpty: boolean;
  /** Current active formatting styles */
  activeStyles: ActiveStyles;
  /** Execute a formatting command */
  execCommand: (command: string, value?: string) => void;
  /** Handle input changes */
  handleInput: () => void;
  /** Handle color picker change */
  handleColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handle highlight color picker change */
  handleBackgroundColorChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Trigger change callback */
  triggerChange: () => void;
  /** Update active styles from selection */
  updateActiveStyles: () => void;
}

/**
 * useRichTextEditor - Manages rich text editor state
 *
 * Handles formatting commands, selection tracking, and content synchronization.
 *
 * @param options - Hook configuration
 * @param options.value - Controlled HTML value
 * @param options.onChange - Change callback
 * @returns Editor state and handlers
 *
 * @example
 * const {
 *   editorRef,
 *   activeStyles,
 *   execCommand,
 *   handleInput,
 * } = useRichTextEditor({ value, onChange });
 */
export const useRichTextEditor = ({
  value,
  onChange,
}: UseRichTextEditorOptions): UseRichTextEditorReturn => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT_COLOR);
  const [backgroundColor, setBackgroundColor] = useState(
    DEFAULT_BACKGROUND_COLOR,
  );
  const [isEmpty, setIsEmpty] = useState(true);
  const [activeStyles, setActiveStyles] = useState<ActiveStyles>(
    DEFAULT_ACTIVE_STYLES,
  );

  // Update active styles from current selection
  const updateActiveStyles = useCallback(() => {
    setActiveStyles(getActiveStyles());
  }, []);

  // Trigger onChange callback
  const triggerChange = useCallback(() => {
    if (editorRef.current) {
      normalizeRichTextHighlightRoot(editorRef.current);
      const html = editorRef.current.innerHTML;
      setIsEmpty(isContentEmpty(html));
      onChange(html);
    }
  }, [onChange]);

  // Execute formatting command
  const execCommand = useCallback(
    (command: string, commandValue?: string) => {
      editorRef.current?.focus();
      executeCommand(command, commandValue);
      updateActiveStyles();
      triggerChange();
    },
    [updateActiveStyles, triggerChange],
  );

  // Handle input changes
  const handleInput = useCallback(() => {
    triggerChange();
    updateActiveStyles();
  }, [triggerChange, updateActiveStyles]);

  // Handle color change
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value;
      setTextColor(color);
      execCommand("foreColor", color);
    },
    [execCommand],
  );

  // Handle highlight color change
  const handleBackgroundColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value;
      setBackgroundColor(color);
      execCommand("hiliteColor", color);
    },
    [execCommand],
  );

  // Sync external value changes
  useEffect(() => {
    const normalizedValue = normalizeRichTextHighlights(value);

    if (
      editorRef.current &&
      editorRef.current.innerHTML !== normalizedValue
    ) {
      editorRef.current.innerHTML = normalizedValue;
      setIsEmpty(isContentEmpty(normalizedValue));
    }
  }, [value]);

  // Listen for selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && editorRef.current?.contains(selection.anchorNode)) {
        updateActiveStyles();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [updateActiveStyles]);

  return {
    editorRef,
    textColor,
    backgroundColor,
    isEmpty,
    activeStyles,
    execCommand,
    handleInput,
    handleColorChange,
    handleBackgroundColorChange,
    triggerChange,
    updateActiveStyles,
  };
};
