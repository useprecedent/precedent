import { basename } from "node:path";
import type { Conflict, Report } from "./types.ts";

export type ReportProvenance = {
  event: string;
  baseRef?: string;
  baseSha?: string;
  headSha?: string;
  compareUrl?: string;
};

export type ReportRenderInput = {
  report: Report;
  subject: string;
  compilePath?: string;
  mode: "full" | "pr_delta";
  baseRef?: string;
  provenance?: ReportProvenance | null;
  delta?: {
    conflicts: Conflict[];
    unresolved: Conflict[];
  };
  includeMarker?: boolean;
};

export function subjectFromRoot(root: string): string {
  const name = basename(root);
  return name.length > 0 ? name : root;
}

export function shortSha(sha: string | undefined): string | undefined {
  if (!sha) return undefined;
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export function compareUrlForRef(
  repository: string,
  baseSha: string,
  headSha: string,
): string {
  const base = shortSha(baseSha) ?? baseSha;
  const head = shortSha(headSha) ?? headSha;
  return `https://github.com/${repository}/compare/${base}...${head}`;
}

export function renderReport(input: ReportRenderInput): string {
  const {
    report,
    subject,
    compilePath = ".",
    mode,
    baseRef,
    provenance = null,
    delta,
    includeMarker = false,
  } = input;

  const findings = mode === "pr_delta" && delta
    ? [...delta.conflicts, ...delta.unresolved]
    : [...report.conflicts, ...report.unresolved];

  const compactEmptyPr = mode === "pr_delta" && findings.length === 0 && Boolean(baseRef);
  if (compactEmptyPr) return renderCompactEmptyPrDelta(report, subject, baseRef!, provenance, includeMarker);

  const lines: string[] = [];
  if (includeMarker) lines.push("<!-- precedent-report -->", "");

  lines.push("# Precedent", "", subject, "");

  if (provenance) {
    lines.push("## Provenance", "");
    lines.push(`- Event: ${provenance.event}`);
    if (provenance.baseRef || provenance.baseSha) {
      const baseParts = [provenance.baseSha, provenance.baseRef ? `(${provenance.baseRef})` : null]
        .filter(Boolean)
        .join(" ");
      lines.push(`- Base: ${baseParts}`);
    }
    if (provenance.headSha) lines.push(`- Head: ${provenance.headSha}`);
    if (provenance.compareUrl) lines.push(`- Compare: [compare](${provenance.compareUrl})`);
    lines.push("");
  }

  lines.push("## Scope", "");
  lines.push("- Activation: always-on");
  if (compilePath !== ".") lines.push(`- Compile path: \`${compilePath}\``);
  const ecosystems = [...new Set(report.sources.flatMap((source) => source.ecosystems))].sort();
  if (ecosystems.length > 0) lines.push(`- Ecosystems: ${ecosystems.join(", ")}`);
  lines.push(`- Sources: ${report.sources.length} on disk, ${report.inForce.length} in force`);
  const pathScoped = [
    ...new Set(
      report.inForce
        .filter((source) => source.appliesUnder)
        .map((source) => `${source.path} (under \`${source.appliesUnder}\`)`),
    ),
  ];
  if (pathScoped.length > 0) {
    lines.push(`- Path-scoped: ${pathScoped.join("; ")}`);
  }
  if (report.leftOut.length > 0) {
    lines.push(
      `- Excluded from merge: ${report.leftOut.length} sources (glob, intelligent, manual, or outside compile path)`,
    );
  }
  lines.push(`- Out of this report: ${report.missingFromDisk.join("; ")}`);
  lines.push("");

  lines.push("## Findings", "");
  if (findings.length === 0) {
    if (mode === "pr_delta" && baseRef) {
      lines.push(`No new always-on instruction conflicts relative to ${baseRef}.`);
    } else {
      lines.push("No always-on instruction conflicts.");
    }
    lines.push("");
  } else {
    lines.push(...renderNumberedFindings(findings));
    lines.push("");
  }

  lines.push(...methodologyBlock());

  return lines.join("\n").trim() + "\n";
}

function renderCompactEmptyPrDelta(
  report: Report,
  subject: string,
  baseRef: string,
  provenance: ReportProvenance | null,
  includeMarker: boolean,
): string {
  const lines: string[] = [];
  if (includeMarker) lines.push("<!-- precedent-report -->", "");
  lines.push("# Precedent", "", subject, "");
  const prov = formatProvenanceLine(provenance);
  if (prov) lines.push(prov, "");
  lines.push(compactScopeLineEmpty(report), "");
  lines.push(emptyPrDeltaFindingLine(baseRef), "");
  lines.push(...methodologyBlock());
  return lines.join("\n").trim() + "\n";
}

function formatProvenanceLine(provenance: ReportProvenance | null): string {
  if (!provenance) return "";
  const parts: string[] = [];
  if (provenance.baseSha || provenance.baseRef) {
    const base = [provenance.baseSha, provenance.baseRef ? `(${provenance.baseRef})` : null]
      .filter(Boolean)
      .join(" ");
    parts.push(`Base ${base}`);
  }
  if (provenance.headSha) parts.push(`head ${provenance.headSha}`);
  if (provenance.compareUrl) parts.push(`[compare](${provenance.compareUrl})`);
  return parts.join(" · ");
}

function emptyPrDeltaFindingLine(baseRef: string): string {
  return `No always-on conflicts in git on this head; none new relative to ${baseRef}.`;
}

function compactScopeLineEmpty(report: Report): string {
  return `Scope: always-on · ${outOfReportSentence(report)}`;
}

function outOfReportSentence(report: Report): string {
  const hasExtra = report.sources.some((source) => source.kind === "team-rule");
  if (hasExtra) return "other Cursor settings rules are not in this report.";
  return "team rules and Cursor settings user rules are not in this report.";
}

function methodologyBlock(): string[] {
  return [
    "<details>",
    "<summary>Methodology</summary>",
    "",
    "**Measured:** file inventory, activation classification, symlink aliases, and documented layer/specificity order.",
    "",
    "**Inferred:** semantic contradiction on always-on statements. Paraphrases of the same action are not a conflict.",
    "",
    "This report does not prove model compliance.",
    "</details>",
  ];
}

function renderNumberedFindings(findings: Conflict[]): string[] {
  const lines: string[] = [];
  findings.forEach((finding, index) => {
    const kind = finding.resolution === "unresolved" ? "unresolved" : "conflict";
    const label = finding.evidence;
    lines.push(`${index + 1}. **${finding.behavior}** (\`${kind}\`, ${label})`);
    if (finding.effective) {
      lines.push(
        `   - effective: ${finding.effective.text} (\`${finding.effective.path}:${finding.effective.line}\`, ${finding.why})`,
      );
    }
    for (const statement of finding.statements) {
      if (
        finding.effective &&
        statement.path === finding.effective.path &&
        statement.line === finding.effective.line
      )
        continue;
      const role = finding.effective ? "overridden" : "statement";
      lines.push(`   - ${role}: ${statement.text} (\`${statement.path}:${statement.line}\`)`);
    }
    lines.push("");
  });
  return lines;
}

export function renderMarkdown(
  report: Report,
  options?: Omit<ReportRenderInput, "report">,
): string {
  return renderReport({
    report,
    subject: options?.subject ?? subjectFromRoot(report.root),
    compilePath: options?.compilePath ?? ".",
    mode: options?.mode ?? "full",
    baseRef: options?.baseRef,
    provenance: options?.provenance ?? null,
    delta: options?.delta,
    includeMarker: options?.includeMarker ?? false,
  });
}

export function renderPrComment(
  current: Report,
  added: { conflicts: Conflict[]; unresolved: Conflict[] },
  context: {
    repository: string;
    baseRef: string;
    provenance: ReportProvenance;
    compilePath?: string;
  },
): string {
  return renderReport({
    report: current,
    subject: context.repository,
    compilePath: context.compilePath ?? ".",
    mode: "pr_delta",
    baseRef: context.baseRef,
    provenance: context.provenance,
    delta: added,
    includeMarker: true,
  });
}
