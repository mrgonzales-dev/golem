const axios = require("axios");

/**
 * Streaming chat completion.
 *
 * Calls onProgress({ content, toolCalls, usage }) as chunks arrive
 * so the caller can update the UI in real time.
 */
async function chat(messages, model, options = {}, onProgress, abortSignal, config) {
  const { host, apiKey } = config;

  const requestBody = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (options.tools) {
    requestBody.tools = options.tools;
  }

  const response = await axios.post(`${host}/chat/completions`, requestBody, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    responseType: "stream",
    signal: abortSignal,
  });

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
                  function: { name: "", arguments: "" },
                });
              }
              const toolCallEntry = toolCallMap.get(toolCallIndex);
              if (toolCallDelta.id) toolCallEntry.id = toolCallDelta.id;
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

module.exports = { chat };
