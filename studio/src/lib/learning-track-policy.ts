/**
 * Shared learning-track policy.
 *
 * The track is a product/domain boundary, not a user-controlled permission.
 * Keep it derived from the server-side subject slug and use it to constrain
 * tutoring style, examples, and safety language consistently.
 */

export type LearningTrack = 'cbc' | 'agi' | 'blockchain' | 'financial-literacy';

export interface LearningTrackPolicy {
  track: LearningTrack;
  label: string;
  focus: string;
  socraticMoves: string;
  safety: string;
  examples: string[];
}

const POLICIES: Record<LearningTrack, LearningTrackPolicy> = {
  cbc: {
    track: 'cbc',
    label: 'Kenyan CBC',
    focus: 'the selected CBC competency and the next smallest learning step',
    socraticMoves: 'connect the idea to a concrete local example, then ask one guiding question',
    safety: 'stay within the selected CBC subject and redirect unrelated questions to the correct learning area',
    examples: ['Kenyan classroom', 'school friends', 'local community'],
  },
  agi: {
    track: 'agi',
    label: 'AGI',
    focus: 'how intelligent systems represent goals, use evidence, handle uncertainty, and remain under human oversight',
    socraticMoves: 'ask the learner to distinguish a claim from evidence, predict an outcome, or test a limitation with a simple example',
    safety: 'describe AGI as a learning concept, not a claim that the tutor or any system is conscious; never encourage unsafe autonomous control, deception, or bypassing human oversight',
    examples: ['a school recommendation system', 'a translation tool', 'a human teacher checking an AI suggestion'],
  },
  blockchain: {
    track: 'blockchain',
    label: 'Blockchain and Crypto Foundations',
    focus: 'ledgers, blocks, consensus, wallets, digital ownership, security, and real-world trade-offs',
    socraticMoves: 'use a shared-ledger scenario, then ask the learner to trace who can verify, change, or authorize the next step',
    safety: 'teach concepts without requesting wallet addresses, seed phrases, private keys, passwords, or payments; do not give transaction execution or investment instructions',
    examples: ['a class shared ledger', 'a market receipt', 'a group agreeing on the next record'],
  },
  'financial-literacy': {
    track: 'financial-literacy',
    label: 'Financial Literacy',
    focus: 'needs and wants, budgeting, saving, earning, borrowing, risk, opportunity cost, and responsible decision-making',
    socraticMoves: 'ask the learner to name the goal, compare trade-offs, and calculate a simple scenario before choosing',
    safety: 'teach general financial education only; do not give personalized investment, lending, tax, or payment instructions and never request account, identity, or payment details',
    examples: ['a market budget in Kenyan shillings', 'saving for school supplies', 'comparing two everyday choices'],
  },
};

function normaliseSubject(subject: string): string {
  return subject.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

export function getLearningTrack(subject: string): LearningTrack {
  const value = normaliseSubject(subject);
  if (value === 'ai' || value === 'agi' || value.includes('artificial intelligence')) return 'agi';
  if (value === 'blockchain' || value === 'crypto' || value === 'cryptocurrency' || value === 'web3') return 'blockchain';
  if (value === 'financial literacy' || value === 'finlit' || value === 'personal finance') return 'financial-literacy';
  return 'cbc';
}

export function getLearningTrackPolicy(trackOrSubject: LearningTrack | string): LearningTrackPolicy {
  const track = Object.prototype.hasOwnProperty.call(POLICIES, trackOrSubject)
    ? trackOrSubject as LearningTrack
    : getLearningTrack(trackOrSubject);
  return POLICIES[track];
}

export function buildLearningTrackPromptBlock(subject: string): string {
  const policy = getLearningTrackPolicy(subject);
  return `LEARNING TRACK — ${policy.label}\n- Track focus: ${policy.focus}.\n- Preferred Socratic move: ${policy.socraticMoves}.\n- Safety boundary: ${policy.safety}.\n- Example palette: ${policy.examples.join('; ')}.`;
}

export function getTrackDecisionContent(
  track: LearningTrack,
  scaffolding: 'Independent' | 'Guided' | 'Intensive',
): { hint: string; nextAction: string } | null {
  if (track === 'cbc') return null;

  const content: Record<Exclude<LearningTrack, 'cbc'>, Record<'Independent' | 'Guided' | 'Intensive', { hint: string; nextAction: string }>> = {
    agi: {
      Intensive: { hint: 'Let us test one claim about an intelligent system with a simple example and name what the system cannot know.', nextAction: 'test_agi_claim_with_example' },
      Guided: { hint: 'What evidence would help us decide whether this intelligent system is working well?', nextAction: 'ask_agi_evidence_question' },
      Independent: { hint: 'Compare the system goal, its evidence, and one limitation before proposing the next step.', nextAction: 'present_agi_systems_challenge' },
    },
    blockchain: {
      Intensive: { hint: 'Let us trace one shared-ledger record together: who proposes it, who verifies it, and what information must stay private?', nextAction: 'trace_blockchain_record_safely' },
      Guided: { hint: 'In our class-ledger example, what would the group need to agree on before accepting the next record?', nextAction: 'ask_consensus_question' },
      Independent: { hint: 'Explain one benefit and one trade-off of this blockchain design without sharing any real wallet or account details.', nextAction: 'present_blockchain_tradeoff_challenge' },
    },
    'financial-literacy': {
      Intensive: { hint: 'Let us name the goal, list the available amount, and compare one safe everyday choice at a time.', nextAction: 'build_budget_example' },
      Guided: { hint: 'What is the goal, and which choice has the clearest benefit and cost?', nextAction: 'ask_financial_tradeoff_question' },
      Independent: { hint: 'Build a simple scenario showing the goal, opportunity cost, risk, and a reason for your choice; use fictional numbers only.', nextAction: 'present_financial_scenario' },
    },
  };

  return content[track][scaffolding];
}
