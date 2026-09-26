const axios = require("axios");

/**
 * Build a readable error from a failed chat request.
 * Providers return the true cause in the response body,
 * but axios only keeps a bare status line in err.message.
 */
function readableChatError(err, model) {
  if (!err.response) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return `Cannot reach the server. Check the host in Settings and start the server. (${err.message})`;
    }
    return err.message;
  }
  const status = err.response.status;
  const data = err.response.data;
  let detail = "";
  if (data) {
    if (typeof data.error === "string") detail = data.error;
    else if (data.error && typeof data.error.message === "string")
      detail = data.error.message;
    else if (typeof data.message === "string") detail = data.message;
    else if (typeof data === "string") detail = data;
    else {
      try {
        detail = JSON.stringify(data).slice(0, 300);
      } catch {
        detail = "";
      }
    }
  }
  if (status === 401 || status === 403) {
    return `The server rejected the API key (HTTP ${status}). Check the key in Settings.${detail ? ` Server says: ${detail}` : ""}`;
  }
  if (status === 404) {
    return `The server has no such route (HTTP 404). Check the host path in Settings, e.g. http://localhost:1234/v1.${detail ? ` Server says: ${detail}` : ""}`;
  }
  if (/upstream/i.test(detail)) {
    return `Go's upstream model server refused the request (HTTP ${status}). Try again or pick another model.${detail ? ` Go says: ${detail}` : ""}`;
  }
  if (status === 400 && /model/i.test(detail)) {
    return `The server rejected the model "${model}". Pick a valid model from the list.${detail ? ` Server says: ${detail}` : ""}`;
  }
  if (status === 400 && /stream_options|stream/i.test(detail)) {
    return `The server rejected the streaming options (HTTP 400). The server build may be too old.${detail ? ` Server says: ${detail}` : ""}`;
  }
  if (status === 400 && /tool/i.test(detail)) {
    return `The server rejected the tool calls (HTTP 400). This model may not support tools.${detail ? ` Server says: ${detail}` : ""}`;
  }
  return `The server refused the request (HTTP ${status}).${detail ? ` Server says: ${detail}` : ""}`;
}

/**
 * Drain an error response stream into text. Requests run with
 * responseType "stream", so a 4xx/5xx error body arrives as a
 * Readable, not parsed JSON. Without this, readableChatError sees
 * a stream object and the real server message is lost.
 */
async function drainErrorBody(err) {
  const data = err.response && err.response.data;
  if (!data || typeof data.on !== "function") return;
  const text = await new Promise((resolve) => {
    let buf = "";
    data.on("data", (chunk) => (buf += chunk.toString("utf8")));
    data.on("end", () => resolve(buf));
    data.on("error", () => resolve(buf));
  });
  try {
    err.response.data = JSON.parse(text);
  } catch {
    err.response.data = text;
  }
}

/**
 * Parse user-supplied extra headers, one "Name: value" per line.
 * Blank or malformed lines are skipped. These sit last in the header
 * object, so an explicit entry can override a built-in name.
 */
function parseExtraHeaders(raw) {
  const out = {};
  for (const line of String(raw || "").split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const name = line.slice(0, i).trim();
    if (name) out[name] = line.slice(i + 1).trim();
  }
  return out;
}

/**
 * Copy of the messages without reasoning_content on assistant turns.
 * Interleaved-thinking providers want the field echoed back; others
 * reject unknown keys, so the fallback chain sends this copy.
 * @param {object[]} messages - The API message history.
 * @returns {object[]} A new array; unchanged messages are shared.
 */
function stripReasoning(messages) {
  return messages.map((m) => {
    if (!m.reasoning_content) return m;
    const { reasoning_content, ...rest } = m;
    return rest;
  });
}

/**
 * Streaming chat completion.
 *
 * Calls onProgress({ content, toolCalls, usage }) as chunks arrive
 * so the caller can update the UI in real time.
 */
async function chat(
  messages,
  model,
  options = {},
  onProgress,
  abortSignal,
  config,
) {
  const { host, apiKey, sessionId, requestId, effort } = config;
  // Header names come from Settings. undefined means the caller passed
  // no config, so the opencode defaults stand. "" disables the header.
  const sessionName =
    config.sessionHeader === undefined
      ? "x-opencode-session"
      : config.sessionHeader;
  const requestName =
    config.requestHeader === undefined
      ? "x-opencode-request"
      : config.requestHeader;

  const fullBody = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (effort && effort !== "default" && effort !== "off") {
    fullBody.reasoning_effort = effort;
  }

  if (options.tools) {
    fullBody.tools = options.tools;
  }

  // Bodies from richest to plainest. Some upstream servers reject
  // stream_options, reasoning_effort, reasoning_content on assistant
  // turns, or tools, so retry stripped on a 4xx refusal.
  const bodies = [fullBody];
  const noStream = { ...fullBody };
  delete noStream.stream_options;
  bodies.push(noStream);
  if (fullBody.reasoning_effort) {
    const noEffort = { ...noStream };
    delete noEffort.reasoning_effort;
    bodies.push(noEffort);
  }
  const hasReasoning = messages.some((m) => m.reasoning_content);
  if (hasReasoning) {
    const noReasoning = { ...noStream, messages: stripReasoning(messages) };
    delete noReasoning.reasoning_effort;
    bodies.push(noReasoning);
  }
  if (fullBody.tools) {
    const noTools = { ...noStream };
    if (hasReasoning) noTools.messages = stripReasoning(messages);
    delete noTools.reasoning_effort;
    delete noTools.tools;
    bodies.push(noTools);
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "User-Agent": "GOLEM/1.0",
    ...(sessionName ? { [sessionName]: sessionId } : {}),
    ...(requestName ? { [requestName]: requestId } : {}),
    ...parseExtraHeaders(config.extraHeaders),
  };

  let response = null;
  let lastErr = null;
  for (const body of bodies) {
    try {
      response = await axios.post(`${host}/chat/completions`, body, {
        headers,
        responseType: "stream",
        signal: abortSignal,
      });
      break;
    } catch (err) {
      if (err.message === "Aborted" || err.message === "canceled") throw err;
      await drainErrorBody(err);
      lastErr = err;
      if (process.env.GOLEM_DEBUG) {
        console.error(
          `[debug] POST ${host}/chat/completions body=${JSON.stringify(body).slice(0, 600)}`,
        );
        console.error(
          `[debug] -> HTTP ${err.response ? err.response.status : "?"} ${JSON.stringify(err.response ? err.response.data : err.message).slice(0, 600)}`,
        );
      }
      const status = err.response ? err.response.status : 0;
      if (status < 400 || status >= 500) break;
    }
  }
  if (!response) {
    throw new Error(readableChatError(lastErr, model));
  }

  let accumulatedContent = "";
  let accumulatedReasoning = "";
  let tokenUsage = null;
  const toolCallMap = new Map();

  const sseBuffer = { data: "" };

  await new Promise((resolve, reject) => {
    if (abortSignal && abortSignal.aborted) {
      response.data.destroy();
      reject(new Error("Aborted"));
      return;
    }

    // Named handler so it can be removed when the request finishes.
    // Without removal, each tool-loop round leaks a listener on the
    // shared session signal (MaxListenersExceededWarning).
    const onAbort = () => {
      response.data.destroy();
      reject(new Error("Aborted"));
    };
    if (abortSignal) {
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }
    const cleanup = () => {
      if (abortSignal) abortSignal.removeEventListener("abort", onAbort);
    };

    response.data.on("data", (chunk) => {
      sseBuffer.data += chunk.toString();
      const lines = sseBuffer.data.split("\n");
      sseBuffer.data = lines.pop();

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;
        const jsonString = trimmedLine.slice(5).trim();
        if (jsonString === "[DONE]") continue;

        let parsedEvent;
        try {
          parsedEvent = JSON.parse(jsonString);
        } catch {
          continue;
        }

        if (parsedEvent.usage) {
          tokenUsage = parsedEvent.usage;
        }

        const delta = parsedEvent.choices?.[0]?.delta;

        if (delta) {
          if (delta.content) {
            accumulatedContent += delta.content;
          }
          if (delta.reasoning_content) {
            accumulatedReasoning += delta.reasoning_content;
          } else if (delta.reasoning) {
            accumulatedReasoning += delta.reasoning;
          }
          if (delta.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const toolCallIndex = toolCallDelta.index ?? 0;
              if (!toolCallMap.has(toolCallIndex)) {
                toolCallMap.set(toolCallIndex, {
                  id: toolCallDelta.id || "",
                  type: "function",
                  function: { name: "", arguments: "" },
                });
              }
              const toolCallEntry = toolCallMap.get(toolCallIndex);
              if (toolCallDelta.id) toolCallEntry.id = toolCallDelta.id;
              if (toolCallDelta.type) toolCallEntry.type = toolCallDelta.type;
              if (toolCallDelta.function?.name)
                toolCallEntry.function.name += toolCallDelta.function.name;
              if (toolCallDelta.function?.arguments)
                toolCallEntry.function.arguments +=
                  toolCallDelta.function.arguments;
            }
          }
        }

        if (onProgress) {
          onProgress({
            content: accumulatedContent,
            toolCalls: Array.from(toolCallMap.values()),
            usage: tokenUsage,
            reasoning: accumulatedReasoning,
          });
        }
      }
    });

    response.data.on("end", () => {
      cleanup();
      resolve();
    });
    response.data.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });

  const toolCalls = Array.from(toolCallMap.values()).filter(
    (toolCallEntry) => toolCallEntry.function.name,
  );

  return {
    content: accumulatedContent,
    toolCalls,
    usage: tokenUsage,
    reasoning: accumulatedReasoning,
  };
}

module.exports = { chat, stripReasoning };
