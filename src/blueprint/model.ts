export interface FormField {
  readonly key: string;
  readonly label: string;
  readonly types: readonly string[];
  readonly controlType: string | null;
  readonly required: boolean;
}

export interface FormInstance {
  readonly nodeId: string;
  readonly definitionId: string;
  readonly name: string;
  readonly fields: readonly FormField[];
}

export interface Blueprint {
  readonly id: string;
  readonly name: string;
  readonly forms: readonly FormInstance[];
  readonly nodes: readonly {
    id: string;
    type: string;
    prerequisites: readonly string[] | null;
  }[];
  readonly edges: readonly { source: string; target: string }[];
}
