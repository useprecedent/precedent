export type Layer = "team" | "project" | "user";

export type Kind = "agents-md" | "claude-md" | "project-rule" | "user-rule" | "team-rule";

export type Activation = "always" | "glob" | "intelligent" | "manual";

export type Evidence = "measured" | "inferred";

export type ExtraRule = {
  layer: "team" | "user";
  title: string;
  text: string;
};

export type Source = {
  path: string;
  kind: Kind;
  layer: Layer;
  activation: Activation;
  specificity: number;
  appliesUnder: string | null;
  description: string | null;
  globs: string[];
  aliasOf?: string;
  body?: string;
  bodyTruncated?: boolean;
  bodyOmittedReason?: string;
};

export type Statement = {
  path: string;
  line: number;
  text: string;
  layer: Layer;
  activation: Activation;
  specificity: number;
  appliesUnder: string | null;
  kind: Kind;
};

export type CitedStatement = {
  text: string;
  path: string;
  line: number;
  layer: Layer;
};

export type Conflict = {
  behavior: string;
  evidence: Evidence;
  resolution: "override" | "unresolved";
  why: string;
  effective: CitedStatement | null;
  statements: CitedStatement[];
};

export type LeftOut = {
  path: string;
  activation: Activation;
  reason: string;
};

export type Inventory = {
  root: string;
  sources: Source[];
  missingFromDisk: string[];
};

export type Report = Inventory & {
  product: "precedent";
  version: 1;
  path: string;
  inForce: Source[];
  leftOut: LeftOut[];
  conflicts: Conflict[];
  unresolved: Conflict[];
  labels: {
    measured: string;
    inferred: string;
  };
};

export type CompileOptions = {
  root: string;
  path: string;
  home: string;
  includeUserRules: boolean;
  includeAncestors: boolean;
  extraRules: ExtraRule[];
};

export type CliOptions = CompileOptions & {
  json: boolean;
  inventoryOnly: boolean;
  failOnUnresolved: boolean;
  compareRoot: string | null;
};
