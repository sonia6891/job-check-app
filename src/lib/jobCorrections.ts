/** Human review values are deliberately separate from unmodified source text. */
export type EditableJobFields = {
  job_title: string;
  display_company_name: string;
  salary_raw: string;
  location_raw: string;
  work_hours_raw: string;
  employment_type: string;
};

export const editableKeys: Array<keyof EditableJobFields> = [
  'job_title','display_company_name','salary_raw','location_raw','work_hours_raw','employment_type'
];

export function normalizeEditableFields(values: EditableJobFields): EditableJobFields {
  return {
    job_title: values.job_title.trim(),
    display_company_name: values.display_company_name.trim(),
    salary_raw: values.salary_raw.trim(),
    location_raw: values.location_raw.trim(),
    work_hours_raw: values.work_hours_raw.trim(),
    employment_type: values.employment_type.trim()
  };
}

/** Returns an explicit patch only for changed fields; does not rewrite the original posting or quota. */
export function makeJobCorrectionPatch(
  original: EditableJobFields,
  edited: EditableJobFields,
  structuredData: Record<string, unknown> | null | undefined,
  correctionDate: string
): Record<string, unknown> {
  const before = normalizeEditableFields(original);
  const after = normalizeEditableFields(edited);
  const changes = editableKeys.filter((key) => before[key] !== after[key]);
  if (!changes.length) return {};
  const patch: Record<string, unknown> = {};
  for (const key of changes) patch[key] = after[key] || null;

  // Never keep numeric ranges parsed from a salary that the user has corrected.
  if (changes.includes('salary_raw')) {
    patch.salary_min = null;
    patch.salary_max = null;
    patch.salary_type = null;
  }

  const structured: Record<string, unknown> =
    structuredData && typeof structuredData === 'object' && !Array.isArray(structuredData)
      ? { ...structuredData } : {};
  const missingByColumn: Record<string,string> = {
    job_title:'job_title',
    display_company_name:'company_name',
    salary_raw:'salary',
    location_raw:'location',
    work_hours_raw:'work_hours'
  };
  const existingMissing = Array.isArray(structured.missing_information)
    ? structured.missing_information.filter((item): item is string => typeof item === 'string')
    : [];
  const missing = new Set(existingMissing);
  for (const key of changes) {
    const field = missingByColumn[key];
    if (!field) continue;
    if (after[key]) missing.delete(field);
    else missing.add(field);
  }
  structured.missing_information = Array.from(missing);

  // Explicit provenance allows later report logic to distinguish user corrections from machine parsing.
  const previous = structured.manual_corrections && typeof structured.manual_corrections === 'object' && !Array.isArray(structured.manual_corrections)
    ? structured.manual_corrections as Record<string, unknown> : {};
  const previousFields = Array.isArray(previous.fields)
    ? previous.fields.filter((item): item is keyof EditableJobFields => typeof item === 'string' && editableKeys.includes(item as keyof EditableJobFields))
    : [];
  structured.manual_corrections = {
    fields: Array.from(new Set([...previousFields, ...changes])),
    updated_at: correctionDate
  };
  patch.structured_data = structured;
  patch.updated_at = correctionDate;
  return patch;
}

/**
 * Only a changed company name needs a new employer lookup and official-record query (which may use quota).
 * Other corrections only change the report, which the report screen rebuilds on open.
 */
export function correctionNeedsReanalysis(original: EditableJobFields, edited: EditableJobFields): boolean {
  return normalizeEditableFields(original).display_company_name !== normalizeEditableFields(edited).display_company_name;
}
