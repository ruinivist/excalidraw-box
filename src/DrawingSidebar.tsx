import { type DrawingMeta } from "./shared";

type DrawingSidebarProps = {
  open: boolean;
  drawings: DrawingMeta[];
  activeId: string | null;
  activeTitle: string;
  onClose: () => void;
  onCreate: () => void;
  onSelect: (drawingId: string) => void;
  onDelete: (drawingId: string) => void;
  onTitleChange: (title: string) => void;
  onTitleSubmit: () => void;
};

function DrawerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 5v14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5.75 9h1.5M5.75 12h1.5M5.75 15h1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

export function DrawingSidebar({
  open,
  drawings,
  activeId,
  activeTitle,
  onClose,
  onCreate,
  onSelect,
  onDelete,
  onTitleChange,
  onTitleSubmit,
}: DrawingSidebarProps) {
  return (
    <>
      <div
        className={open ? "sidebar-backdrop sidebar-backdrop-open" : "sidebar-backdrop"}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={open ? "sidebar sidebar-open" : "sidebar"} aria-hidden={!open}>
        <div className="sidebar-header">
          <h1>excali-box</h1>
          <div className="sidebar-actions">
            <button type="button" className="primary-button" onClick={onCreate}>
              New
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close drawings">
              ×
            </button>
          </div>
        </div>
        <div className="drawing-list">
          {drawings.map((drawing) => (
            <div
              key={drawing.id}
              className={drawing.id === activeId ? "drawing-item drawing-item-active" : "drawing-item"}
            >
              {drawing.id === activeId ? (
                <div className="drawing-link">
                  <input
                    className="title-input"
                    value={activeTitle}
                    onChange={(event) => onTitleChange(event.target.value)}
                    onBlur={onTitleSubmit}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </div>
              ) : (
                <button type="button" className="drawing-link" onClick={() => onSelect(drawing.id)}>
                  <span className="drawing-title">{drawing.title}</span>
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                onClick={() => onDelete(drawing.id)}
                aria-label={`Delete ${drawing.title}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
