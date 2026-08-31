import type { TechArticle } from "./types";
import { somaticArticles } from "./somatic";
import { epigenomeArticles } from "./epigenome";
import { transcriptomeArticles } from "./transcriptome";
import { singlecellArticles } from "./singlecell";
import { liquidArticles } from "./liquid";
import { computeArticles } from "./compute";
import { EXTENDED_SECTIONS } from "./extendedSections";
import { EXTENDED_SECTIONS_2 } from "./extendedSections2";
import { EXTENDED_SECTIONS_B } from "./extendedSectionsB";
import { EXTENDED_SECTIONS_3 } from "./extendedSections3";
import { EXTENDED_SECTIONS_4 } from "./extendedSections4";
import { EXTENDED_SECTIONS_5 } from "./extendedSections5";
import { EXTENDED_SECTIONS_6 } from "./extendedSections6";

export const TECH_ARTICLES: TechArticle[] = [
  ...somaticArticles,
  ...epigenomeArticles,
  ...transcriptomeArticles,
  ...singlecellArticles,
  ...liquidArticles,
  ...computeArticles,
];

export const TECH_ARTICLE_MAP: Record<string, TechArticle> = Object.fromEntries(
  TECH_ARTICLES.map((a) => [a.slug, a]),
);

export function getTechArticle(slug: string): TechArticle | undefined {
  const base = TECH_ARTICLE_MAP[slug];
  if (!base) return undefined;
  const extra = [
    ...(EXTENDED_SECTIONS[slug] ?? []),
    ...(EXTENDED_SECTIONS_2[slug] ?? []),
    ...(EXTENDED_SECTIONS_B[slug] ?? []),
    ...(EXTENDED_SECTIONS_3[slug] ?? []),
    ...(EXTENDED_SECTIONS_4[slug] ?? []),
    ...(EXTENDED_SECTIONS_5[slug] ?? []),
    ...(EXTENDED_SECTIONS_6[slug] ?? []),
  ];
  if (!extra.length) return base;
  return { ...base, sections: [...base.sections, ...extra] };
}

export function countArticleChars(article: TechArticle): number {
  const merged = getTechArticle(article.slug) ?? article;
  const text = [
    merged.intro,
    ...merged.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets || [])]),
  ].join("");
  return text.length;
}
