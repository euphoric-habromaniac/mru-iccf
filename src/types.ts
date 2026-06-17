export type Role = 'student' | 'dept_head' | 'core_team' | 'system_admin';

export interface User {
  uid: string;
  email: string;
  role: Role;
  department?: string;
  year?: number;
  name?: string;
  rollNumber?: string;
  class?: string;
  major?: string;
  phoneNumber?: string;
  subject?: string;
  password?: string;
  mustResetPassword?: boolean;
}

export interface Department {
  id: string;
  name: string;
  competencyIds: string[];
}

export interface Competency {
  id: string;
  departmentId: string;
  name: string;
  description: string;
  minimumScore: number;
  type?: 'mcq' | 'likert';
  levelThresholds?: {
    level5: number;
    level4: number;
    level3: number;
    level2: number;
  };
}

export type QuestionType = 'mcq' | 'likert' | 'text' | 'scenario_mcq' | 'ranking' | 'text_answer';

export interface Question {
  id: string;
  type?: QuestionType;

  // Legacy/current field names
  competencyId: string;
  text: string;

  // New field names for Likert support
  competency_id?: string;
  question_text?: string;
  is_reverse?: boolean;

  // Optional camelCase alias for runtime convenience
  isReverse?: boolean;

  // New Custom Fields
  scenario?: string;
  items?: string[];
  correct_order?: string[];
  rubric?: string;
  max_points?: number;

  options: string[];
  correctOption: number;
  points?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  createdBy: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

export type AssessmentType = 'mcq' | 'likert';

export interface Assessment {
  id: string;
  name: string;
  departmentId: string;
  competencyDistribution: Record<string, number>; // competencyId -> number of questions
  timeLimit: number; // in minutes
  active: boolean;
  minScore: number;
  scheduledAt?: string;
  assessmentType?: AssessmentType;
  assessment_type?: AssessmentType;
  competencyIds?: string[];
  questionIds?: string[];
}

export interface SkillScore {
  raw: number;
  percentage: number;
  level: number;
  label?: string;
}

export interface CompositeScore {
  raw: number;
  percentage: number;
  level: number;
  label?: string;
}

export interface Attempt {
  id: string;
  userId: string;
  assessmentId: string;
  startTime: string;
  endTime?: string;
  ipAddress: string;
  deviceMetadata: string;
  answers: any; 
  skillScores: Record<string, number | SkillScore>; 
  skill_scores?: Record<string, SkillScore>;
  compositeScore?: CompositeScore;
  composite_score?: CompositeScore;
  assessmentType?: AssessmentType;
  assessment_type?: AssessmentType;
  overallScore: number;
  certificationStatus: string;
  certification_status?: string;
  timestamp: string;

  // Exact fields requested by user:
  student_id?: string;
  student_email?: string;
  assessment_title?: string;
  submitted_at?: string;
  raw_score?: number;
  skill_percentage?: number;
  level?: number;
  level_descriptor?: string;
  duration?: string;
}

export interface Certification {
  id: string;
  studentId: string;
  departmentId: string;
  overallScore: number;
  competencyScores: Record<string, number>;
  issuedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  metadata: Record<string, any>;
}
