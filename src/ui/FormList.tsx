import { useId } from "react";
import type { MappingCount } from "../mappings/summarizeMappings";
import type { FormInstance } from "../blueprint/model";

interface FormListProps {
  counts?: ReadonlyMap<string, MappingCount> | undefined;
  forms: readonly FormInstance[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
}

export function FormList({ forms, selectedId, onSelect, counts }: FormListProps) {
  const countId = useId();
  return (
    <nav aria-label="Forms">
      <h3>Forms <span className="count">{forms.length}</span></h3>
      <ul className="form-list">
        {forms.map((form, index) => (
          <li key={form.nodeId}>
            <button type="button" aria-label={form.name} aria-describedby={counts?.has(form.nodeId) ? `${countId}-${index}` : undefined} aria-pressed={form.nodeId === selectedId}
              onClick={() => onSelect(form.nodeId)}>
              <span>{form.name}</span>
              {counts?.get(form.nodeId) && <span className="form-progress" id={`${countId}-${index}`}>
                {counts.get(form.nodeId)!.mapped} of {counts.get(form.nodeId)!.total} mapped
              </span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
