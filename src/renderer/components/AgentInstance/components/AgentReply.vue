<template>
  <div class="msg-ai">
    <span class="msg-ai-bullet">●</span>
    <div class="msg-ai-content markdown-body" v-html="rendered"></div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import "github-markdown-css/github-markdown.css";

const md = new MarkdownIt();

const props = defineProps({
  text: { type: String, required: true },
});

const rendered = computed(() => md.render(props.text));
</script>

<style scoped>
/* Remap github-markdown-css variables to the digital brutalism
   palette. Scoped attribute on .markdown-body beats the library's
   media-query rules; custom properties inherit into v-html content. */
.markdown-body {
  background-color: transparent;
  color: var(--text);
  --fontStack-sansSerif: "Fira Code", monospace;
  --fontStack-monospace: "Fira Code", monospace;
  --fgColor-default: var(--text);
  --fgColor-muted: var(--text-secondary);
  --fgColor-accent: var(--text);
  --fgColor-attention: var(--warning);
  --fgColor-danger: var(--danger);
  --fgColor-success: var(--success);
  --fgColor-done: var(--text-secondary);
  --bgColor-default: transparent;
  --bgColor-muted: var(--bg-secondary);
  --bgColor-neutral-muted: rgba(255, 255, 255, 0.08);
  --bgColor-attention-muted: rgba(255, 255, 255, 0.06);
  --borderColor-default: var(--border);
  --borderColor-muted: rgba(255, 255, 255, 0.35);
  --borderColor-neutral-muted: rgba(255, 255, 255, 0.35);
  --borderColor-accent-emphasis: var(--border);
  --borderColor-attention-emphasis: var(--warning);
  --borderColor-danger-emphasis: var(--danger);
  --borderColor-done-emphasis: var(--text-secondary);
  --borderColor-success-emphasis: var(--success);
  --focus-outlineColor: var(--border);
  --color-prettylights-syntax-comment: var(--text-secondary);
  --color-prettylights-syntax-constant: var(--text);
  --color-prettylights-syntax-constant-other-reference-link: var(--text);
  --color-prettylights-syntax-entity: var(--text);
  --color-prettylights-syntax-entity-tag: var(--text);
  --color-prettylights-syntax-keyword: var(--text);
  --color-prettylights-syntax-markup-bold: var(--text);
  --color-prettylights-syntax-markup-changed-bg: rgba(255, 255, 255, 0.1);
  --color-prettylights-syntax-markup-changed-text: var(--text);
  --color-prettylights-syntax-markup-deleted-bg: rgba(255, 255, 255, 0.06);
  --color-prettylights-syntax-markup-deleted-text: var(--text-secondary);
  --color-prettylights-syntax-markup-heading: var(--text);
  --color-prettylights-syntax-markup-ignored-bg: var(--bg-tertiary);
  --color-prettylights-syntax-markup-ignored-text: var(--text);
  --color-prettylights-syntax-markup-inserted-bg: rgba(255, 255, 255, 0.1);
  --color-prettylights-syntax-markup-inserted-text: var(--text);
  --color-prettylights-syntax-markup-italic: var(--text);
  --color-prettylights-syntax-markup-list: var(--warning);
  --color-prettylights-syntax-meta-diff-range: var(--text-secondary);
  --color-prettylights-syntax-storage-modifier-import: var(--text);
  --color-prettylights-syntax-string: var(--text);
  --color-prettylights-syntax-string-regexp: var(--text);
  --color-prettylights-syntax-sublimelinter-gutter-mark: var(--text-secondary);
  --color-prettylights-syntax-variable: var(--text);
  --color-prettylights-syntax-brackethighlighter-angle: var(--text-secondary);
  --color-prettylights-syntax-brackethighlighter-unmatched: var(--danger);
  --color-prettylights-syntax-carriage-return-bg: var(--bg-tertiary);
  --color-prettylights-syntax-carriage-return-text: var(--text);
}
</style>
