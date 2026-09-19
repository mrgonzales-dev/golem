# G-CODE

AI coding agent. Proposes file changes as diffs and writes them only after approval. Reads files, searches code, and fetches context.

## How it works

1. The agent calls `updateFile` or `writeFile`.
2. The change is staged in memory as a diff card.
3. The card opens in the diff pane for review.
4. Approve writes the file. Reject discards it.
5. Edits to the same file merge into one card.

## Prerequisites

- Node.js v18+
- npm

## Setup

```bash
npm install
node node_modules/electron/install.js
```

## Configuration

Create `config/api_key.json`:

```json
{
  "host": "http://127.0.0.1:20128/v1",
  "key": "your-api-key"
}
```

## Run

Development mode with hot reload:

```bash
./dev.sh
```

Or manually:

```bash
npm run dev    # Start Vite dev server
npm start      # Launch Electron (separate terminal)
```

Production mode:

```bash
npm run build
npm run start:prod
```

## Project Structure

```
g-code/
  main.js                          # Electron main process; registers IPC
  dev.sh                           # Dev launcher script
  vite.config.js                   # Vite config; @ path alias
  src/
    config.js                      # API config and model loader
    preload.js                     # IPC bridge to renderer
    tools.js                       # Tool definitions (readFile, fileSearch, fileGrep, listDirectory, updateFile, writeFile, invokeSkill)
    thinking-texts.js              # Thinking status text
    diff-system/
      diff.js                      # Hunk and line diff builders
      pendingChanges.js            # Pending proposal store; guarded approval writes
    ai-bridge/
      index.js                     # OpenAI-compatible streaming client
    ipc/
      index.js                     # IPC channel registry
      components/
        agent.js                   # AgentSession; chat handler
        changes.js                 # change:decide approval handler
        dialog.js                  # Native dialog IPC
        folder.js                  # Folder read IPC
        models.js                  # Model list IPC
        settings.js                # Settings IPC
    default_skills/                # Skill markdown files
    icons/                         # SVG icons
    renderer/
      App.vue                      # Root Vue component; pane layout
      main.js                      # Vue mount; font imports
      style.css                    # Global styles and theme tokens
      index.html                   # Entry HTML
      components/
        FileBrowserPanel.vue       # File tree pane
        FileBrowserEntry.vue       # Single tree entry
        TitleBar.vue               # Window frame bar
        AgentInstance/
          AgentInstanceCard.vue    # Agent card; message state and IPC wiring
          partials/
            agentQueue.js          # Message queue logic
            quickPrompts.js        # Quick prompt definitions
            toolCalls.js           # Tool call message grouping
          components/
            ChatBox.vue            # Message list
            MessageInput.vue       # Input textarea
            StatusBar.vue          # Model selector and diff toggle
            QueueBar.vue           # Queued message bar
            QuickPromptActionToolBar.vue
            QuickPromptModal.vue
            AgentReply.vue         # Markdown reply renderer
            UserMessage.vue
            agentReply/
              AgentError.vue
              AgentToolCall.vue
              ThinkingReply.vue
        DiffPanel/
          DiffBox.vue              # Diff pane; global approve/reject
          DiffCard.vue             # Single change card with line numbers
        Settings/
          SettingsModal.vue        # API host and key modal
          partials/
            providerConfig.js      # Provider config storage
  config/
    api_key.example.json           # Example API config
    api_key.sample.json            # Sample API config
  test/
    setup.js                       # Vitest setup; @ alias
    test-config.js                 # API connection test
    test*.test.ts                  # Unit tests
```
