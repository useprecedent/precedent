import { isAbsolute, relative, resolve, sep } from "node:path";
import { isDocumentKind, sourceMatchesEcosystem } from "./ecosystems.ts";
import type { Ecosystem, Kind, LeftOut, Source } from "./types.ts";

const LAYER_RANK: Record<Source["layer"], number> = {
  team: 3,
  project: 2,
  user: 1,
};

export function selectInForce(
  sources: Source[],
  root: string,
  targetPath: string,
  ecosystem: "all" | Ecosystem = "all",
): { inForce: Source[]; leftOut: LeftOut[] } {
  const target = resolve(targetPath);
  const inForce: Source[] = [];
  const leftOut: LeftOut[] = [];

  for (const source of sources) {
    if (!sourceMatchesEcosystem(source, ecosystem)) {
      leftOut.push({
        path: source.path,
        activation: source.activation,
        reason: `ecosystems ${source.ecosystems.join(", ")}; compile scoped to ${ecosystem}`,
      });
      continue;
    }
    if (source.aliasOf) {
      leftOut.push({
        path: source.path,
        activation: source.activation,
        reason: `symlink alias of ${source.aliasOf}; not a second authority`,
      });
      continue;
    }

    if (isDocument(source.kind)) {
      if (source.appliesUnder && !covers(root, source.appliesUnder, target)) {
        leftOut.push({
          path: source.path,
          activation: source.activation,
          reason: `nested file applies under ${source.appliesUnder}`,
        });
        continue;
      }
      inForce.push(source);
      continue;
    }

    if (source.activation !== "always") {
      leftOut.push({
        path: source.path,
        activation: source.activation,
        reason: leftOutReason(source),
      });
      continue;
    }

    inForce.push(source);
  }

  return { inForce, leftOut };
}

export function layerWins(winner: Source["layer"], loser: Source["layer"]): boolean {
  return LAYER_RANK[winner] > LAYER_RANK[loser];
}

export function documentSpecificityWins(a: Source, b: Source): Source | null {
  if (!isDocument(a.kind) || !isDocument(b.kind)) return null;
  if (a.specificity === b.specificity) return null;
  return a.specificity > b.specificity ? a : b;
}

function isDocument(kind: Kind): boolean {
  return isDocumentKind(kind);
}

function covers(root: string, appliesUnder: string, target: string): boolean {
  const scope = isAbsolute(appliesUnder) ? appliesUnder : resolve(root, appliesUnder);
  const rel = relative(scope, target);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
}

function leftOutReason(source: Source): string {
  if (source.kind === "skill") return "skill; requestable; not merged in v1";
  if (source.activation === "glob")
    return `glob ${source.globs.join(", ") || "(none)"}; out of semantic v1 until a task matches`;
  if (source.activation === "intelligent")
    return "intelligent; out of semantic v1 until a task matches its description";
  return "manual; out of the merge unless the user named it";
}
