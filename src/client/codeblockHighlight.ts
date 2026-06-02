import { getSingletonHighlighter, type Highlighter } from "shiki";
import { CODE_BLOCK_SHIKI_THEME, type CodeBlockLanguage } from "./codeblock";

let highlighterPromise: Promise<Highlighter> | null = null;

export function getCodeBlockHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      themes: [CODE_BLOCK_SHIKI_THEME],
    });
  }

  return highlighterPromise;
}

export function getHighlightableCodeBlockLanguage(
  language: CodeBlockLanguage,
): Exclude<CodeBlockLanguage, "plaintext"> | null {
  return language === "plaintext" ? null : language;
}

export async function renderHighlightedCodeBlockHtml(
  code: string,
  language: CodeBlockLanguage,
): Promise<string | null> {
  const shikiLanguage = getHighlightableCodeBlockLanguage(language);
  if (!shikiLanguage) {
    return null;
  }

  const highlighter = await getCodeBlockHighlighter();
  await highlighter.loadLanguage(shikiLanguage);
  return highlighter.codeToHtml(code, {
    lang: shikiLanguage,
    theme: CODE_BLOCK_SHIKI_THEME,
  });
}
