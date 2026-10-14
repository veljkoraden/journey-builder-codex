import type { FormInstance } from "../blueprint/model";

interface FormListProps {
  forms: readonly FormInstance[];
  selectedId: string;
  onSelect: (nodeId: string) => void;
}

export function FormList({ forms, selectedId, onSelect }: FormListProps) {
  return (
    <nav aria-label="Forms">
      <h3>Forms <span className="count">{forms.length}</span></h3>
      <ul className="form-list">
        {forms.map((form) => (
          <li key={form.nodeId}>
            <button type="button" aria-pressed={form.nodeId === selectedId}
              onClick={() => onSelect(form.nodeId)}>
              {form.name}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
