/**
 * Renderer side of the session system.
 *
 * Plain helpers only — no fs, no Electron imports — so this file
 * stays bundlable by Vite and importable in tests. The renderer
 * pushes its display state to main via session:save; main merges
 * it with the AgentSession history before writing.
 */

// Session titles come from the first user prompt, like most
// chat tools. Falls back so untitled sessions still list cleanly.
export function deriveTitle(messages) {
  const first = (messages || []).find((m) => m.sender === "You");
  const text = (first?.text || "").trim();
  if (!text) return "New session";
  return text.length > 60 ? text.slice(0, 57) + "..." : text;
}

let timer = null;

// Debounced: a burst of mutations (decide-all loops, tool batches)
// collapses into one write. getState is called at fire time so the
// payload is never stale. The JSON round-trip is required, not a
// convenience — messages hold Vue reactive proxies, and IPC
// structured clone throws on proxies.
export function scheduleSessionSave(getState, delay = 300) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (!window.api?.saveSession) return;
    const state = getState();
    const payload = JSON.parse(
      JSON.stringify({
        title: deriveTitle(state.messages),
        folderPath: state.folderPath,
        selectedModel: state.selectedModel,
        thinkingEffort: state.thinkingEffort,
        messages: state.messages,
      }),
    );
    window.api.saveSession(payload).catch(() => {});
  }, delay);
}
