export interface Judgement {
  id: string;
  kind: 'source_rule' | 'weighting' | 'avatar_rule' | 'language_rule' | 'custom';
  text: string;
  rejects_kinds: string[];
  active: boolean;
  applied_count: number;
  created_at: string;
}
