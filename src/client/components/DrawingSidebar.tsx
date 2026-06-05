import { memo } from "react";
import { type DrawingMeta, type DrawingPublication } from "../../core/shared";

type DrawingSidebarProps = {
  open: boolean;
  drawings: DrawingMeta[];
  activeId: string | null;
  activeTitle: string;
  publication: DrawingPublication;
  publicationSlug: string;
  publicationBusy: boolean;
  onClose: () => void;
  onCreate: () => void | Promise<void>;
  onSelect: (drawingId: string) => void | Promise<void>;
  onDelete: (drawingId: string) => void | Promise<void>;
  onTitleChange: (title: string) => void;
  onTitleSubmit: () => void | Promise<void>;
  onPublicationSlugChange: (slug: string) => void;
  onPublish: () => void | Promise<void>;
  onDisablePublication: () => void | Promise<void>;
};

function DrawerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 5v14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5.75 9h1.5M5.75 12h1.5M5.75 15h1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DrawingsToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="secondary-button app-actions-toggle"
      onClick={onClick}
      aria-label="Open drawings"
    >
      <DrawerIcon />
      <span className="sr-only">Open drawings</span>
    </button>
  );
}

export const DrawingSidebar = memo(function DrawingSidebar({
  open,
  drawings,
  activeId,
  activeTitle,
  publication,
  publicationSlug,
  publicationBusy,
  onClose,
  onCreate,
  onSelect,
  onDelete,
  onTitleChange,
  onTitleSubmit,
  onPublicationSlugChange,
  onPublish,
  onDisablePublication,
}: DrawingSidebarProps) {
  const publicPath = publication.enabled ? `/p/${publication.slug}` : null;
  const publicationStatus = publication.enabled
    ? `Published at ${publicPath}`
    : "Not published";

  return (
    <>
      <div
        className={
          open ? "sidebar-backdrop sidebar-backdrop-open" : "sidebar-backdrop"
        }
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={open ? "sidebar sidebar-open" : "sidebar"}
        aria-hidden={!open}
      >
        <div className="sidebar-header">
          <h1>excali-box</h1>
          <div className="sidebar-actions">
            <button type="button" className="primary-button" onClick={onCreate}>
              New
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close drawings"
            >
              ×
            </button>
          </div>
        </div>
        <div className="drawing-list">
          {drawings.map((drawing) => (
            <div
              key={drawing.id}
              className={
                drawing.id === activeId
                  ? "drawing-item drawing-item-active"
                  : "drawing-item"
              }
            >
              {drawing.id === activeId ? (
                <div className="drawing-link drawing-link-active">
                  <div className="drawing-item-header">
                    <input
                      className="title-input"
                      value={activeTitle}
                      onChange={(event) => onTitleChange(event.target.value)}
                      onBlur={() => void onTitleSubmit()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="icon-button drawing-delete-button"
                      onClick={() => void onDelete(drawing.id)}
                      aria-label={`Delete ${drawing.title}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="publication-panel">
                    <label
                      className="publication-label"
                      htmlFor="publication-slug"
                    >
                      Public name
                    </label>
                    <input
                      id="publication-slug"
                      className="title-input publication-input"
                      value={publicationSlug}
                      onChange={(event) =>
                        onPublicationSlugChange(event.target.value)
                      }
                      spellCheck={false}
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                    <div className="publication-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void onPublish()}
                        disabled={publicationBusy}
                      >
                        {publication.enabled ? "Update link" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void onDisablePublication()}
                        disabled={!publication.enabled || publicationBusy}
                      >
                        Unpublish
                      </button>
                    </div>
                    <div className="publication-status">
                      {publication.enabled ? (
                        <a
                          href={publicPath ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="publication-link"
                        >
                          {publicationStatus}
                        </a>
                      ) : (
                        <span>{publicationStatus}</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="drawing-link"
                  onClick={() => void onSelect(drawing.id)}
                >
                  <span className="drawing-title">{drawing.title}</span>
                </button>
              )}
              {drawing.id !== activeId ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => void onDelete(drawing.id)}
                  aria-label={`Delete ${drawing.title}`}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
});
