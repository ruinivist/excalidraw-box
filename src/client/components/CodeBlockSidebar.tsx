import { useEffect, useRef, useState } from "react";
import {
  CODE_BLOCK_LANGUAGES,
  type CodeBlockDraftState,
  type CodeBlockLanguage,
} from "../codeblock";
import { renderHighlightedCodeBlockHtml } from "../codeblockHighlight";

type CodeBlockSidebarProps = {
  open: boolean;
  draft: CodeBlockDraftState | null;
  onCodeChange: (code: string) => void;
  onLanguageChange: (language: CodeBlockLanguage) => void;
  onShowBackgroundChange: (showBackground: boolean) => void;
  onCommit: () => void;
};

function CodeBlockEditor({
  draft,
  onCodeChange,
  onCommit,
}: {
  draft: CodeBlockDraftState;
  onCodeChange: (code: string) => void;
  onCommit: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      void renderHighlightedCodeBlockHtml(draft.code, draft.language)
        .then((nextHtml) => {
          if (!cancelled) {
            setHtml(nextHtml);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setHtml(null);
          }
        });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [draft.code, draft.language]);

  const syncScroll = () => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (!textarea || !highlight) {
      return;
    }

    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  };

  return (
    <div
      className={[
        "codeblock-editor-surface",
        draft.showBackground
          ? "codeblock-surface--background"
          : "codeblock-surface--transparent",
      ].join(" ")}
    >
      <div
        ref={highlightRef}
        className="codeblock-editor-highlight"
        aria-hidden="true"
      >
        {html ? (
          <div
            className="codeblock-editor-highlight-html"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="codeblock-editor-highlight-fallback">
            <code>{draft.code || " "}</code>
          </pre>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="codeblock-editor-textarea"
        value={draft.code}
        onChange={(event) => onCodeChange(event.target.value)}
        onBlur={onCommit}
        onScroll={syncScroll}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="Code block contents"
      />
    </div>
  );
}

function CodeBlockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 8 4.5 12 8 16M16 8l3.5 4-3.5 4M13 6l-2 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function InsertCodeBlockButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="secondary-button app-actions-toggle codeblock-toolbar-button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Insert code block"
    >
      <CodeBlockIcon />
      <span className="sr-only">Insert code block</span>
    </button>
  );
}

export function CodeBlockSidebar({
  open,
  draft,
  onCodeChange,
  onLanguageChange,
  onShowBackgroundChange,
  onCommit,
}: CodeBlockSidebarProps) {
  if (!open || !draft) {
    return null;
  }

  return (
    <aside className="codeblock-sidebar">
      <select
        className="codeblock-language-select"
        value={draft.language}
        onChange={(event) =>
          onLanguageChange(event.target.value as CodeBlockLanguage)
        }
        onBlur={onCommit}
        aria-label="Code block language"
      >
        {CODE_BLOCK_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </select>
      <CodeBlockEditor
        key={draft.elementId}
        draft={draft}
        onCodeChange={onCodeChange}
        onCommit={onCommit}
      />
      <label className="codeblock-background-toggle">
        <input
          type="checkbox"
          checked={draft.showBackground}
          onChange={(event) => onShowBackgroundChange(event.target.checked)}
          onBlur={onCommit}
        />
        <span>Background</span>
      </label>
    </aside>
  );
}
