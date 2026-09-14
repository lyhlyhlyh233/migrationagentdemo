import type { Language } from "../preferences";
import english from "./en.json";
import { statusLabels } from "./status-labels";
const catalog: Record<string, string> = english;
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(catalog)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(
    ([a], [b]) =>
      b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
  )
  .map(([key, value]) => ({
    regex: new RegExp(
      `^${key
        .split(/\{\d+\}/)
        .map(escapeRegex)
        .join("([\\s\\S]*?)")}$`,
    ),
    value,
  }));

export function translateText(
  text: string,
  language: Language,
  depth = 0,
): string {
  text = statusLabels[text] ?? text;
  if (language !== "en" || !/[\u4e00-\u9fff]/.test(text)) return text;
  if (catalog[text]) return catalog[text];
  // Only full, authored messages match templates; unknown names and content stay intact.
  if (depth < 4)
    for (const template of templates) {
      const match = template.regex.exec(text);
      if (match)
        return template.value.replace(/\{(\d+)\}/g, (_, index: string) =>
          translateText(match[Number(index) + 1], language, depth + 1),
        );
    }
  if (depth < 4 && text.includes("\n")) {
    const separator = text.includes("\n\n") ? "\n\n" : "\n";
    return text
      .split(separator)
      .map((part) => translateText(part, language, depth + 1))
      .join(separator);
  }
  return text;
}

export function formatText(
  key: string,
  language: Language,
  values: (string | number)[],
): string {
  const template = language === "en" ? catalog[key] || key : key;
  return template.replace(/\{(\d+)\}/g, (token, index: string) =>
    values[Number(index)] === undefined ? token : String(values[Number(index)]),
  );
}

export function localize<T>(
  value: T,
  language: Language,
  values: (string | number)[] = [],
): T {
  if (typeof value === "string" && values.length)
    return formatText(value, language, values) as T;
  if (typeof value === "string") return translateText(value, language) as T;
  if (Array.isArray(value))
    return value.map((item) => localize(item, language)) as T;
  return value;
}
