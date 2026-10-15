import type { Conflict, Report } from "./types.ts";

export function renderMarkdown(report: Report): string {
  const sections = [
    "# Effective instructions",
    "",
    renderConflicts(report.conflicts),
    renderUnresolved(report.unresolved),
    renderLeftOut(report),
    "",
    "_measured: file inventory and documented precedence. inferred: semantic contradiction._",
  ];
  return sections.filter((section) => section !== null).join("\n").trim() + "\n";
}

function renderConflicts(conflicts: Conflict[]): string {
  if (conflicts.length === 0) return "## Conflicts\n\nNo conflicts in the always-on instructions.";
  return [
    "## Conflicts",
    "",
    ...conflicts.flatMap((conflict) => [
      `### ${conflict.behavior}`,
      "",
      conflict.effective
        ? `- effective: ${conflict.effective.text} (${conflict.effective.path}:${conflict.effective.line}, ${conflict.why})`
        : null,
      ...conflict.statements
        .filter((statement) => statement !== conflict.effective)
        .map(
          (statement) =>
            `- overridden: ${statement.text} (${statement.path}:${statement.line})`,
        ),
      `- label: inferred contradiction; ${conflict.resolution === "override" ? "measured winner" : "unresolved"}`,
      "",
    ]),
  ]
    .filter((line) => line !== null)
    .join("\n")
    .trimEnd();
}

function renderUnresolved(unresolved: Conflict[]): string | null {
  if (unresolved.length === 0) return null;
  return [
    "## Unresolved",
    "",
    ...unresolved.flatMap((conflict) => [
      `### ${conflict.behavior}`,
      "",
      ...conflict.statements.map(
        (statement) => `- ${statement.text} (${statement.path}:${statement.line})`,
      ),
      `- label: inferred contradiction; unresolved`,
      "",
    ]),
  ].join("\n").trimEnd();
}

function renderLeftOut(report: Report): string | null {
  if (report.leftOut.length === 0) return null;
  return [
    "## Left out",
    "",
    ...report.leftOut.map(
      (item) => `- ${item.path} — ${item.activation}, ${item.reason}`,
    ),
  ].join("\n");
}

export function renderPrComment(current: Report, added: {
  conflicts: Conflict[];
  unresolved: Conflict[];
}): string {
  const body =
    added.conflicts.length === 0 && added.unresolved.length === 0
      ? "No new always-on instruction conflicts."
      : [
          added.conflicts.length > 0 ? renderConflicts(added.conflicts) : null,
          added.unresolved.length > 0 ? renderUnresolved(added.unresolved) : null,
        ]
          .filter(Boolean)
          .join("\n\n");

  return [
    "<!-- precedent-report -->",
    "## Precedent",
    "",
    `Effective policy for \`${current.path}\`.`,
    "",
    body,
    "",
    "_measured vs inferred: inventory and documented precedence are measured; contradiction detection is inferred._",
  ].join("\n");
}
