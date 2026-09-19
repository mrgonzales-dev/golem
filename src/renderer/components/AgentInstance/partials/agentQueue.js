/**
 * Pure queue logic for agent message handling.
 *
 * All functions are pure — they do not mutate their inputs.
 * The component layer calls these and applies the results.
 */

/**
 * Add text to the end of the queue.
 * @param {string[]} queue - The current queue.
 * @param {string} text - The text to add.
 * @returns {string[]} A new array with the text appended.
 */
export function enqueue(queue, text) {
  return [...queue, text];
}

/**
 * Remove and return the first item from the queue.
 * @param {string[]} queue - The current queue.
 * @returns {{ item: string|null, rest: string[] }} The first item and the remaining queue.
 */
export function dequeue(queue) {
  if (queue.length === 0) {
    return { item: null, rest: [] };
  }
  const [item, ...rest] = queue;
  return { item, rest };
}

/**
 * Decide what action to take when the user flushes the queue.
 * @param {string[]} queue - The current queue.
 * @param {boolean} isResponding - Whether the AI is responding.
 * @returns {"noop"|"interrupt"|"send"} The action to take.
 */
export function shouldFlush(queue, isResponding) {
  if (queue.length === 0) return "noop";
  if (isResponding) return "interrupt";
  return "send";
}

/**
 * Decide what action to take when the user sends a message.
 * @param {string[]} queue - The current queue.
 * @param {boolean} isResponding - Whether the AI is responding.
 * @param {string} text - The text the user entered.
 * @returns {{ action: "send"|"queue"|"noop", text?: string, queue: string[] }} The action and updated state.
 */
export function handleSend(queue, isResponding, text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { action: "noop", queue };
  }

  if (isResponding) {
    return { action: "queue", queue: enqueue(queue, trimmed) };
  }

  return { action: "send", text: trimmed, queue };
}
