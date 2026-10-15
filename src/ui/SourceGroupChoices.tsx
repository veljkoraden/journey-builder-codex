import { useId, useState } from "react";
import type { SourceGroup } from "../sources/model";
import { sourceReferenceKey } from "../sources/model";

export function SourceGroupChoices({ group, query, draft, onChoose }: {
  group: SourceGroup; query: string; draft: string | null; onChoose: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const term = query.trim().toLocaleLowerCase();
  const options = group.label.toLocaleLowerCase().includes(term) ? group.options
    : group.options.filter((option) => option.label.toLocaleLowerCase().includes(term));
  if (options.length === 0) return null;
  // Search exposes matching options; clearing search restores the user's expansion choice.
  const open = term.length > 0 || expanded;
  return <fieldset aria-labelledby={`${contentId}-label`} aria-describedby={group.description ? `${contentId}-description` : undefined}>
    <legend>
      <span id={`${contentId}-label`}>{group.label}</span>
      {group.description && <> <span id={`${contentId}-description`} className="source-kind">{group.description}</span></>}
    </legend>
    <button type="button" className="group-toggle" aria-expanded={open} aria-controls={contentId}
      disabled={term.length > 0} onClick={() => setExpanded((value) => !value)}>
      {term ? "Search matches" : `${open ? "Collapse" : "Expand"} ${group.label}`}
    </button>
    <div id={contentId} hidden={!open}>
      {options.map((option) => {
        const key = sourceReferenceKey(option.reference);
        return <button type="button" key={key} aria-pressed={draft === key} onClick={() => onChoose(key)}>{option.label}</button>;
      })}
    </div>
  </fieldset>;
}
