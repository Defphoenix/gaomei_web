export interface User {
  id: number;
  username: string;
  email: string;
  date_joined: string;
  is_staff: boolean;
  is_bioinfo: boolean;
  role: "customer" | "analyst" | "reviewer" | "admin";
  report_count: number;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface Report {
  id: number;
  title: string;
  report_type: string;
  report_type_display: string;
  sample_id: string;
  report_date: string;
  summary: string;
  conclusion: string;
  report_number: string;
  status: "draft" | "review" | "released" | "void";
  genome_build: string;
  tumor_sample_id: string;
  normal_sample_id: string;
  product_code?: string;
  patient_no?: string;
  patient_info: Record<string, string | number | null>;
  analysis_data: WesAnalysisData;
  annotation_sources: AnnotationSource[];
  report_pdf_url: string;
  pdf_available: boolean;
  report_pdf_download_url: string;
  report_pdf_sha256: string;
  reviewed_by: string;
  released_at: string | null;
  created_at: string;
  item_count: number;
  patient_name: string;
  patient_email: string;
}

export interface ReportItem {
  id: number;
  gene: string;
  chromosome: string;
  position: number;
  end_position: number | null;
  ref_allele: string;
  alt_allele: string;
  variant_type: string;
  variant_type_display: string;
  significance: string;
  significance_display: string;
  af: number | null;
  methylation_level: number | null;
  cnv_ratio: number | null;
  annotation: string;
  transcript: string;
  hgvs_c: string;
  hgvs_p: string;
  consequence: string;
  tumor_depth: number | null;
  tumor_alt_reads: number | null;
  normal_depth: number | null;
  normal_alt_reads: number | null;
  tlod: number | null;
  filter_status: string;
  review_status: string;
  annotations: Record<string, string | number | boolean | null>;
  therapies: TherapyEvidence[];
  neoantigens: NeoantigenCandidate[];
  locus: string;
  ucsc_url: string;
  bam_track_url: string;
  bam_index_url: string;
  vcf_track_url: string;
  vcf_index_url: string;
}

export interface ReportDetail extends Report {
  items: ReportItem[];
  wes_report?: Record<string, unknown> | null;
}

export interface TherapyEvidence {
  drug: string;
  response: string;
  level: string;
  disease: string;
  source: string;
  status?: string;
}

export interface NeoantigenCandidate {
  peptide: string;
  length: number;
  hla: string;
  netmhcpan_rank: number | null;
  netmhcpan_affinity: number | null;
  mhcflurry_affinity: number | null;
  consensus: string;
}

export interface AnnotationSource {
  name: string;
  version: string;
  assembly: string;
  purpose: string;
  status: string;
}

export interface WesAnalysisData {
  is_demo?: boolean;
  schema_version?: string;
  document_type?: string;
  wes_report_id?: string;
  pipeline_version?: string;
  analysis_date?: string;
  assay?: string;
  qc?: {
    status?: string;
    tumor_mean_depth?: number;
    normal_mean_depth?: number;
    tumor_mapping_rate?: number;
    normal_mapping_rate?: number;
    tumor_duplication_rate?: number;
    normal_duplication_rate?: number;
    target_20x?: number;
    target_100x?: number;
  };
  biomarkers?: {
    tmb?: number;
    tmb_unit?: string;
    tmb_class?: string;
    tmb_variant_count?: number;
    msi_score?: number;
    msi_status?: string;
    hla_class_i?: string[];
    tumor_purity?: number;
  };
  counts?: {
    raw_mutect2?: number;
    mutect2_pass?: number;
    manual_filter_pass?: number;
    reportable?: number;
    snv?: number;
    indel?: number;
  };
  consequence_counts?: Record<string, number>;
  coverage_by_chromosome?: Array<{ chromosome: string; depth: number; coverage20x: number }>;
  filter_thresholds?: Record<string, string | number>;
  cnv?: Array<{ gene: string; type: string; log2: number; copy_number: number | null; status: string }>;
  msi_loci?: Array<{ locus: string; score: number; status: string }>;
  hla_typing?: Array<{ locus: string; allele1: string; allele2: string; resolution: string }>;
  organ_risks?: Array<{
    key: string;
    name: string;
    score: number;
    genes?: string[];
    evidence?: string;
    recommendation?: string;
  }>;
  contamination?: {
    fraction?: number;
    tumor_purity?: number;
    orientation_bias_status?: string;
    pair_concordance?: string;
  };
  workflow_steps?: Array<{
    step: string;
    label: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
  }>;
  igv_tracks?: {
    tumor_bam?: string;
    tumor_bai?: string;
    normal_bam?: string;
    normal_bai?: string;
    default_locus?: string;
  };
  sample?: {
    sample_id?: string;
    name?: string;
    sex?: string;
    age?: string;
    specimen_type?: string;
    clinical_diagnosis?: string;
  };
  portal_modules?: Record<string, {
    number?: string;
    title?: string;
    subtitle?: string;
    sections?: Array<{
      section_id?: string;
      number?: string;
      title?: string;
      paragraphs?: string[];
      tables?: Array<{ title?: string; columns?: string[]; rows?: string[][]; note?: string }>;
      notes?: string[];
    }>;
    samples?: Array<Record<string, unknown>>;
    table?: { title?: string; columns?: string[]; rows?: string[][] };
  }>;
  notices?: string[];
  limitations?: string[];
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  author_name: string;
  category_name: string;
  category_slug: string;
  tags: { id: number; name: string; slug: string }[];
  summary: string;
  featured_image: string | null;
  featured_image_url: string | null;
  wechat_link: string | null;
  views: number;
  status: string;
  show_on_homepage: boolean;
  homepage_order: number;
  published_at: string;
  created_at: string;
  content?: string;
  updated_at?: string;
}

// BioBlog types
export interface BioCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  post_count: number;
}

export interface BioPost {
  id: number;
  title: string;
  slug: string;
  author_name: string;
  category_name: string;
  category_slug: string;
  tags: { id: number; name: string; slug: string }[];
  summary: string;
  featured_image: string | null;
  featured_image_url: string | null;
  views: number;
  status: string;
  is_pinned: boolean;
  published_at: string;
  created_at: string;
  content?: string;
  updated_at?: string;
}

export interface BioComment {
  id: number;
  post: number;
  author_name: string;
  author_role: string;
  content: string;
  parent: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyInfo {
  name: string;
  slogan: string;
  description: string;
  mission: string;
  vision: string;
  email: string;
  phone: string;
  address: string;
  wechat: string;
  founded_year: number;
}

export interface TeamMember {
  id: number;
  name: string;
  position: string;
  bio: string;
  expertise?: string;
  photo: string | null;
  is_active?: boolean;
}

export interface ServiceItem {
  id: number;
  title: string;
  description: string;
  icon: string;
}

export interface HomepageData {
  company: CompanyInfo | null;
  services: ServiceItem[];
  team: TeamMember[];
  latest_posts: BlogPost[];
}
