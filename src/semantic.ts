import { documentSpecificityWins, layerWins } from "./precedence.ts";
import type { CitedStatement, Conflict, Source, Statement } from "./types.ts";

type Pole = {
  id: string;
  label: string;
  patterns: RegExp[];
};

type Topic = {
  id: string;
  behavior: string;
  poles: Pole[];
};

const TOPICS: Topic[] = [
  {
    id: "who-runs-commands",
    behavior: "who runs terminal commands",
    poles: [
      {
        id: "user",
        label: "the user runs terminal commands",
        patterns: [
          /\bi \(the user\) will run\b/i,
          /\b(user|jake) runs (every|all|each)?\s*(terminal )?commands?\b/i,
          /\bwill run all terminal commands you will not\b/i,
          /\byou will not\b.{0,40}\b(run|execute)\b/i,
          /\bthe user (will|runs|must run)\b.{0,40}\bcommands?\b/i,
        ],
      },
      {
        id: "agent",
        label: "the agent runs terminal commands",
        patterns: [
          /\b(you|agent|the model)\b.{0,40}\b(run|runs|execute|executes)\b.{0,40}\b(terminal |shell )?commands?\b/i,
          /\bdo not ask (the user|me|jake) to run\b/i,
        ],
      },
    ],
  },
  {
    id: "when-to-add-tests",
    behavior: "when to add tests",
    poles: [
      {
        id: "always",
        label: "always add tests",
        patterns: [
          /\balways (write|add|create|include) tests\b/i,
          /\btest[- ]driven\b/i,
          /\btdd\b/i,
          /\bevery change (must|should) (have|include) tests\b/i,
          /\btests? for (every|all) (change|pr|commit)\b/i,
        ],
      },
      {
        id: "requested",
        label: "only add tests when requested",
        patterns: [
          /\bonly add tests when (requested|asked)\b/i,
          /\bdo not add tests unless\b/i,
          /\bno tests unless (the user )?(asks|requested|asked)\b/i,
        ],
      },
    ],
  },
];

type Classified = {
  topic: Topic;
  pole: Pole;
  statement: Statement;
  source: Source;
};

export function findSemanticConflicts(inForce: Source[], statements: Statement[]): Conflict[] {
  const byPath = new Map(inForce.map((source) => [source.path, source]));
  const classified = statements.flatMap((statement) => {
    const source = byPath.get(statement.path);
    if (!source) return [];
    const hit = classify(statement.text);
    if (!hit) return [];
    return [{ ...hit, statement, source }];
  });

  return TOPICS.flatMap((topic) =>
    conflictsForTopic(
      topic,
      classified.filter((item) => item.topic.id === topic.id),
    ),
  );
}

function classify(text: string): { topic: Topic; pole: Pole } | null {
  for (const topic of TOPICS)
    for (const pole of topic.poles)
      if (pole.patterns.some((pattern) => pattern.test(text))) return { topic, pole };
  return null;
}

function conflictsForTopic(topic: Topic, items: Classified[]): Conflict[] {
  const poleIds = new Set(items.map((item) => item.pole.id));
  if (poleIds.size < 2) return [];

  const groups = topic.poles
    .map((pole) => items.filter((item) => item.pole.id === pole.id))
    .filter((group) => group.length > 0);

  const representatives = groups.map((group) => strongest(group));
  const [first, second] = representatives;
  if (!first || !second) return [];

  const winner = pickWinner(first, second);
  const citations = representatives.map(toCited);

  if (!winner)
    return [
      {
        behavior: topic.behavior,
        evidence: "inferred",
        resolution: "unresolved",
        why: "same layer; Cursor has not documented an order between always-on project rules and covering AGENTS.md / CLAUDE.md",
        effective: null,
        statements: citations,
      },
    ];

  const loser = winner === first ? second : first;
  return [
    {
      behavior: topic.behavior,
      evidence: "inferred",
      resolution: "override",
      why: winnerReason(winner, loser),
      effective: toCited(winner),
      statements: citations,
    },
  ];
}

function strongest(group: Classified[]): Classified {
  return [...group].sort((a, b) => {
    if (a.source.layer !== b.source.layer) return layerWins(a.source.layer, b.source.layer) ? -1 : 1;
    return b.source.specificity - a.source.specificity;
  })[0] as Classified;
}

function pickWinner(a: Classified, b: Classified): Classified | null {
  if (a.source.layer !== b.source.layer)
    return layerWins(a.source.layer, b.source.layer) ? a : b;
  const documentWinner = documentSpecificityWins(a.source, b.source);
  if (documentWinner) return documentWinner.path === a.source.path ? a : b;
  return null;
}

function winnerReason(winner: Classified, loser: Classified): string {
  if (winner.source.layer !== loser.source.layer)
    return `${winner.source.layer} over ${loser.source.layer}`;
  if (winner.source.specificity !== loser.source.specificity)
    return `higher-specificity ${winner.source.kind} file`;
  return "documented precedence";
}

function toCited(item: Classified): CitedStatement {
  return {
    text: item.statement.text,
    path: item.statement.path,
    line: item.statement.line,
    layer: item.statement.layer,
  };
}
