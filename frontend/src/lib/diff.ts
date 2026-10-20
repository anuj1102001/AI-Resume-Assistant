export type DiffPart = { text: string; type: "same" | "added" | "removed" };

/** Word-level diff (longest common subsequence), for showing what a rewrite changed. */
export function wordDiff(before: string, after: string): DiffPart[] {
  // Whitespace and punctuation are separate tokens, so "consumer." vs "consumer" only marks the full stop.
  const tokenize = (s: string) => s.split(/(\s+|[.,;:!?()])/).filter(Boolean);
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (text: string, type: DiffPart["type"]) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(a[i++], "removed");
    else push(b[j++], "added");
  }
  while (i < n) push(a[i++], "removed");
  while (j < m) push(b[j++], "added");
  return out;
}
