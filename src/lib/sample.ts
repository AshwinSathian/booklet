export const SAMPLE_MARKDOWN = `# Example: A clear incident update

**What happened**
- Deploy completed at 10:42
- Error rate spiked from 0.2% to 4.8% within 2 minutes

**Impact**
- ~12% of users saw 500s
- Duration: 9 minutes

**Root cause**
A config flag enabled a slow code path for all requests.

\`\`\`ts
export function isEnabled(flag: string) {
  return process.env[flag] === "true";
}
\`\`\`

**Fix**
- Rolled back the flag
- Added a guardrail + alert on rollout
`;
