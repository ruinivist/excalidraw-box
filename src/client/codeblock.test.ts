import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CODE_BLOCK_SHOW_BACKGROUND,
  EMPTY_CODE_BLOCK_SELECTION_STATE,
  createCodeBlockCustomData,
  getCodeBlockSelectionState,
  getCodeBlockCustomData,
  isCodeBlockEmbeddable,
  sanitizeCodeBlockLanguage,
  updateCodeBlockElements,
} from "./codeblock";

const baseEmbeddable = {
  id: "codeblock-1",
  type: "embeddable" as const,
  x: 10,
  y: 20,
  strokeColor: "transparent",
  backgroundColor: "transparent",
  fillStyle: "solid" as const,
  strokeWidth: 1,
  strokeStyle: "solid" as const,
  roundness: null,
  roughness: 0,
  opacity: 100,
  width: 420,
  height: 260,
  angle: 0,
  seed: 1,
  version: 1,
  versionNonce: 2,
  index: null,
  isDeleted: false,
  groupIds: [],
  frameId: null,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
};

describe("codeblock helpers", () => {
  test("type guard accepts only repo-owned codeblock embeddables", () => {
    expect(
      isCodeBlockEmbeddable({
        ...baseEmbeddable,
        customData: createCodeBlockCustomData(),
      }),
    ).toBe(true);

    expect(
      isCodeBlockEmbeddable({
        ...baseEmbeddable,
        customData: {
          excaliType: "other",
          version: 2,
          code: "",
          language: "tsx",
          showBackground: true,
        },
      }),
    ).toBe(false);

    expect(
      isCodeBlockEmbeddable({
        ...baseEmbeddable,
        link: "https://example.com",
        customData: createCodeBlockCustomData(),
      }),
    ).toBe(false);

    expect(
      isCodeBlockEmbeddable({
        ...baseEmbeddable,
        type: "iframe",
        customData: createCodeBlockCustomData(),
      }),
    ).toBe(false);

    expect(
      isCodeBlockEmbeddable({
        ...baseEmbeddable,
        customData: {
          excaliType: "codeblock",
          version: 1,
          code: "",
          language: "tsx",
          showBackground: true,
        },
      }),
    ).toBe(false);
  });

  test("create helper defaults background to enabled", () => {
    expect(createCodeBlockCustomData().showBackground).toBe(
      DEFAULT_CODE_BLOCK_SHOW_BACKGROUND,
    );
  });

  test("update helper preserves unrelated fields and non-codeblock embeddables", () => {
    const codeBlock = {
      ...baseEmbeddable,
      customData: createCodeBlockCustomData({ code: "const a = 1;" }),
    };
    const foreignEmbeddable = {
      ...baseEmbeddable,
      id: "embed-2",
      customData: { source: "foreign" },
    };
    const elements = [codeBlock, foreignEmbeddable];

    const nextElements = updateCodeBlockElements(elements, "codeblock-1", {
      code: "const a = 2;",
      language: "ts",
      showBackground: false,
    });

    expect(nextElements).not.toBe(elements);
    expect(nextElements[0]).not.toBe(codeBlock);
    expect(nextElements[0]).toMatchObject({
      id: "codeblock-1",
      x: 10,
      y: 20,
      width: 420,
      customData: {
        excaliType: "codeblock",
        version: 2,
        code: "const a = 2;",
        language: "typescript",
        showBackground: false,
      },
    });
    expect(nextElements[1]).toBe(foreignEmbeddable);
    expect(
      updateCodeBlockElements(elements, "embed-2", { code: "ignored" }),
    ).toBe(elements);
  });

  test("selection helper opens only for a single selected codeblock", () => {
    const codeBlock = {
      ...baseEmbeddable,
      customData: createCodeBlockCustomData(),
    };
    const other = {
      ...baseEmbeddable,
      id: "shape-2",
      type: "rectangle" as const,
    };

    expect(
      getCodeBlockSelectionState([codeBlock, other], {
        selectedElementIds: { "codeblock-1": true },
      }),
    ).toMatchObject({
      isPanelOpen: true,
      selectedCodeBlockId: "codeblock-1",
      selectedCodeBlock: {
        customData: {
          showBackground: true,
        },
      },
    });

    expect(
      getCodeBlockSelectionState([codeBlock, other], {
        selectedElementIds: { "codeblock-1": true, "shape-2": true },
      }),
    ).toEqual(EMPTY_CODE_BLOCK_SELECTION_STATE);

    expect(
      getCodeBlockSelectionState([codeBlock, other], {
        selectedElementIds: { "shape-2": true },
      }),
    ).toEqual(EMPTY_CODE_BLOCK_SELECTION_STATE);
  });

  test("language sanitization accepts shiki aliases and normalizes them", () => {
    expect(sanitizeCodeBlockLanguage("ts")).toBe("typescript");
    expect(sanitizeCodeBlockLanguage("js")).toBe("javascript");
    expect(sanitizeCodeBlockLanguage("md")).toBe("markdown");
    expect(sanitizeCodeBlockLanguage("bash")).toBe("shellscript");
    expect(sanitizeCodeBlockLanguage("plaintext")).toBe("plaintext");
  });

  test("custom data reads normalize persisted shiki aliases", () => {
    const codeBlock = {
      ...baseEmbeddable,
      customData: {
        excaliType: "codeblock" as const,
        version: 2 as const,
        code: "echo hi",
        language: "bash" as const,
        showBackground: true,
      },
    };

    expect(getCodeBlockCustomData(codeBlock)).toMatchObject({
      code: "echo hi",
      language: "shellscript",
    });
  });
});
