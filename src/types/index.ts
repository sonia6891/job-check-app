export type JobParseResult = {
  job_id: string | null;
  parsed: {
    job_title: string | null;
    display_company_name: string | null;
    salary?: { raw?: string | null; min?: number | null; max?: number | null; type?: string | null; currency?: string };
    location?: string | null;
    working_hours?: { raw?: string | null };
    missing_information?: string[];
    conditions_to_confirm?: Array<{ type: string; source_text: string; question: string }>;
    parser_mode?: string;
    parse_confidence?: number;
  };
  next_action: string;
};

export type AnalysisStepValue = string | { status?: string; [key: string]: unknown };

export type AnalysisRunResult = {
  run_id: string;
  status: 'completed' | 'partial' | 'failed';
  steps?: Record<string, AnalysisStepValue>;
  report?: JobReport;
  error?: string;
  report_error?: unknown;
};

export type OfficialRecordsStatus = 'checked' | 'partial' | 'failed' | 'not_checked' | 'not_checked_until_company_confirmed';

/** resolve-company 列出的同名雇主候選（公司登記或商業登記）。 */
export type EmployerCandidate = {
  tax_id: string;
  legal_name: string;
  status: string | null;
  representative: string | null;
  address: string | null;
  capital: number | null;
  established_at: string | null;
  entity_type: 'company' | 'business' | 'organization' | 'unknown' | (string & {});
  registry_source: string | null;
  confidence: number;
  match_method: string | null;
};

export type JobReport = {
  report_version: string;
  generated_at: string;
  job: {
    id: string;
    title: string | null;
    display_company_name: string | null;
    location: string | null;
    work_hours: string | null;
    employment_type: string | null;
    experience: string | null;
    education: string | null;
    parser_mode: string | null;
    parser_version: string | null;
    parse_confidence: number | null;
  };
  company: {
    match_status: 'confirmed' | 'probable' | 'unconfirmed';
    confidence: number | null;
    match_method: string | null;
    legal_name: string | null;
    tax_id: string | null;
    status: string | null;
    representative: string | null;
    address: string | null;
    capital: number | null;
    paid_in_capital: number | null;
    established_at: string | null;
  };
  official_records: {
    /** checked／partial／failed／not_checked／not_checked_until_company_confirmed（後端 build-job-report 1.1） */
    status: OfficialRecordsStatus | (string & {});
    fetched_at?: string | null;
    /** build-job-report 1.5：違規資料副本最後同步的時間（取最舊的資料集）。 */
    data_as_of?: string | null;
    /** build-job-report 1.5：紀錄屬於「可能是」的公司，還沒確認。 */
    tentative?: boolean;
    total: number;
    summary_by_law: Record<string, { count: number; latest_date: string | null }>;
    records: Array<{
      dataset_id?: string;
      agency?: string | null;
      law_type?: string;
      law_article?: string | null;
      violation_summary?: string | null;
      decision_date?: string | null;
      fine_amount?: number | null;
      source_url?: string | null;
    }>;
  };
  salary: {
    job_offer: { raw?: string | null; min?: number | null; max?: number | null; type?: string | null; currency?: string };
    benchmark_status: string;
    region?: string | null;
    benchmarks: Array<{
      industry: string;
      job_category: string;
      period: string;
      average_salary: number;
      source_name: string;
      source_url: string;
    }>;
  };
  manual_review?: {
    edited_fields: string[];
    original_hints_to_recheck: Array<{ type?: string; source_text?: string; question?: string }>;
    summary?: string | null;
  };
  conditions_to_confirm: Array<{ type?: string; source_text?: string; question?: string }>;
  missing_information: string[];
  /** build-job-report 1.3：依上班時段與休假方式產生的工時提醒。 */
  labor_hints?: import('@/src/lib/workHours').WorkHoursHint[];
  /** build-job-report 1.4：職缺原文裡的詐騙特徵與可能違法的條件。 */
  posting_risks?: import('@/src/lib/postingRisks').PostingRiskHint[];
  interview_questions: Array<{ category: string; question: string; reason?: string | null; source_text?: string | null; priority?: number }>;
  sources: Record<string, string>;
  disclaimer: string;
};
