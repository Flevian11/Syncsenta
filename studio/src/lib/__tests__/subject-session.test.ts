import { describe, expect, it } from 'vitest';
import { SUBJECT_REGISTRY } from '../chat/subject-session';

describe('extended subject registry', () => {
  it('exposes one AGI course on the stable ai slug', () => {
    expect(SUBJECT_REGISTRY.ai).toMatchObject({
      label: 'AGI',
      layout: 'chat',
      xpPrefix: 'ai.',
    });
  });

  it('does not expose the duplicate Superintelligence subject', () => {
    expect(SUBJECT_REGISTRY.superintelligence).toBeUndefined();
  });
});
