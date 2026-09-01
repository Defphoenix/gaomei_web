import type { ReportItem } from "../types";

export interface WesReportModule {
  number?: string;
  title?: string;
  subtitle?: string;
  sections?: WesReportSection[];
  samples?: Array<Record<string, unknown>>;
  table?: WesReportTable;
}

export interface WesReportSection {
  section_id?: string;
  number?: string;
  title?: string;
  subtitle?: string;
  paragraphs?: string[];
  tables?: WesReportTable[];
  bullets?: string[];
  notes?: string[];
}

export interface WesReportTable {
  title?: string;
  columns?: string[];
  rows?: string[][];
  note?: string;
}

export interface WesReportPayload {
  report?: {
    report_id?: string;
    title?: string;
    generated_at?: string;
    reviewer?: string;
  };
  sample?: {
    sample_id?: string;
    name?: string;
    sex?: string;
    age?: string;
    specimen_type?: string;
    clinical_diagnosis?: string;
  };
  layout?: { document_type?: string };
  overview?: WesReportModule;
  targeted_therapy?: WesReportModule;
  quality_control?: WesReportModule;
  somatic_variants?: WesReportModule;
  immunotherapy?: WesReportModule;
  neoantigens?: WesReportModule;
  hereditary_risk?: WesReportModule;
  pharmacogenomics?: WesReportModule;
  limitations?: string[];
  notices?: string[];
}

export function isClinicalV2Report(
  analysisData?: { document_type?: string; wes_report_id?: string },
  wesReport?: WesReportPayload | null,
): boolean {
  if (analysisData?.document_type === "clinical_v2") return true;
  if (analysisData?.wes_report_id) return true;
  return wesReport?.layout?.document_type === "clinical_v2";
}

export function moduleTables(module?: WesReportModule | null): WesReportTable[] {
  if (!module) return [];
  const tables: WesReportTable[] = [];
  if (module.table) tables.push(module.table);
  for (const section of module.sections || []) {
    tables.push(...(section.tables || []));
  }
  return tables.filter((table) => (table.rows?.length || 0) > 0);
}

export function igvLocusForItem(item: ReportItem, padding = 150): string {
  const start = Math.max(1, item.position - padding);
  const end = (item.end_position || item.position) + padding;
  return `chr${item.chromosome}:${start}-${end}`;
}

export function flattenModuleSections(module?: WesReportModule | null): WesReportSection[] {
  return module?.sections || [];
}
