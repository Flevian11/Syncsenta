import { gradeIdToName } from '@/lib/curriculum/grade-id';

export const LEARNING_GRADE_STORAGE_KEY = 'learningJourney.grade';

export function resolveSelectedGrade(profileGrade?: string | null): string | null {
  if (typeof window !== 'undefined') {
    const stored =
      window.sessionStorage.getItem(LEARNING_GRADE_STORAGE_KEY)
      || window.localStorage.getItem(LEARNING_GRADE_STORAGE_KEY);
    if (stored?.trim()) return gradeIdToName(stored.trim());
  }
  return profileGrade?.trim() || null;
}
