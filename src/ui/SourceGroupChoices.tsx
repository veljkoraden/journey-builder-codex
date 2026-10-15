import { useId, useState } from "react";
import type { SourceGroup } from "../sources/model";
import { sourceReferenceKey } from "../sources/model";

export function SourceGroupChoices({
  group,
  isSearching,
  draft,
  onChoose,
}: {
  group: SourceGroup;
  isSearching: boolean;
  draft: string | null;
  onChoose: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  if (group.options.length === 0) return null;
  // Search exposes matching options; clearing search restores the user's expansion choice.
  const open = isSearching || expanded;
  return (
    <fieldset
      aria-labelledby={`${contentId}-label`}
      aria-describedby={group.description ? `${contentId}-description` : undefined}
    >
      <legend>
        <span id={`${contentId}-label`}>{group.label}</span>
        {group.description && (
          <>
            {" "}
            <span id={`${contentId}-description`} className="source-kind">
              {group.description}
            </span>
          </>
        )}
      </legend>
      <button
        type="button"
        className="group-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        disabled={isSearching}
        onClick={() => setExpanded((value) => !value)}
      >
        {isSearching ? "Search matches" : `${open ? "Collapse" : "Expand"} ${group.label}`}
      </button>
      <div id={contentId} hidden={!open}>
        {group.options.map((option) => {
          const key = sourceReferenceKey(option.reference);
          return (
            <button
              type="button"
              key={key}
              aria-pressed={draft === key}
              onClick={() => onChoose(key)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
