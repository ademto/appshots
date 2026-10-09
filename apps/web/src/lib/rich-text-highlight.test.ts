/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
  RICH_TEXT_HIGHLIGHT_ATTRIBUTE,
  RICH_TEXT_HIGHLIGHT_COLOR_VAR,
  RICH_TEXT_HIGHLIGHT_RADIUS_EM,
  RICH_TEXT_HIGHLIGHT_RADIUS_VAR,
  RICH_TEXT_HIGHLIGHT_SPREAD_EM,
  RICH_TEXT_HIGHLIGHT_SPREAD_VAR,
  normalizeRichTextHighlights,
} from "./rich-text-highlight";

describe("normalizeRichTextHighlights", () => {
  it("adds shared highlight styling metadata to background-colored spans", () => {
    const normalized = normalizeRichTextHighlights(
      '<span style="background-color: rgb(255, 255, 0);">Hello</span>',
    );
    const doc = new DOMParser().parseFromString(
      `<div>${normalized}</div>`,
      "text/html",
    );
    const element = doc.querySelector("span");

    expect(element?.getAttribute(RICH_TEXT_HIGHLIGHT_ATTRIBUTE)).toBe("true");
    expect(element?.style.backgroundColor).toBe("rgb(255, 255, 0)");
    expect(element?.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_COLOR_VAR)).toBe(
      "rgb(255, 255, 0)",
    );
    expect(element?.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_SPREAD_VAR)).toBe(
      `${RICH_TEXT_HIGHLIGHT_SPREAD_EM}em`,
    );
    expect(element?.style.getPropertyValue(RICH_TEXT_HIGHLIGHT_RADIUS_VAR)).toBe(
      `${RICH_TEXT_HIGHLIGHT_RADIUS_EM}em`,
    );
  });

  it("upgrades mark elements so they use the shared highlight styling", () => {
    const normalized = normalizeRichTextHighlights("<mark>Highlighted</mark>");
    const doc = new DOMParser().parseFromString(
      `<div>${normalized}</div>`,
      "text/html",
    );
    const element = doc.querySelector("mark");

    expect(element?.getAttribute(RICH_TEXT_HIGHLIGHT_ATTRIBUTE)).toBe("true");
    expect(element?.style.backgroundColor).toBe("yellow");
  });
});
