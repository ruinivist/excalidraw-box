import type { AppState } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawEmbeddableElement,
  ExcalidrawElement,
  NonDeleted,
} from "@excalidraw/excalidraw/element/types";
import {
  bundledLanguages,
  bundledLanguagesInfo,
  type BundledLanguage,
} from "shiki";

export type CodeBlockLanguage = "plaintext" | BundledLanguage;

export type CodeBlockCustomData = {
  excaliType: "codeblock";
  version: 2;
  code: string;
  language: CodeBlockLanguage;
  showBackground: boolean;
};

export type CodeBlockElement = NonDeleted<ExcalidrawEmbeddableElement> & {
  customData: CodeBlockCustomData;
};

export type CodeBlockSelectionState = {
  isPanelOpen: boolean;
  selectedCodeBlock: CodeBlockElement | null;
  selectedCodeBlockId: string | null;
};

export type CodeBlockDraftState = {
  elementId: string;
  code: string;
  language: CodeBlockLanguage;
  showBackground: boolean;
};

const SHIKI_LANGUAGE_SET = new Set<string>(Object.keys(bundledLanguages));
const SHIKI_LANGUAGE_ALIAS_TO_ID = new Map<string, BundledLanguage>(
  bundledLanguagesInfo.flatMap(({ id, aliases }) =>
    (aliases ?? []).map((alias) => [alias, id as BundledLanguage] as const),
  ),
);

export const CODE_BLOCK_LANGUAGES = Object.freeze([
  "plaintext",
  ...bundledLanguagesInfo
    .map(({ id }) => id as BundledLanguage)
    .sort((left, right) => left.localeCompare(right)),
]) as readonly CodeBlockLanguage[];

export const DEFAULT_CODE_BLOCK_LANGUAGE: CodeBlockLanguage = "tsx";
export const DEFAULT_CODE_BLOCK_CODE = [
  "export function Example() {",
  '  return <button type="button">Click me</button>;',
  "}",
].join("\n");
export const DEFAULT_CODE_BLOCK_WIDTH = 420;
export const DEFAULT_CODE_BLOCK_HEIGHT = 260;
export const CODE_BLOCK_SHIKI_THEME = "poimandres";
export const DEFAULT_CODE_BLOCK_SHOW_BACKGROUND = true;

export const EMPTY_CODE_BLOCK_SELECTION_STATE: CodeBlockSelectionState = {
  isPanelOpen: false,
  selectedCodeBlock: null,
  selectedCodeBlockId: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function randomInt(): number {
  return (
    crypto.getRandomValues(new Uint32Array(1))[0] ??
    Math.floor(Math.random() * 2 ** 31)
  );
}

function getCanonicalCodeBlockLanguage(
  language: unknown,
): CodeBlockLanguage | null {
  if (language === "plaintext") {
    return language;
  }

  if (typeof language !== "string" || !SHIKI_LANGUAGE_SET.has(language)) {
    return null;
  }

  return (
    SHIKI_LANGUAGE_ALIAS_TO_ID.get(language) ?? (language as BundledLanguage)
  );
}

export function sanitizeCodeBlockLanguage(
  language: unknown,
): CodeBlockLanguage {
  return getCanonicalCodeBlockLanguage(language) ?? DEFAULT_CODE_BLOCK_LANGUAGE;
}

export function createCodeBlockCustomData(
  overrides?: Partial<
    Pick<CodeBlockCustomData, "code" | "language" | "showBackground">
  >,
): CodeBlockCustomData {
  return {
    excaliType: "codeblock",
    version: 2,
    code: overrides?.code ?? DEFAULT_CODE_BLOCK_CODE,
    language: sanitizeCodeBlockLanguage(overrides?.language),
    showBackground:
      overrides?.showBackground ?? DEFAULT_CODE_BLOCK_SHOW_BACKGROUND,
  };
}

export function isCodeBlockCustomData(
  value: unknown,
): value is CodeBlockCustomData {
  return (
    isRecord(value) &&
    value.excaliType === "codeblock" &&
    value.version === 2 &&
    typeof value.code === "string" &&
    getCanonicalCodeBlockLanguage(value.language) !== null &&
    typeof value.showBackground === "boolean"
  );
}

export function isCodeBlockEmbeddable(
  element: unknown,
): element is CodeBlockElement {
  return (
    isRecord(element) &&
    element.type === "embeddable" &&
    element.link === null &&
    isCodeBlockCustomData(element.customData)
  );
}

export function getCodeBlockCustomData(
  element: unknown,
): CodeBlockCustomData | null {
  if (!isCodeBlockEmbeddable(element)) {
    return null;
  }

  const language = sanitizeCodeBlockLanguage(element.customData.language);
  if (language === element.customData.language) {
    return element.customData;
  }

  return {
    ...element.customData,
    language,
  };
}

export function createCodeBlockElement({
  x,
  y,
  width = DEFAULT_CODE_BLOCK_WIDTH,
  height = DEFAULT_CODE_BLOCK_HEIGHT,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
}): CodeBlockElement {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    type: "embeddable",
    x,
    y,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: null,
    roughness: 0,
    opacity: 100,
    width,
    height,
    angle: 0,
    seed: randomInt(),
    version: 1,
    versionNonce: randomInt(),
    index: null,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    customData: createCodeBlockCustomData(),
  };
}

export function updateCodeBlockElement<TElement extends ExcalidrawElement>(
  element: TElement,
  patch: Partial<
    Pick<CodeBlockCustomData, "code" | "language" | "showBackground">
  >,
): TElement {
  if (!isCodeBlockEmbeddable(element)) {
    return element;
  }

  const nextCustomData = {
    ...element.customData,
    ...(patch.code !== undefined ? { code: patch.code } : {}),
    ...(patch.language !== undefined
      ? { language: sanitizeCodeBlockLanguage(patch.language) }
      : {}),
    ...(patch.showBackground !== undefined
      ? { showBackground: patch.showBackground }
      : {}),
  } satisfies CodeBlockCustomData;

  if (
    nextCustomData.code === element.customData.code &&
    nextCustomData.language === element.customData.language &&
    nextCustomData.showBackground === element.customData.showBackground
  ) {
    return element;
  }

  return {
    ...element,
    customData: nextCustomData,
  };
}

export function updateCodeBlockElements<TElement extends ExcalidrawElement>(
  elements: readonly TElement[],
  elementId: string,
  patch: Partial<
    Pick<CodeBlockCustomData, "code" | "language" | "showBackground">
  >,
): readonly TElement[] {
  let changed = false;

  const nextElements = elements.map((element) => {
    if (element.id !== elementId) {
      return element;
    }

    const nextElement = updateCodeBlockElement(element, patch);
    changed ||= nextElement !== element;
    return nextElement;
  });

  return changed ? nextElements : elements;
}

export function getCodeBlockSelectionState(
  elements: readonly ExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds">,
): CodeBlockSelectionState {
  const selectedIds = Object.entries(appState.selectedElementIds ?? {})
    .filter(([, selected]) => selected)
    .map(([elementId]) => elementId);

  if (selectedIds.length !== 1) {
    return EMPTY_CODE_BLOCK_SELECTION_STATE;
  }

  const selectedCodeBlock = elements.find(
    (element) =>
      element.id === selectedIds[0] && isCodeBlockEmbeddable(element),
  );

  if (!selectedCodeBlock || !isCodeBlockEmbeddable(selectedCodeBlock)) {
    return EMPTY_CODE_BLOCK_SELECTION_STATE;
  }

  const customData = getCodeBlockCustomData(selectedCodeBlock);
  if (!customData) {
    return EMPTY_CODE_BLOCK_SELECTION_STATE;
  }

  return {
    isPanelOpen: true,
    selectedCodeBlock: {
      ...selectedCodeBlock,
      customData,
    },
    selectedCodeBlockId: selectedCodeBlock.id,
  };
}
