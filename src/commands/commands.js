/**
 * Slash commands for the chat input.
 *
 * Commands run locally and never reach the model. Each entry has a
 * description (shown by /help) and a run(ctx) handler. ctx supplies
 * the UI hooks:
 *   - pushMessage(text)  Add a notice line to the chat.
 *   - pushError(text)    Add an error line to the chat.
 *   - openSettings()     Open the settings modal.
 *   - clearChat()        Empty the message list.
 *
 * Add a command by adding an entry to the commands map.
 */

export function isCommand(text) {
  return text.trim().startsWith("/");
}

export const commands = {
  "/help": {
    description: "Show this list",
    run: (ctx) => ctx.pushMessage(helpText()),
  },
  "/settings": {
    description: "Open Settings",
    run: (ctx) => ctx.openSettings(),
  },
  "/clear": {
    description: "Clear the chat",
    run: (ctx) => ctx.clearChat(),
  },
};

function helpText() {
  return Object.entries(commands)
    .map(([name, c]) => `${name} — ${c.description}`)
    .join("\n");
}

export function runCommand(text, ctx) {
  const name = text.trim().split(/\s+/)[0].toLowerCase();
  const command = commands[name];
  if (command) {
    command.run(ctx);
    return;
  }
  (ctx.pushError || ctx.pushMessage)(
    `Unknown command "${name}". Type /help for the list.`,
  );
}
