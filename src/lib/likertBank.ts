export interface LikertBankQuestion {
  text: string;
  isReverse: boolean;
}

export interface LikertBankSkill {
  id: string;
  name: string;
  questions: LikertBankQuestion[];
}

export const LIKERT_SCALE_OPTIONS = [
  { value: 1, label: 'Strongly Disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Agree' },
  { value: 5, label: 'Strongly Agree' },
] as const;

export const LIKERT_LEVEL_LABELS: Record<number, string> = {
  5: 'Excellent - Highly Developed',
  4: 'Strong',
  3: 'Developing',
  2: 'Needs Improvement',
  1: 'Critical Intervention Required',
};

export const HUMAN_CENTRIC_LIKERT_SKILLS: LikertBankSkill[] = [
  {
    id: 'hc_communication',
    name: 'Communication',
    questions: [
      { isReverse: false, text: 'I express my ideas clearly and confidently in group discussions.' },
      { isReverse: false, text: 'I listen attentively without interrupting others.' },
      { isReverse: false, text: 'I adapt my communication style based on my audience.' },
      { isReverse: false, text: 'I ask relevant questions to ensure clarity.' },
      { isReverse: false, text: 'I provide constructive feedback respectfully.' },
      { isReverse: true, text: 'I often speak without considering how my words may affect others.' },
      { isReverse: true, text: 'I find it difficult to explain my thoughts in a structured manner.' },
    ],
  },
  {
    id: 'hc_planning_organizing',
    name: 'Planning & Organizing',
    questions: [
      { isReverse: false, text: 'I set clear goals before starting a task.' },
      { isReverse: false, text: 'I prioritize tasks based on urgency and importance.' },
      { isReverse: false, text: 'I create realistic timelines to complete my work.' },
      { isReverse: false, text: 'I break complex tasks into manageable steps.' },
      { isReverse: false, text: 'I regularly review and adjust my plans when required.' },
      { isReverse: true, text: 'I usually start tasks without proper planning.' },
      { isReverse: true, text: 'I frequently miss deadlines due to poor organization.' },
    ],
  },
  {
    id: 'hc_professionalism',
    name: 'Professionalism',
    questions: [
      { isReverse: false, text: 'I maintain punctuality in meetings and commitments.' },
      { isReverse: false, text: 'I demonstrate respectful behavior in professional settings.' },
      { isReverse: false, text: 'I dress and present myself appropriately for work-related situations.' },
      { isReverse: false, text: 'I take responsibility for maintaining workplace decorum.' },
      { isReverse: false, text: 'I communicate formally when required.' },
      { isReverse: true, text: 'I sometimes ignore professional boundaries.' },
      { isReverse: true, text: 'I treat workplace rules casually.' },
    ],
  },
  {
    id: 'hc_resource_management',
    name: 'Resource Management',
    questions: [
      { isReverse: false, text: 'I use available resources efficiently.' },
      { isReverse: false, text: 'I manage my time effectively during projects.' },
      { isReverse: false, text: 'I seek support or tools when needed to improve outcomes.' },
      { isReverse: false, text: 'I avoid wastage of materials and effort.' },
      { isReverse: false, text: 'I allocate tasks based on available resources.' },
      { isReverse: true, text: 'I tend to overuse or misuse available resources.' },
      { isReverse: true, text: 'I rarely track how resources are being utilized.' },
    ],
  },
  {
    id: 'hc_building_trust',
    name: 'Building Trust',
    questions: [
      { isReverse: false, text: 'I keep my promises and commitments.' },
      { isReverse: false, text: 'I maintain confidentiality when required.' },
      { isReverse: false, text: 'I am consistent in my words and actions.' },
      { isReverse: false, text: 'I admit mistakes openly.' },
      { isReverse: false, text: 'Others feel comfortable approaching me.' },
      { isReverse: true, text: 'I withhold important information when it benefits me.' },
      { isReverse: true, text: 'People often doubt my reliability.' },
    ],
  },
  {
    id: 'hc_collaboration_teamwork',
    name: 'Collaboration & Teamwork',
    questions: [
      { isReverse: false, text: 'I contribute actively to team tasks.' },
      { isReverse: false, text: 'I respect diverse viewpoints in a team.' },
      { isReverse: false, text: 'I support team members in achieving shared goals.' },
      { isReverse: false, text: 'I value collective success over individual recognition.' },
      { isReverse: false, text: 'I willingly share knowledge with teammates.' },
      { isReverse: true, text: 'I prefer working alone even when teamwork is required.' },
      { isReverse: true, text: 'I dismiss ideas that differ from mine.' },
    ],
  },
  {
    id: 'hc_conflict_resolution_negotiation',
    name: 'Conflict Resolution & Negotiation',
    questions: [
      { isReverse: false, text: 'I remain calm during disagreements.' },
      { isReverse: false, text: 'I focus on finding solutions rather than assigning blame.' },
      { isReverse: false, text: 'I listen to all sides before forming an opinion.' },
      { isReverse: false, text: 'I aim for win-win outcomes in negotiations.' },
      { isReverse: false, text: 'I address conflicts promptly and respectfully.' },
      { isReverse: true, text: 'I avoid dealing with conflicts hoping they resolve themselves.' },
      { isReverse: true, text: 'I become defensive during disagreements.' },
    ],
  },
  {
    id: 'hc_emotional_intelligence',
    name: 'Emotional Intelligence',
    questions: [
      { isReverse: false, text: 'I am aware of my emotions in different situations.' },
      { isReverse: false, text: 'I manage my emotions effectively under pressure.' },
      { isReverse: false, text: 'I recognize emotional cues in others.' },
      { isReverse: false, text: 'I respond thoughtfully rather than react impulsively.' },
      { isReverse: false, text: 'I reflect on my emotional responses to improve myself.' },
      { isReverse: true, text: 'I struggle to control my emotions when stressed.' },
      { isReverse: true, text: 'I often overlook how others may be feeling.' },
    ],
  },
  {
    id: 'hc_empathy',
    name: 'Empathy',
    questions: [
      { isReverse: false, text: "I try to understand situations from others' perspectives." },
      { isReverse: false, text: 'I show concern when someone is facing difficulties.' },
      { isReverse: false, text: "I validate others' feelings during conversations." },
      { isReverse: false, text: 'I offer support without being judgmental.' },
      { isReverse: false, text: 'I make an effort to understand diverse experiences.' },
      { isReverse: true, text: 'I believe emotions should not influence decisions.' },
      { isReverse: true, text: "I find it difficult to relate to others' struggles." },
    ],
  },
  {
    id: 'hc_inclusion',
    name: 'Inclusion',
    questions: [
      { isReverse: false, text: 'I encourage participation from everyone in a group.' },
      { isReverse: false, text: 'I respect people from different backgrounds.' },
      { isReverse: false, text: 'I challenge biased or discriminatory behavior.' },
      { isReverse: false, text: 'I create a welcoming environment for all.' },
      { isReverse: false, text: 'I value diversity of thought and experience.' },
      { isReverse: true, text: 'I feel more comfortable working only with people similar to me.' },
      { isReverse: true, text: 'I ignore exclusionary behavior if it does not affect me directly.' },
    ],
  },
  {
    id: 'hc_ethics',
    name: 'Ethics',
    questions: [
      { isReverse: false, text: 'I act with integrity even when no one is watching.' },
      { isReverse: false, text: 'I follow rules and guidelines sincerely.' },
      { isReverse: false, text: 'I report unethical practices when necessary.' },
      { isReverse: false, text: 'I make decisions based on fairness and transparency.' },
      { isReverse: false, text: 'I uphold honesty in my communication.' },
      { isReverse: true, text: 'I compromise on ethical standards for personal gain.' },
      { isReverse: true, text: 'I justify minor dishonest actions if they benefit me.' },
    ],
  },
  {
    id: 'hc_accountability',
    name: 'Accountability',
    questions: [
      { isReverse: false, text: 'I take ownership of my actions and outcomes.' },
      { isReverse: false, text: 'I accept feedback without shifting blame.' },
      { isReverse: false, text: 'I fulfill my responsibilities consistently.' },
      { isReverse: false, text: 'I acknowledge mistakes and work to correct them.' },
      { isReverse: false, text: 'I deliver on commitments made to others.' },
      { isReverse: true, text: 'I blame external factors when things go wrong.' },
      { isReverse: true, text: 'I avoid taking responsibility for team failures.' },
    ],
  },
  {
    id: 'hc_lifelong_learning',
    name: 'Lifelong Learning',
    questions: [
      { isReverse: false, text: 'I actively seek opportunities to learn new skills.' },
      { isReverse: false, text: 'I reflect on experiences to improve myself.' },
      { isReverse: false, text: 'I welcome feedback as a learning opportunity.' },
      { isReverse: false, text: 'I stay updated with developments in my field.' },
      { isReverse: false, text: 'I invest time in personal and professional growth.' },
      { isReverse: true, text: 'I believe learning stops after formal education.' },
      { isReverse: true, text: 'I resist changes that require me to learn something new.' },
    ],
  },
  {
    id: 'hc_resilience',
    name: 'Resilience',
    questions: [
      { isReverse: false, text: 'I remain optimistic during setbacks.' },
      { isReverse: false, text: 'I recover quickly from disappointments.' },
      { isReverse: false, text: 'I adapt to changing circumstances effectively.' },
      { isReverse: false, text: 'I view challenges as opportunities to grow.' },
      { isReverse: false, text: 'I persist even when tasks become difficult.' },
      { isReverse: true, text: 'I give up easily when faced with obstacles.' },
      { isReverse: true, text: 'I dwell on failures for a long time.' },
    ],
  },
  {
    id: 'hc_self_management',
    name: 'Self-Management',
    questions: [
      { isReverse: false, text: 'I manage my time effectively.' },
      { isReverse: false, text: 'I maintain focus on important tasks.' },
      { isReverse: false, text: 'I regulate my behavior in professional settings.' },
      { isReverse: false, text: 'I balance personal and professional responsibilities well.' },
      { isReverse: false, text: 'I set personal standards for performance.' },
      { isReverse: true, text: 'I procrastinate on important tasks frequently.' },
      { isReverse: true, text: 'I struggle to control distractions.' },
    ],
  },
];
