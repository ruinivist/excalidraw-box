import { memo, useEffect, useState } from "react";
import DOMPurify from "dompurify";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawEmbeddableElement,
  NonDeleted,
} from "@excalidraw/excalidraw/element/types";
import { getCodeBlockCustomData, isCodeBlockEmbeddable } from "../codeblock";
import { renderHighlightedCodeBlockHtml } from "../codeblockHighlight";

type CodeBlockEmbeddableProps = {
  element: NonDeleted<ExcalidrawEmbeddableElement>;
};

const CodeBlockEmbeddable = memo(function CodeBlockEmbeddable({
  element,
}: CodeBlockEmbeddableProps) {
  const customData = getCodeBlockCustomData(element);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!customData) {
      setHtml(null);
      return;
    }

    let cancelled = false;
    void renderHighlightedCodeBlockHtml(customData.code, customData.language)
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

    return () => {
      cancelled = true;
    };
  }, [customData]);

  if (!customData) {
    return null;
  }

  return (
    <div
      className={[
        "codeblock-embeddable",
        customData.showBackground
          ? "codeblock-surface--background"
          : "codeblock-surface--transparent",
      ].join(" ")}
    >
      {html ? (
        <div
          className="codeblock-embeddable-html"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
        />
      ) : (
        <pre className="codeblock-embeddable-fallback">
          <code>{customData.code}</code>
        </pre>
      )}
    </div>
  );
});

export const renderCodeBlockEmbeddable: NonNullable<
  ExcalidrawProps["renderEmbeddable"]
> = (element) => {
  if (!isCodeBlockEmbeddable(element)) {
    return null;
  }

  return <CodeBlockEmbeddable element={element} />;
};
