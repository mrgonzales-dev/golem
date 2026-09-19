import { describe, test, expect } from "vitest";
import {
  fuzzyScore,
  fuzzyFilter,
} from "@/renderer/components/AgentInstance/partials/fuzzyFind";

describe("fuzzyScore", () => {
  test("returns a non-negative score for an exact substring match", () => {
    expect(fuzzyScore("llama", "llama-3")).toBeGreaterThanOrEqual(0);
  });

  test("matches a non-contiguous subsequence", () => {
    expect(fuzzyScore("lmc", "llama-coder")).toBeGreaterThanOrEqual(0);
  });

  test("returns -1 when a query character is missing", () => {
    expect(fuzzyScore("xyz", "llama-3")).toBe(-1);
  });

  test("returns -1 when characters are out of order", () => {
    expect(fuzzyScore("ba", "ab")).toBe(-1);
  });

  test("is case-insensitive", () => {
    expect(fuzzyScore("LLAMA", "llama-3")).toBeGreaterThanOrEqual(0);
    expect(fuzzyScore("llama", "LLAMA-3")).toBeGreaterThanOrEqual(0);
  });

  test("consecutive matches score higher than scattered matches", () => {
    expect(fuzzyScore("gpt", "gpt-4")).toBeGreaterThan(
      fuzzyScore("gpt", "g-p-t-x"),
    );
  });

  test("word-boundary matches score higher than mid-word matches", () => {
    expect(fuzzyScore("code", "qwen-code")).toBeGreaterThan(
      fuzzyScore("code", "xcodecx"),
    );
  });
});

describe("fuzzyFilter", () => {
  const models = ["llama-3", "qwen-coder", "gpt-4o", "mistral"];

  test("returns all items when the query is empty", () => {
    expect(fuzzyFilter(models, "")).toEqual(models);
  });

  test("filters out non-matching items", () => {
    const result = fuzzyFilter(models, "llama");
    expect(result).toEqual(["llama-3"]);
  });

  test("ranks better matches first", () => {
    const list = ["g-p-t-x", "gpt-4o"];
    const result = fuzzyFilter(list, "gpt");
    expect(result[0]).toBe("gpt-4o");
  });

  test("returns an empty array when nothing matches", () => {
    expect(fuzzyFilter(models, "zzz")).toEqual([]);
  });
});
