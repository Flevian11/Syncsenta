import { describe, expect, it } from 'vitest';
import { prepareSandboxForSubject, subjectToLearningSlug, subjectToSandboxId } from '../sandbox-preparation';

describe('sandbox preparation', () => {
  it('keeps the AGI learning slug stable while using the shared sandbox contract', () => {
    expect(subjectToLearningSlug('AGI')).toBe('ai');
    expect(subjectToSandboxId('AGI')).toBeNull();
  });

  it('prepares a grade-specific CBC activity without navigating', () => {
    const preparation = prepareSandboxForSubject('Grade 4', 'Mathematics');
    expect(preparation.gradeId).toBe('g4');
    expect(preparation.subjectId).toBe('mathematics');
    expect(preparation.preparedAt).toBeTruthy();
  });
});
