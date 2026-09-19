import { describe, test, expect } from "vitest";
import {
  enqueue,
  dequeue,
  shouldFlush,
  handleSend,
} from "@/renderer/components/AgentInstance/partials/agentQueue";

describe("Agent queue logic", () => {
  describe("enqueue", () => {
    test("adds text to the end of the queue", () => {
      const queue = ["a"];
      const result = enqueue(queue, "b");
      expect(result).toEqual(["a", "b"]);
    });

    test("does not mutate the original array", () => {
      const queue = ["a"];
      enqueue(queue, "b");
      expect(queue).toEqual(["a"]);
    });

    test("handles an empty queue", () => {
      const result = enqueue([], "hello");
      expect(result).toEqual(["hello"]);
    });
  });

  describe("dequeue", () => {
    test("removes and returns the first item", () => {
      const result = dequeue(["a", "b"]);
      expect(result.item).toBe("a");
      expect(result.rest).toEqual(["b"]);
    });

    test("does not mutate the original array", () => {
      const queue = ["a", "b"];
      dequeue(queue);
      expect(queue).toEqual(["a", "b"]);
    });

    test("returns null item for an empty queue", () => {
      const result = dequeue([]);
      expect(result.item).toBeNull();
      expect(result.rest).toEqual([]);
    });

    test("returns empty rest for a single-item queue", () => {
      const result = dequeue(["only"]);
      expect(result.item).toBe("only");
      expect(result.rest).toEqual([]);
    });
  });

  describe("shouldFlush", () => {
    test("returns noop when queue is empty", () => {
      expect(shouldFlush([], false)).toBe("noop");
      expect(shouldFlush([], true)).toBe("noop");
    });

    test("returns interrupt when queue has items and AI is responding", () => {
      expect(shouldFlush(["a"], true)).toBe("interrupt");
    });

    test("returns send when queue has items and AI is idle", () => {
      expect(shouldFlush(["a"], false)).toBe("send");
    });
  });

  describe("handleSend", () => {
    test("returns send action when AI is idle", () => {
      const result = handleSend([], false, "hello");
      expect(result.action).toBe("send");
      expect(result.text).toBe("hello");
      expect(result.queue).toEqual([]);
    });

    test("returns queue action when AI is responding", () => {
      const result = handleSend([], true, "hello");
      expect(result.action).toBe("queue");
      expect(result.queue).toEqual(["hello"]);
    });

    test("appends to existing queue when AI is responding", () => {
      const result = handleSend(["a"], true, "b");
      expect(result.action).toBe("queue");
      expect(result.queue).toEqual(["a", "b"]);
    });

    test("does not mutate the original queue", () => {
      const queue = ["a"];
      handleSend(queue, true, "b");
      expect(queue).toEqual(["a"]);
    });

    test("does not queue empty or whitespace-only text", () => {
      const result = handleSend([], true, "   ");
      expect(result.action).toBe("noop");
      expect(result.queue).toEqual([]);
    });

    test("returns noop for empty text when AI is idle", () => {
      const result = handleSend([], false, "");
      expect(result.action).toBe("noop");
    });
  });
});
