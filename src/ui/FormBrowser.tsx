import type { MappingCount } from "../mappings/summarizeMappings";
import { useState, type ReactNode } from "react";
import type { Blueprint } from "../blueprint/model";
import { FormList } from "./FormList";
import { FormFields } from "./FormFields";

const formNameOrder = new Intl.Collator("en", { sensitivity: "base" });

export function FormBrowser({ blueprint, renderFields, onSelect, counts }: {
  blueprint: Blueprint;
  counts?: ReadonlyMap<string, MappingCount>;
  renderFields?: (form: Blueprint["forms"][number]) => ReactNode;
  onSelect?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const forms = [...blueprint.forms].sort((a, b) => formNameOrder.compare(a.name, b.name));
  const selected = forms.find((form) => form.nodeId === selectedId) ?? forms[0];

  if (!selected) {
    return <p role="status">This blueprint has no forms.</p>;
  }
  return (
    <>
      <p className="blueprint-name">{blueprint.name}</p>
      <div className="form-browser">
        <FormList counts={counts} forms={forms} selectedId={selected.nodeId} onSelect={(id) => { onSelect?.(); setSelectedId(id); }} />
        {renderFields ? renderFields(selected) : <FormFields form={selected} />}
      </div>
    </>
  );
}
