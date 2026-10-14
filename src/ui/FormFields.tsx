import type { FormInstance } from "../blueprint/model";
import { isPrefillField } from "../blueprint/fieldPolicy";

export function FormFields({ form }: { form: FormInstance }) {
  const fields = form.fields.filter(isPrefillField);
  return (
    <section className="form-detail" aria-label={`${form.name} fields`}>
      <h3>{form.name}</h3>
      <p>Fields available for prefill. Mapping controls will be added later.</p>
      {fields.length === 0 ? <p role="status">This form has no prefillable fields.</p> : (
        <ul className="field-list" aria-label="Fields">
          {fields.map((field) => (
            <li key={field.key}>
              <div className="field-name"><strong>{field.label}</strong><code>{field.key}</code></div>
              <div className="field-metadata">
                <span>{field.types.length ? field.types.join(" or ") : "Unspecified type"}</span>
                {field.required && <span className="required">Required</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
