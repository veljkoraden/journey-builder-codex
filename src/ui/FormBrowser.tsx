import { useState, type ReactNode } from "react";
import type { Blueprint } from "../blueprint/model";
import { FormList } from "./FormList";
import { FormFields } from "./FormFields";

export function FormBrowser({ blueprint, renderFields, onSelect }: {
  blueprint: Blueprint;
  renderFields?: (form: Blueprint["forms"][number]) => ReactNode;
  onSelect?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = blueprint.forms.find((form) => form.nodeId === selectedId) ?? blueprint.forms[0];

  if (!selected) {
    return <p role="status">This blueprint has no forms.</p>;
  }
  return (
    <>
      <p className="blueprint-name">{blueprint.name}</p>
      <div className="form-browser">
        <FormList forms={blueprint.forms} selectedId={selected.nodeId} onSelect={(id) => { onSelect?.(); setSelectedId(id); }} />
        {renderFields ? renderFields(selected) : <FormFields form={selected} />}
      </div>
    </>
  );
}
