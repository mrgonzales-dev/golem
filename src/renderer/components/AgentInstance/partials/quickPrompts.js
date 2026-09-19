/**
 * Quick prompts storage logic.
 *
 * Creates, loads, saves, adds, and removes quick prompts.
 * Persists to localStorage. All functions are pure except
 * loadPrompts and savePrompts, which touch localStorage.
 */

const STORAGE_KEY = "quickPrompts";

/**
 * Load prompts from localStorage.
 * Returns an empty array if nothing is stored or the data is invalid.
 * @returns {Array<{id: string, name: string, text: string}>} The prompts.
 */
export function loadPrompts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Save prompts to localStorage.
 * @param {Array<{id: string, name: string, text: string}>} prompts - The prompts to save.
 */
export function savePrompts(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

/**
 * Create a new prompt object with a unique id.
 * @param {string} name - The short label for the button.
 * @param {string} text - The full prompt text sent to the agent.
 * @returns {{id: string, name: string, text: string}} The new prompt.
 */
export function createPrompt(name, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    text,
  };
}

/**
 * Add a prompt to the list and persist to localStorage.
 * Does not mutate the original array.
 * @param {Array} prompts - The current prompts.
 * @param {{id: string, name: string, text: string}} prompt - The prompt to add.
 * @returns {Array} The new prompts list.
 */
export function addPrompt(prompts, prompt) {
  const result = [...prompts, prompt];
  savePrompts(result);
  return result;
}

/**
 * Remove a prompt by id and persist to localStorage.
 * Does not mutate the original array.
 * @param {Array} prompts - The current prompts.
 * @param {string} id - The id of the prompt to remove.
 * @returns {Array} The new prompts list.
 */
export function removePrompt(prompts, id) {
  const result = prompts.filter((p) => p.id !== id);
  savePrompts(result);
  return result;
}
