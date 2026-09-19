# DocuHarness

AI harness for documentation. Reads docs, fetches web pages, shows changes in diff format. Does not write code.

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
docuHarness/
  main.js                          # Electron main process; registers IPC
  dev.sh                           # Dev launcher script
  vite.config.js                   # Vite config; @ path alias
  src/
    config.js                      # API config and model loader
    preload.js                     # IPC bridge to renderer
    tools.js                        # Tool definitions (fileSearch, fileGrep, listDirectory, invokeSkill)
    thinking-texts.js               # Tech jargon thinking verbs
    ai-bridge/
      index.js                      # OpenAI-compatible streaming client
    ipc/
      index.js                      # IPC channel registry
      components/
        agent.js                    # AgentSession; chat handler
        dialog.js                    # Native dialog IPC
        folder.js                    # Folder read IPC
        models.js                    # Model list IPC
    default_skills/                 # Skill markdown files (empty)
    icons/                          # SVG icons
    renderer/
      App.vue                       # Root Vue component
      main.js                       # Vue mount
      style.css                     # Global styles
      index.html                    # Entry HTML
      components/
        AgentReply.vue
        ChatBox.vue
        FileBrowserEntry.vue
        FileBrowserPanel.vue
        MessageInput.vue
        QueueBar.vue
        QuickPromptActionToolBar.vue
        StatusBar.vue
        UserMessage.vue
        agentReply/
          GrepReply.vue
          InvokeSkillReply.vue
          ListDirectoryReply.vue
          ReadingFileReply.vue
          ReadingReply.vue
          SearchingFileReply.vue
          ThinkingReply.vue
  config/
    api_key.example.json           # Example API config
    api_key.sample.json            # Sample API config
  test/
    setup.js                       # Vitest setup; @ alias
    test-config.js                 # API connection test
    testChatHandlerMemory.test.ts
    testChatMemory.test.ts
    testReadFile.test.ts
    testReadTool.test.ts
    testTalkToAgent.test.ts
    testToolCalling.test.ts
    testToolRegistry.test.ts
```
