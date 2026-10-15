import type { MappingCount } from "../mappings/summarizeMappings";

interface PrefillSettingsProps {
  formName: string;
  count: MappingCount;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function PrefillSettings({ formName, count, enabled, onChange }: PrefillSettingsProps) {
  return (
    <div className="prefill-settings">
      <span className="mapping-count">
        {count.mapped} of {count.total} fields mapped
      </span>
      <label className="prefill-toggle">
        <input
          type="checkbox"
          role="switch"
          aria-label={`Enable prefill for ${formName}`}
          checked={enabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        Prefill {enabled ? "on" : "off"}
      </label>
      {!enabled && (
        <p className="prefill-paused">Editing is off. Existing mappings are preserved.</p>
      )}
    </div>
  );
}
