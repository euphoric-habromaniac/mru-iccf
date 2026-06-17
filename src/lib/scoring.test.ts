import { describe, it, expect } from 'vitest';
import { 
  scoreLikertSkill, 
  getLevelFromPercentage, 
  scoreRanking, 
  scoreScenarioMcq, 
  calculateAverageScore, 
  calculatePassRate, 
  calculateCompetencyAverages, 
  filterAttemptsByDepartment 
} from './scoring';

describe('Scoring & Analytics Engine Unit Tests', () => {
  describe('Student Aspects - scoreLikertSkill', () => {
    const mockQuestions = [
      { id: 'q1', is_reverse: false },
      { id: 'q2', is_reverse: false },
      { id: 'q3', is_reverse: true },
    ];

    it('calculates maximum positive score correctly', () => {
      const answers = { q1: 5, q2: 5, q3: 1 }; // 1 on reverse is mapped to 5
      const result = scoreLikertSkill(mockQuestions, answers);
      expect(result.raw).toBe(15);
      expect(result.percentage).toBe(100);
      expect(result.level).toBe(5);
    });

    it('calculates minimum score correctly', () => {
      const answers = { q1: 1, q2: 1, q3: 5 }; // 5 on reverse is mapped to 1
      const result = scoreLikertSkill(mockQuestions, answers);
      expect(result.raw).toBe(3);
      expect(result.percentage).toBe(0);
      expect(result.level).toBe(1);
    });
  });

  describe('Student Aspects - getLevelFromPercentage', () => {
    it('maps level thresholds correctly', () => {
      expect(getLevelFromPercentage(85)).toBe(5);
      expect(getLevelFromPercentage(70)).toBe(4);
      expect(getLevelFromPercentage(55)).toBe(3);
      expect(getLevelFromPercentage(40)).toBe(2);
      expect(getLevelFromPercentage(30)).toBe(1);
    });
  });

  describe('Student Aspects - custom scoring handlers', () => {
    it('awards correct points for ordering matches', () => {
      const question = { correct_order: ['a', 'b', 'c'], points: 6 };
      const studentOrder = ['a', 'b', 'c'];
      const score = scoreRanking(question, studentOrder);
      expect(score).toBe(6);

      const partialOrder = ['a', 'c', 'b']; // only 'a' is correct
      const partialScore = scoreRanking(question, partialOrder);
      expect(partialScore).toBe(2);
    });

    it('returns binary score for MCQ matches', () => {
      const question = { correct_answer: 'B', points: 5 };
      expect(scoreScenarioMcq(question, 'B')).toBe(5);
      expect(scoreScenarioMcq(question, 'A')).toBe(0);
    });
  });

  describe('Teacher Aspects - analytics calculations', () => {
    const mockAttempts = [
      { overallScore: 80, certificationStatus: 'Certified', skillScores: { c1: 90, c2: 70 } },
      { overallScore: 60, certificationStatus: 'Certified', skillScores: { c1: 60, c2: 60 } },
      { overallScore: 40, certificationStatus: 'Not Certified', skillScores: { c1: 30, c2: 50 } },
    ];

    it('calculates average score across attempts correctly', () => {
      const avg = calculateAverageScore(mockAttempts);
      expect(avg).toBe(60);
    });

    it('calculates average pass rate correctly', () => {
      const passRate = calculatePassRate(mockAttempts);
      expect(passRate).toBe(66.7); // 2 out of 3 are certified
    });

    it('calculates average score per competency correctly', () => {
      const competencies = [
        { id: 'c1', name: 'Competency 1' },
        { id: 'c2', name: 'Competency 2' },
      ];
      const averages = calculateCompetencyAverages(mockAttempts, competencies);
      expect(averages[0].name).toBe('Competency 1');
      expect(averages[0].average).toBe(60); // (90 + 60 + 30) / 3 = 60
      expect(averages[1].average).toBe(60); // (70 + 60 + 50) / 3 = 60
    });
  });

  describe('Teacher Aspects - department filtering', () => {
    const attempts = [
      { userId: 'u1' },
      { userId: 'u2' },
    ];
    const users = [
      { uid: 'u1', department: 'cse' },
      { uid: 'u2', department: 'ece' },
    ];

    it('filters attempts by selected department', () => {
      const cseAttempts = filterAttemptsByDepartment(attempts, users, 'cse');
      expect(cseAttempts).toHaveLength(1);
      expect(cseAttempts[0].userId).toBe('u1');

      const allAttempts = filterAttemptsByDepartment(attempts, users, 'all');
      expect(allAttempts).toHaveLength(2);
    });
  });
});
