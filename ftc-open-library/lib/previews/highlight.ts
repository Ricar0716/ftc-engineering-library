import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import properties from "highlight.js/lib/languages/properties";
import python from "highlight.js/lib/languages/python";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { highlightLanguageFor } from "./select.ts";

let registered = false;

function ensureLanguages() {
  if (registered) {
    return;
  }
  hljs.registerLanguage("c", c);
  hljs.registerLanguage("cpp", cpp);
  hljs.registerLanguage("ini", ini);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("kotlin", kotlin);
  hljs.registerLanguage("markdown", markdown);
  hljs.registerLanguage("plaintext", plaintext);
  hljs.registerLanguage("properties", properties);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("xml", xml);
  hljs.registerLanguage("yaml", yaml);
  hljs.registerLanguage("gradle", java);
  registered = true;
}

/**
 * Highlight source as escaped HTML. Never evaluates the file.
 */
export function highlightSource(filename: string, source: string): string {
  ensureLanguages();
  const language = highlightLanguageFor(filename) ?? "plaintext";
  try {
    if (hljs.getLanguage(language)) {
      return hljs.highlight(source, { language, ignoreIllegals: true }).value;
    }
  } catch {
    // Fall through to escaped plaintext.
  }
  return hljs.highlight(source, { language: "plaintext", ignoreIllegals: true }).value;
}

export function looksBinary(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 8000));
  let zeros = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      zeros += 1;
    }
  }
  return zeros > 8;
}

export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}
