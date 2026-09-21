import { redirect } from 'next/navigation';

/**
 * The student demo is the real student_1 account now. Keep this legacy URL
 * as a compatibility redirect so no second mock workflow can drift from LMS
 * behavior, privacy rules, or the grade-first onboarding contract.
 */
export default function StudentDemoRedirect() {
  redirect('/login/student');
}
