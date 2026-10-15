const SECRET_PATTERNS = [
  /\b(sk|rk|pk|ghp|gho|github_pat|xox[baprs]|AKIA)[A-Za-z0-9_\-]{8,}\b/g,
  /\b(api[_-]?key|token|secret|password|passwd|authorization)\s*[:=]\s*\S+/gi,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
];

export function redact(text: string): string {
  return SECRET_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, "[REDACTED]"),
    text,
  );
}
