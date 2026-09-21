import { describe, expect, it } from 'vitest'
import { gradeIdToName } from '@/lib/curriculum/grade-id'
import { resolveSelectedGrade } from '@/lib/learning-context'

describe('learning context', () => {
  it('normalizes grade ids used by route compatibility links', () => {
    expect(gradeIdToName('g4')).toBe('Grade 4')
    expect(gradeIdToName('g8')).toBe('Grade 8')
    expect(resolveSelectedGrade('Grade 8')).toBe('Grade 8')
  })
})
