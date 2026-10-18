// 上班時間常寫成「10:00~22:00，月休 4 天」；休假另外有標籤時，時間標籤只留時段，免得同一件事出現兩次。
export function hoursWithoutDaysOff(hours: string | null | undefined, daysOff: string | null | undefined) {
  if (!hours) return null;
  if (!daysOff || !hours.includes(daysOff)) return hours;
  const rest = hours.replace(daysOff, ' ').replace(/^[\s,，、;；/|]+|[\s,，、;；/|]+$/g, '').replace(/\s*[,，、;；/|]\s*[,，、;；/|]\s*/g, '，');
  return rest || null;
}
