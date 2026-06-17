import { LIKERT_LEVEL_LABELS } from './likertBank';

export interface LikertSkillScore {
  raw: number;
  percentage: number;
  level: number;
  label: string;
}

export interface LikertCompositeScore {
  raw: number;
  percentage: number;
  level: number;
  label: string;
}

export function getLevelFromPercentage(percentage: number): number {
  if (percentage >= 85) return 5;
  if (percentage >= 70) return 4;
  if (percentage >= 55) return 3;
  if (percentage >= 40) return 2;
  return 1;
}

export function getLevelLabel(level: number): string {
  return LIKERT_LEVEL_LABELS[level] || LIKERT_LEVEL_LABELS[1];
}

export function scoreLikertSkill(
  questions: Array<{ id?: string; is_reverse?: boolean; isReverse?: boolean; selected_value?: number }>,
  answers: Record<string, number> = {}
): LikertSkillScore {
  let raw = 0;

  questions.forEach((question, index) => {
    // If the question has selected_value populated (from new schema), use it, else fallback
    const selected = question.selected_value !== undefined ? question.selected_value : (question.id ? answers[question.id] : 0);
    const bounded = Math.max(1, Math.min(5, Number(selected || 1)));
    const reverse = Boolean(question.is_reverse ?? question.isReverse);
    raw += reverse ? 6 - bounded : bounded;
  });

  const percentage = Number((((raw - (questions.length * 1)) / (questions.length * 4)) * 100).toFixed(2));
  const level = getLevelFromPercentage(percentage);

  return {
    raw,
    percentage,
    level,
    label: getLevelLabel(level),
  };
}

export function scoreLikertAssessment(
  competencyIdsInOrder: string[],
  questions: Array<{ id?: string; competencyId?: string; competency_id?: string; is_reverse?: boolean; isReverse?: boolean }>,
  answers: Record<string, number> = {}
) {
  const skillScores: Record<string, LikertSkillScore> = {};

  competencyIdsInOrder.forEach((competencyId) => {
    const skillQuestions = questions.filter((q) => (q.competencyId ?? q.competency_id) === competencyId);
    if (skillQuestions.length > 0) {
      skillScores[competencyId] = scoreLikertSkill(skillQuestions, answers);
    }
  });

  // Calculate composite manually across all skills
  const skillValues = Object.values(skillScores);
  const totalRaw = skillValues.reduce((acc, score) => acc + score.raw, 0);
  const minRaw = questions.length * 1;
  const maxRaw = questions.length * 5;
  const percentage = Number((((totalRaw - minRaw) / (maxRaw - minRaw || 1)) * 100).toFixed(2));
  const level = getLevelFromPercentage(percentage);

  const composite = {
    raw: totalRaw,
    percentage,
    level,
    label: getLevelLabel(level),
  };

  return {
    skillScores,
    composite,
    certificationStatus: composite.percentage >= 55.00 ? 'Certified' : 'Not Certified',
  };
}

// Custom Assessment Scoring Handlers
export function scoreScenarioMcq(question: any, studentAnswer: string): number {
  return studentAnswer === question.correct_answer ? (question.points || 1) : 0;
}

export function scoreRanking(question: any, studentOrder: string[]): number {
  if (!question.correct_order || !Array.isArray(question.correct_order)) return 0;
  if (!studentOrder || !Array.isArray(studentOrder)) return 0;

  const totalPoints = question.points || 1;
  const itemsCount = question.correct_order.length;
  if (itemsCount === 0) return 0;

  let correctPositions = 0;
  for (let i = 0; i < itemsCount; i++) {
    if (studentOrder[i] === question.correct_order[i]) {
      correctPositions++;
    }
  }
  
  const score = (totalPoints / itemsCount) * correctPositions;
  return Number(score.toFixed(2));
}

// Note: text_answer scoring relies on aiService.ts and is typically invoked during the submission flow.

// --- Teacher/Analytics Helpers ---
export function calculateAverageScore(attempts: Array<{ overallScore: number }>): number {
  if (attempts.length === 0) return 0;
  const total = attempts.reduce((acc, curr) => acc + curr.overallScore, 0);
  return Number((total / attempts.length).toFixed(1));
}

export function calculatePassRate(attempts: Array<{ certificationStatus?: string; certification_status?: string }>): number {
  if (attempts.length === 0) return 0;
  const certifiedCount = attempts.filter(att => {
    const status = att.certificationStatus || att.certification_status || '';
    return status.toLowerCase() === 'certified';
  }).length;
  return Number(((certifiedCount / attempts.length) * 100).toFixed(1));
}

export function calculateCompetencyAverages(
  attempts: Array<{ skillScores?: Record<string, any>; skill_scores?: Record<string, any> }>,
  competencies: Array<{ id: string; name: string }>
) {
  return competencies.map(comp => {
    let total = 0;
    let count = 0;

    attempts.forEach(att => {
      const scores = att.skillScores || att.skill_scores;
      if (scores && scores[comp.id] !== undefined) {
        const val = scores[comp.id];
        // Handle if score is a raw number or complex SkillScore object
        const scoreVal = typeof val === 'number' ? val : (val && typeof (val as any) === 'object' && 'percentage' in (val as any) ? (val as any).percentage : 0);
        total += scoreVal;
        count++;
      }
    });

    return {
      name: comp.name,
      average: count > 0 ? Number((total / count).toFixed(1)) : 0
    };
  });
}

export function filterAttemptsByDepartment(
  attempts: Array<{ userId: string }>,
  users: Array<{ uid: string; department?: string }>,
  departmentId: string
) {
  if (!departmentId || departmentId.toLowerCase() === 'all') return attempts;
  return attempts.filter(att => {
    const userProfile = users.find(u => u.uid === att.userId);
    return userProfile?.department?.toLowerCase() === departmentId.toLowerCase();
  });
}
