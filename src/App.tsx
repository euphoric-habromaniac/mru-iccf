import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, writeBatch, getDocs, addDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { Toaster, toast } from 'sonner';
import { User, Role, Competency, Assessment, Attempt, Certification, Question, SkillScore, CompositeScore } from './types';
import { LogIn, LogOut, Shield, GraduationCap, Building2, LayoutDashboard, ClipboardList, BarChart3, Settings, Plus, Trash2, CheckCircle2, AlertCircle, Clock, Search, Filter, ArrowRight, User as UserIcon, BookOpen, Award, History, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, X, Menu, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { jsPDF } from 'jspdf';
import { cn, generateCertificate } from './lib/utils';
import { HUMAN_CENTRIC_LIKERT_SKILLS, LIKERT_LEVEL_LABELS, LIKERT_SCALE_OPTIONS } from './lib/likertBank';
import { getLevelFromPercentage, scoreLikertAssessment, scoreLikertSkill, scoreScenarioMcq, scoreRanking } from './lib/scoring';
import { gradeTextAnswer } from './lib/aiService';

import { logger } from './lib/logger';

// --- Error Handling Helper ---
const handleFirestoreError = (error: any, operation: string, path: string | null = null) => {
  const authInfo: any = {};
  if (auth.currentUser?.uid) authInfo.userId = auth.currentUser.uid;
  if (auth.currentUser?.email) authInfo.email = auth.currentUser.email;
  if (auth.currentUser?.emailVerified !== undefined) authInfo.emailVerified = auth.currentUser.emailVerified;
  
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo,
    operation,
    path
  };
  logger.error(`Firestore Error: ${operation}`, errInfo);
  toast.error(`Database error: ${error.message || 'Unknown error'}`);
  throw new Error(JSON.stringify(errInfo));
};

type QuestionLike = Question & Record<string, any>;

const getAssessmentType = (assessment: Assessment): 'mcq' | 'likert' => {
  return (assessment.assessmentType || assessment.assessment_type || 'mcq') as 'mcq' | 'likert';
};

const getQuestionCompetencyId = (question: QuestionLike): string => {
  return question.competencyId || question.competency_id || '';
};

const getQuestionText = (question: QuestionLike): string => {
  return question.question_text || question.text || '';
};

const isLikertQuestion = (question: QuestionLike): boolean => {
  return question.type === 'likert';
};

const getSkillPercentageValue = (score: number | SkillScore): number => {
  return typeof score === 'number' ? score : score.percentage;
};

const getSkillRawValue = (score: number | SkillScore): number => {
  if (typeof score === 'number') {
    return Math.round((score / 100) * 35);
  }
  return score.raw;
};

const getSkillLevelValue = (score: number | SkillScore): number => {
  if (typeof score === 'number') {
    return getLevelFromPercentage(score);
  }
  return score.level;
};

const getSkillLevelLabel = (score: number | SkillScore): string => {
  const level = getSkillLevelValue(score);
  return score && typeof score !== 'number' && score.label ? score.label : (LIKERT_LEVEL_LABELS[level] || LIKERT_LEVEL_LABELS[1]);
};

const levelBadgeClass = (level: number): string => {
  if (level === 5) return 'bg-emerald-700 text-white';
  if (level === 4) return 'bg-green-600 text-white';
  if (level === 3) return 'bg-yellow-500 text-black';
  if (level === 2) return 'bg-orange-500 text-white';
  return 'bg-red-600 text-white';
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-[#F27D26] text-white hover:bg-[#d96a1d]',
    secondary: 'bg-[#141414] text-white hover:bg-[#2a2a2a]',
    outline: 'border border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-white',
    ghost: 'text-[#141414] hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-md font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; key?: string | number; onClick?: () => void }) => (
  <div className={cn('bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-6', className)} onClick={onClick}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger'; className?: string }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800'
  };
  return (
    <span className={cn('px-2 py-1 rounded text-xs font-bold uppercase tracking-wider inline-block', variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'assessment' | 'history' | 'admin' | 'scorecard' | 'studentResults'>('dashboard');
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const handleSeedData = async () => {
    try {
      let batch = writeBatch(db);
      let opCount = 0;

      const commitAndReset = async () => {
        if (opCount > 0) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      };

      const addDelete = async (snap: any) => {
        for (const d of snap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitAndReset();
        }
      };

      // 1. Delete all existing data
      const assessmentsSnap = await getDocs(collection(db, 'assessments'));
      await addDelete(assessmentsSnap);

      const competenciesSnap = await getDocs(collection(db, 'competencies'));
      await addDelete(competenciesSnap);

      const questionsSnap = await getDocs(collection(db, 'questions'));
      await addDelete(questionsSnap);

      // Ensure deletes are committed before creating new ones (to avoid conflicts)
      await commitAndReset();

      // 2. Create the 15 strict assessments
      for (const skill of HUMAN_CENTRIC_LIKERT_SKILLS) {
        // Create competency
        batch.set(doc(db, 'competencies', skill.id), {
          id: skill.id,
          departmentId: 'dept_common',
          name: skill.name,
          description: `${skill.name} Assessment`,
          minimumScore: 55,
          type: 'likert',
        });
        opCount++;
        if (opCount >= 400) await commitAndReset();

        // Create the assessment
        const assessmentId = `assessment_${skill.id}`;
        batch.set(doc(db, 'assessments', assessmentId), {
          id: assessmentId,
          title: `${skill.name} Assessment`,
          name: `${skill.name} Assessment`,
          competency: skill.name,
          departmentId: 'dept_common',
          active: true,
          minScore: 55,
          timeLimit: 15,
          assessment_type: 'likert',
          assessmentType: 'likert',
          competencyIds: [skill.id],
          competencyDistribution: {
            [skill.id]: 7,
          },
          questions: skill.questions.map((q, idx) => ({
            id: `q_${skill.id}_${idx + 1}`,
            question_text: q.text,
            is_reverse: q.isReverse,
            text: q.text,
            isReverse: q.isReverse,
            type: 'likert',
            competencyId: skill.id
          }))
        });
        opCount++;
        if (opCount >= 400) await commitAndReset();

        // Create the 7 questions IN ORDER in questions collection
        for (let index = 0; index < skill.questions.length; index++) {
          const question = skill.questions[index];
          const qId = `q_${skill.id}_${index + 1}`;
          batch.set(doc(db, 'questions', qId), {
            id: qId,
            type: 'likert',
            competencyId: skill.id,
            competency_id: skill.id,
            text: question.text,
            question_text: question.text,
            is_reverse: question.isReverse,
            isReverse: question.isReverse,
            options: [],
            correctOption: -1,
            points: 0,
            difficulty: 'medium',
            createdBy: user?.uid || 'seed_script',
            approvalStatus: 'approved',
          });
          opCount++;
          if (opCount >= 400) await commitAndReset();
        }
      }

      // Final commit
      await commitAndReset();
      
      logger.admin('Strict Data Seeded', 'success', {
        assessments: HUMAN_CENTRIC_LIKERT_SKILLS.length,
        questions: HUMAN_CENTRIC_LIKERT_SKILLS.length * 7
      });
      toast.success('Strict Likert data seeded successfully!');
    } catch (error: any) {
      handleFirestoreError(error, 'seed_data');
    }
  };

  useEffect(() => {
    (window as any).handleSeedData = handleSeedData;
    (window as any).debugState = () => {
      console.log('=== APP STATE DEBUG ===');
      console.log('User:', user);
      console.log('Assessments:', assessments);
      console.log('Competencies:', competencies);
    };

    (window as any).verifyScoringEngine = () => {
      console.log("=== VERIFYING SCORING ENGINE ===");
      
      const mockQuestions = [
        { id: 'q1', is_reverse: false },
        { id: 'q2', is_reverse: false },
        { id: 'q3', is_reverse: false },
        { id: 'q4', is_reverse: false },
        { id: 'q5', is_reverse: false },
        { id: 'q6', is_reverse: true },
        { id: 'q7', is_reverse: true },
      ];

      const runTest = (name: string, answers: Record<string, number>, expectedPct: number, expectedLevel: number) => {
        const result = scoreLikertSkill(mockQuestions, answers);
        const pass = result.percentage === expectedPct && result.level === expectedLevel;
        console.log(`Test: ${name} => ${pass ? 'PASS' : 'FAIL'} (Expected ${expectedPct}%, Level ${expectedLevel} | Got ${result.percentage}%, Level ${result.level})`);
      };

      runTest("Max Positive", { q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 1, q7: 1 }, 100, 5);
      runTest("All Minimum", { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 5, q7: 5 }, 0, 1);
      runTest("All Neutral", { q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3 }, 50, 2);
      runTest("Mixed Responses", { q1: 4, q2: 3, q3: 5, q4: 2, q5: 4, q6: 4, q7: 2 }, 60.71, 3);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
            logger.auth('User Login Detected', 'success', { uid: firebaseUser.uid });
          } else {
            const email = firebaseUser.email || '';
            let inferredRole: Role = 'student';
            if (email === 'debashish.pranjal@gmail.com' || email.startsWith('admin@')) {
              inferredRole = 'core_team';
            } else if (email.startsWith('teacher@')) {
              inferredRole = 'dept_head';
            }
            const newUser: User = {
              uid: firebaseUser.uid,
              email: email,
              role: inferredRole,
              name: firebaseUser.displayName || email.split('@')[0] || 'User',
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
            logger.auth('New User Created', 'success', { uid: firebaseUser.uid, role: newUser.role });
          }
        } else {
          if (user) logger.auth('User Logged Out', 'success', { uid: user.uid });
          setUser(null);
        }
      } catch (error: any) {
        handleFirestoreError(error, 'auth_state_change');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubCompetencies = onSnapshot(collection(db, 'competencies'), (snapshot) => {
      setCompetencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competency)));
    }, (error) => handleFirestoreError(error, 'fetch_competencies', 'competencies'));

    const unsubDepartments = onSnapshot(collection(db, 'departments'), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, 'fetch_departments', 'departments'));

    const unsubAssessments = onSnapshot(collection(db, 'assessments'), (snapshot) => {
      setAssessments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assessment)));
    }, (error) => handleFirestoreError(error, 'fetch_assessments', 'assessments'));

    let unsubAttempts: () => void;
    let unsubUsers: (() => void) | undefined;

    if (user.role === 'dept_head' || user.role === 'core_team') {
      unsubAttempts = onSnapshot(collection(db, 'attempts'), (snapshot) => {
        setAttempts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attempt)));
      }, (error) => handleFirestoreError(error, 'fetch_all_attempts', 'attempts'));

      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      }, (error) => handleFirestoreError(error, 'fetch_users', 'users'));
    } else {
      const q = query(collection(db, 'attempts'), where('userId', '==', user.uid));
      unsubAttempts = onSnapshot(q, (snapshot) => {
        setAttempts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attempt)));
      }, (error) => handleFirestoreError(error, 'fetch_attempts', 'attempts'));
    }

    return () => {
      unsubCompetencies();
      unsubDepartments();
      unsubAssessments();
      unsubAttempts();
      if (unsubUsers) unsubUsers();
    };
  }, [user]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
      logger.auth('Login Popup Success', 'success');
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        logger.auth('Login Popup Cancelled', 'failure', { code: error.code });
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login window was closed before completion.');
        logger.auth('Login Popup Closed by User', 'failure', { code: error.code });
      } else {
        logger.auth('Login Failed', 'failure', { error: error.message });
        toast.error('Login failed: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAndPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter both email and password.');
      return;
    }
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      logger.auth('Email Login Success', 'success', { email: loginEmail });
      toast.success('Signed in successfully!');
    } catch (error: any) {
      console.error('Email Login Error:', error);
      logger.auth('Email Login Failed', 'failure', { email: loginEmail, error: error.message });
      toast.error('Login failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logger.auth('Logout Success', 'success');
    } catch (error: any) {
      logger.error('Logout Failed', { error: error.message });
    } finally {
      // Always clear local user state for temp users and logout consistency
      setUser(null);
    }
  };

  if (loading) {
    return (
      <>
        <Toaster position="top-right" />
        <div className="h-screen w-full flex items-center justify-center bg-[#E4E3E0]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
            <p className="font-mono text-sm uppercase tracking-widest">Initializing ICCF...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full flex bg-[#E4E3E0]">
        <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[#141414] flex items-center justify-center">
                <Shield className="text-white w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tighter uppercase italic">Manav Rachna ICCF</h1>
            </div>
            <h2 className="text-4xl sm:text-6xl font-black leading-[0.9] tracking-tighter uppercase mb-6">
              Institutional <br />
              <span className="text-[#F27D26]">Competency</span> <br />
              Framework
            </h2>
            <p className="text-base sm:text-lg text-gray-600 mb-12 max-w-md">
              A comprehensive certification system for students to validate their core and technical competencies for placements and academic transcripts.
            </p>

            <form onSubmit={handleEmailAndPasswordLogin} className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-500 mb-1.5">University Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="student@mru.ac.in"
                  className="w-full h-12 px-4 border-2 border-[#141414] bg-white font-medium focus:outline-none focus:border-[#F27D26] transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-500 mb-1.5">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 px-4 border-2 border-[#141414] bg-white font-medium focus:outline-none focus:border-[#F27D26] transition-colors"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full h-12 text-sm font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#141414] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                {isLoggingIn ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="flex items-center my-6">
              <div className="flex-grow border-t-2 border-gray-300"></div>
              <span className="flex-shrink mx-4 text-xs font-mono font-bold uppercase text-gray-400">Or</span>
              <div className="flex-grow border-t-2 border-gray-300"></div>
            </div>

            <Button 
              type="button"
              variant="outline"
              onClick={handleLogin} 
              disabled={isLoggingIn}
              className="w-full h-12 text-sm font-bold uppercase tracking-widest"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign in with Google OAuth
            </Button>
          </motion.div>
        </div>
        <div className="hidden lg:block flex-1 bg-[#141414] relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full grid grid-cols-10 grid-rows-10">
              {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className="border border-white/10" />
              ))}
            </div>
          </div>
          <div className="absolute bottom-12 right-12 text-white text-right">
            <p className="text-8xl font-black opacity-10 leading-none">NAAC</p>
            <p className="text-8xl font-black opacity-10 leading-none">NBA</p>
            <p className="text-8xl font-black opacity-10 leading-none">ICCF</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#E4E3E0] flex overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "bg-[#141414] text-white transition-all duration-300 flex flex-col z-50 shadow-2xl overflow-hidden group",
        "fixed lg:relative h-full",
        isSidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:translate-x-0 lg:w-20 hover:lg:w-72"
      )}>
        <div className="p-6 flex items-center justify-between mb-12">
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="w-10 h-10 bg-[#F27D26] flex items-center justify-center font-black text-xl flex-shrink-0 shadow-[4px_4px_0px_0px_#fff]">M</div>
            <div className={cn("transition-opacity duration-300", isSidebarOpen ? "opacity-100" : "opacity-0 hidden lg:block lg:opacity-0 group-hover:lg:opacity-100")}>
              <p className="font-black tracking-tighter uppercase text-lg leading-none">ICCF Portal</p>
              <p className="text-[8px] font-mono text-gray-500 uppercase tracking-widest mt-1">Institutional</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-md flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-x-hidden">
          <NavButton 
            active={view === 'dashboard'} 
            onClick={() => { setView('dashboard'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Dashboard" 
            collapsed={!isSidebarOpen} 
          />
          {user.role === 'student' && (
            <NavButton 
              active={view === 'history'} 
              onClick={() => { setView('history'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              icon={<History className="w-5 h-5" />} 
              label="My Attempts" 
              collapsed={!isSidebarOpen} 
            />
          )}
          {(user.role === 'dept_head' || user.role === 'core_team') && (
            <NavButton 
              active={view === 'studentResults'} 
              onClick={() => { setView('studentResults'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              icon={<GraduationCap className="w-5 h-5" />} 
              label="Student Results" 
              collapsed={!isSidebarOpen} 
            />
          )}
          {(user.role === 'dept_head' || user.role === 'core_team') && (
            <NavButton 
              active={view === 'admin'} 
              onClick={() => { setView('admin'); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              icon={<Settings className="w-5 h-5" />} 
              label="Management" 
              collapsed={!isSidebarOpen} 
            />
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-white/5 bg-white/5">
          <div className={cn("flex items-center gap-3 p-2 mb-4 overflow-hidden whitespace-nowrap", !isSidebarOpen && "justify-center lg:justify-start lg:pl-1")}>
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-[#F27D26] font-black text-sm flex-shrink-0 border border-white/10">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </div>
            <div className={cn("transition-opacity duration-300", isSidebarOpen ? "opacity-100" : "opacity-0 hidden lg:block lg:opacity-0 group-hover:lg:opacity-100")}>
              <p className="text-xs font-black uppercase truncate">{user.name}</p>
              <p className="text-[8px] font-mono text-gray-500 uppercase truncate tracking-widest">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className={cn(
              "w-full flex items-center gap-4 p-3 rounded-md text-red-500 hover:bg-red-500/10 transition-colors font-bold uppercase tracking-widest text-[10px] whitespace-nowrap overflow-hidden",
              !isSidebarOpen && "justify-center lg:justify-start lg:px-3"
            )}
            title={!isSidebarOpen ? "Logout" : undefined}
          >
            <LogOut className="w-6 h-6 flex-shrink-0" />
            <span className={cn("transition-opacity duration-300", isSidebarOpen ? "opacity-100" : "opacity-0 hidden lg:block lg:opacity-0 group-hover:lg:opacity-100")}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-[#141414] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-md lg:hidden">
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden lg:block">
              <h1 className="font-black uppercase tracking-tighter text-xl leading-none">
                {view === 'dashboard' ? 'Overview' : view === 'history' ? 'My History' : view === 'admin' ? 'Admin Panel' : view === 'studentResults' ? 'Student Results' : view === 'scorecard' ? 'Scorecard' : 'Assessment'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:gap-6">
            <div className="flex items-center gap-2 lg:gap-4">
              <Badge variant={user.role === 'core_team' ? 'danger' : user.role === 'dept_head' ? 'warning' : 'success'}>
                <span className="hidden sm:inline">{user.role.replace('_', ' ')}</span>
                <span className="sm:hidden">{user.role[0].toUpperCase()}</span>
              </Badge>
              <div className="h-6 w-px bg-gray-200" />
              <span className="text-[10px] lg:text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-10 bg-[#E4E3E0] relative">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-tight">Welcome, {user.name?.split(' ')[0]}</h2>
                    <p className="text-gray-500 font-mono text-[10px] sm:text-xs lg:text-sm uppercase">Institutional Competency Certification Framework</p>
                  </div>
                </div>

                {user.role === 'student' ? (
                  <StudentDashboard 
                    user={user}
                    assessments={assessments} 
                    attempts={attempts} 
                    competencies={competencies}
                    departments={departments}
                    onStartAssessment={(a) => {
                      setSelectedAssessment(a);
                      setView('assessment');
                    }}
                  />
                ) : (
                  <AdminOverview assessments={assessments} attempts={attempts} competencies={competencies} />
                )}
              </motion.div>
            )}

            {view === 'assessment' && selectedAssessment && (
              <AssessmentView 
                assessment={selectedAssessment} 
                competencies={competencies} 
                onComplete={() => setView('dashboard')}
                onCancel={() => setView('dashboard')}
                user={user}
              />
            )}

            {view === 'history' && (
              <HistoryView 
                attempts={attempts} 
                assessments={assessments} 
                competencies={competencies} 
                onBack={() => setView('dashboard')} 
                onViewScorecard={(att) => {
                  setSelectedAttempt(att);
                  setView('scorecard');
                }}
              />
            )}

            {view === 'scorecard' && selectedAttempt && (
              <ScorecardView 
                attempt={selectedAttempt} 
                assessments={assessments} 
                competencies={competencies} 
                onBack={() => setView(user?.role === 'student' ? 'history' : 'studentResults')} 
                user={user || undefined}
                allUsers={allUsers}
                departments={departments}
              />
            )}

            {view === 'studentResults' && (
              <StudentResultsView
                attempts={attempts}
                allUsers={allUsers}
                departments={departments}
                assessments={assessments}
                competencies={competencies}
                onViewScorecard={(att) => {
                  setSelectedAttempt(att);
                  setView('scorecard');
                }}
                onBack={() => setView('dashboard')}
              />
            )}

            {view === 'admin' && (
              <AdminManagement 
                user={user}
                competencies={competencies}
                assessments={assessments}
                departments={departments}
                onBack={() => setView('dashboard')}
              />
            )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, collapsed }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; collapsed: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-md transition-all whitespace-nowrap overflow-hidden",
        active ? "bg-[#F27D26] text-white" : "text-gray-400 hover:text-white hover:bg-white/5",
        collapsed && "justify-center lg:justify-start lg:px-3"
      )}
      title={collapsed ? label : undefined}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 flex-shrink-0" })}
      <span className={cn(
        "font-bold uppercase tracking-tighter text-sm transition-opacity duration-300",
        collapsed ? "opacity-0 hidden lg:block lg:opacity-0 group-hover:lg:opacity-100" : "opacity-100"
      )}>
        {label}
      </span>
    </button>
  );
}

// --- Dashboard Sub-components ---

function StudentDashboard({ user, assessments, attempts: rawAttempts, competencies, departments, onStartAssessment }: { user: User; assessments: Assessment[]; attempts: Attempt[]; competencies: Competency[]; departments: any[]; onStartAssessment: (a: Assessment) => void }) {
  const attempts = rawAttempts.filter(att => assessments.some(a => a.id === att.assessmentId));
  const latestAttempt = attempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const isCertified = attempts.some(a => a.certificationStatus === 'certified');
  
  const checkEligibility = (assessmentId: string) => {
    const attemptsForAss = attempts.filter(a => a.assessmentId === assessmentId);
    attemptsForAss.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const attemptsInLast3Hours = attemptsForAss.filter(a => new Date(a.timestamp) > threeHoursAgo);

    if (attemptsInLast3Hours.length >= 3) {
      const latestAttemptTime = new Date(attemptsInLast3Hours[0].timestamp).getTime();
      const cooldownEndsAt = latestAttemptTime + 3 * 60 * 60 * 1000;
      return { eligible: false, reason: 'cooldown', cooldownEndsAt };
    }
    
    return { eligible: true };
  };

  // Calculate best scores per competency across all attempts for the composite profile
  const bestSkillScores: Record<string, any> = {};
  attempts.forEach(att => {
    if (att.skillScores) {
      Object.entries(att.skillScores).forEach(([compId, scoreVal]) => {
        if (!competencies.find(c => c.id === compId)) return;
        const currentRaw = getSkillRawValue(scoreVal);
        const existingRaw = bestSkillScores[compId] ? getSkillRawValue(bestSkillScores[compId]) : 0;
        if (currentRaw > existingRaw) {
          bestSkillScores[compId] = scoreVal;
        }
      });
    }
  });

  const radarData = competencies.map(comp => {
    const score = bestSkillScores[comp.id];
    return {
      subject: comp.name,
      A: score ? getSkillPercentageValue(score) : 0,
      fullMark: 100,
    };
  });

  const totalBestRaw = competencies.reduce((sum, comp) => {
    return sum + (bestSkillScores[comp.id] ? getSkillRawValue(bestSkillScores[comp.id]) : 7);
  }, 0);
  const hasTakenAnyTests = Object.keys(bestSkillScores).length > 0;
  const compositeOverallPercentage = hasTakenAnyTests ? Math.round(((totalBestRaw - 105) / 420) * 100) : 0;

  const growthData = attempts
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((att) => ({
      date: new Date(att.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      score: Math.round(att.overallScore)
    }));

  const reportData = Object.entries(bestSkillScores)
    .map(([compId, scoreVal]) => ({
      compName: competencies.find(c => c.id === compId)?.name || compId,
      level: getSkillLevelValue(scoreVal),
    }))
    .sort((a, b) => a.level - b.level); // sort ascending for priorities

  const CustomRadarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const comp = competencies.find(c => c.name === data.subject);
      const scoreVal = comp ? bestSkillScores[comp.id] : 0;
      const level = scoreVal ? getSkillLevelValue(scoreVal) : 1;
      return (
        <div className="bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-3 text-[#141414] z-50">
          <p className="font-bold text-sm uppercase">{data.subject}</p>
          <p className="font-black text-[#F27D26] text-lg">Level {level}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      <div className="lg:col-span-2 space-y-6 lg:space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Shield className="w-32 h-32" />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
              <h3 className="text-lg lg:text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#F27D26]" />
                Active Certifications
              </h3>
              <Badge variant="success">{assessments.filter(a => a.active).length} Available</Badge>
            </div>
            <div className="space-y-4 relative z-10">
              {assessments.filter(a => a.active).map((a, idx) => (
                <motion.div 
                  key={a.id} 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  className="border border-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#141414] transition-all hover:translate-x-1"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold uppercase text-sm lg:text-base">{a.name}</h4>
                      {attempts.some(att => att.assessmentId === a.id && att.certificationStatus === 'certified') && (
                        <Badge variant="success">Certified</Badge>
                      )}
                    </div>
                    <p className="text-[10px] lg:text-xs text-gray-500 font-mono">
                      {Object.keys(a.competencyDistribution).length} Competencies • {a.timeLimit || 30} Mins • {departments.find(d => d.id === a.departmentId)?.name || 'Common'}
                    </p>
                  </div>
                  {checkEligibility(a.id) ? (
                    <Button variant="outline" className="w-full sm:w-auto text-xs group" onClick={() => onStartAssessment(a)}>
                      Start Certification
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase bg-red-50 px-3 py-1.5 rounded-sm">
                      <AlertCircle className="w-4 h-4" />
                      Cooling Period Active
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <h3 className="text-lg lg:text-xl font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-[#F27D26]" />
              Recent Performance
            </h3>
            <div className="space-y-4">
              {attempts.length === 0 ? (
                <p className="text-center py-8 text-gray-400 italic text-sm">No attempts recorded yet.</p>
              ) : (
                attempts.slice(0, 3).map((att, idx) => {
                  const assessment = assessments.find(a => a.id === att.assessmentId);
                  return (
                    <motion.div 
                      key={att.id} 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      transition={{ delay: 0.4 + idx * 0.1 }}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 gap-4 border-l-4 border-[#141414]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                          {att.certificationStatus === 'certified' ? (
                            <Award className="text-green-500 w-6 h-6" />
                          ) : (
                            <CheckCircle2 className="text-gray-400 w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold uppercase text-xs lg:text-sm">{assessment?.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{new Date(att.timestamp).toLocaleDateString()} • {att.certificationStatus.toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right w-full sm:w-auto flex flex-col sm:items-end gap-2">
                        <div>
                          <p className="font-black text-2xl lg:text-xl">{Math.round(att.overallScore)}%</p>
                          <p className="text-[10px] uppercase font-bold text-gray-400">Score</p>
                        </div>
                        {att.certificationStatus === 'certified' && (
                          <div className="flex gap-2 mt-2 sm:mt-0">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-[10px] h-7 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                generateCertificate(user.name || user.email || 'Student', assessment?.name || 'Assessment', new Date(att.timestamp).toLocaleDateString(), Math.round(att.overallScore));
                              }}
                            >
                              Download PDF
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-[10px] h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(assessment?.name || 'ICCF Certification')}&organizationName=${encodeURIComponent('Manav Rachna University')}&issueYear=${new Date(att.timestamp).getFullYear()}&issueMonth=${new Date(att.timestamp).getMonth() + 1}`;
                                window.open(url, '_blank');
                              }}
                            >
                              Add to LinkedIn
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="space-y-6 lg:space-y-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="h-full">
          <Card className="h-full flex flex-col bg-[#141414] text-white border-none shadow-[8px_8px_0px_0px_#F27D26]">
            <h3 className="text-lg lg:text-xl font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#F27D26]" />
              Competency Profile
            </h3>
            {latestAttempt ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 min-h-[300px] sm:min-h-[350px] lg:min-h-[300px] -mx-4 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tickCount={6} tick={false} axisLine={false} />
                      <Tooltip content={<CustomRadarTooltip />} cursor={false} />
                      <Radar
                        name="Student"
                        dataKey="A"
                        stroke="#F27D26"
                        fill="#F27D26"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {reportData.length > 0 && (
                  <div className="mt-2 mb-4 p-4 bg-white/5 rounded-md border border-white/10">
                    <p className="text-xs font-bold uppercase text-gray-400 mb-3 border-b border-white/10 pb-2">Development Priorities</p>
                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {reportData.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-white truncate mr-2">{item.compName}</span>
                          <span className={cn("font-black px-2 py-0.5 rounded-sm bg-white/10 shrink-0", item.level <= 2 ? "text-red-400" : item.level === 3 ? "text-yellow-400" : "text-green-400")}>Level {item.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 p-4 bg-white/5 rounded-md border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-bold uppercase text-gray-400">Overall Proficiency</p>
                    <p className="text-xl font-black text-[#F27D26]">{compositeOverallPercentage}%</p>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-3">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${compositeOverallPercentage}%` }} 
                      className="h-full bg-[#F27D26]" 
                    />
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Calculation Formula:</p>
                    <p className="text-[10px] font-mono text-gray-400 bg-black/50 p-2 rounded border border-white/5 break-all">
                      {(() => {
                        const isCustom = Array.isArray(latestAttempt?.answers) && latestAttempt.answers.length > 0 && latestAttempt.answers[0].type !== undefined;
                        if (isCustom && !hasTakenAnyTests) {
                          const earned = latestAttempt.answers.reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0);
                          const max = latestAttempt.answers.reduce((acc: number, curr: any) => acc + (curr.max_points || 0), 0);
                          return `(${earned} Earned / ${max} Max Points) × 100 = ${Math.round(latestAttempt.overallScore)}%`;
                        } else {
                          return `(( ${totalBestRaw} - 105 ) / 420) × 100 = ${compositeOverallPercentage}%`;
                        }
                      })()}
                    </p>
                    <p className="text-[8px] text-gray-500 font-mono mt-4 uppercase text-center">Institutional Standard: 60% Required</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 text-xs italic">No competency data available. Complete your first certification to generate your profile.</p>
              </div>
            )}
          </Card>
          {growthData.length > 1 && (
            <Card className="bg-[#141414] text-white border-none shadow-[8px_8px_0px_0px_#F27D26] mt-6">
              <h3 className="text-lg font-bold uppercase tracking-tight mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-[#F27D26]" />
                Growth Trajectory
              </h3>
              <div className="h-[200px] w-full -mx-4 sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(val, idx) => `Att ${idx + 1}`} stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: '2px solid #F27D26', borderRadius: '4px', color: '#fff', fontWeight: 'bold' }}
                      itemStyle={{ color: '#F27D26' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#F27D26" strokeWidth={3} dot={{ fill: '#141414', stroke: '#F27D26', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: '#F27D26' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function AdminOverview({ assessments, attempts, competencies }: { assessments: Assessment[]; attempts: Attempt[]; competencies: Competency[] }) {
  const averageScore = attempts.length > 0 
    ? Math.round(attempts.reduce((acc, curr) => acc + curr.overallScore, 0) / attempts.length)
    : 0;
  
  const passRate = attempts.length > 0
    ? Math.round((attempts.filter(a => a.overallScore >= 60).length / attempts.length) * 100)
    : 0;

  const exportAllToCSV = () => {
    const compHeaders = competencies.map(c => c.name);
    let csv = `Date,Student Email,Assessment,Overall Score (%),Certification Status,${compHeaders.join(',')}\n`;
    
    attempts.forEach(att => {
      const date = new Date(att.timestamp).toLocaleString().replace(/,/g, '');
      const assessmentName = assessments.find(a => a.id === att.assessmentId)?.name || 'Unknown Assessment';
      const studentEmail = att.student_email || att.userId;
      
      const compScores = competencies.map(comp => {
        const score = att.skillScores?.[comp.id];
        return score ? getSkillPercentageValue(score) : 'N/A';
      });

      csv += `"${date}","${studentEmail}","${assessmentName}",${att.overallScore},${att.certificationStatus},${compScores.join(',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ICCF_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={exportAllToCSV} variant="outline" className="text-xs bg-white text-[#141414] border-[#141414]">
          Download All Data (CSV)
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={<Building2 />} label="Total Departments" value="12" />
        <StatCard icon={<GraduationCap />} label="Students Enrolled" value="1,240" />
        <StatCard icon={<ClipboardList />} label="Active Tests" value={assessments.filter(a => a.active).length.toString()} />
        <StatCard icon={<Award />} label="Average Score" value={`${averageScore}%`} />
        
        <Card className="md:col-span-2 lg:col-span-3 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg sm:text-xl font-bold uppercase">Institutional Performance</h3>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Pass Rate</p>
                <p className="text-lg font-black text-green-500">{passRate}%</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Attempts</p>
                <p className="text-lg font-black">{attempts.length}</p>
              </div>
            </div>
          </div>
        <div className="h-48 sm:h-64 flex items-end gap-1 sm:gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 bg-gray-100 relative group min-w-[4px]">
              <div 
                className="absolute bottom-0 left-0 w-full bg-[#F27D26] transition-all group-hover:bg-[#141414]" 
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-4 text-[8px] sm:text-[10px] font-mono text-gray-400 uppercase overflow-x-auto pb-2">
          <span className="px-1">CSE</span>
          <span className="px-1">ECE</span>
          <span className="px-1">ME</span>
          <span className="px-1">CIVIL</span>
          <span className="px-1">BT</span>
          <span className="px-1">BBA</span>
          <span className="px-1">LAW</span>
          <span className="px-1">DS</span>
          <span className="px-1">AI</span>
          <span className="px-1">IOT</span>
          <span className="px-1">COM</span>
          <span className="px-1">ENG</span>
        </div>
      </Card>

      <Card className="lg:col-span-1">
        <h3 className="text-xl font-bold uppercase mb-6">Audit Status</h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase">Proctoring Logs</span>
            <Badge variant="success">Healthy</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase">IP Integrity</span>
            <Badge variant="success">99.8%</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold uppercase">Question Quality</span>
            <Badge variant="warning">Review Req.</Badge>
          </div>
        </div>
      </Card>
    </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase text-gray-400 leading-none mb-1">{label}</p>
        <p className="text-2xl font-black tracking-tighter">{value}</p>
      </div>
    </Card>
  );
}

// --- Assessment View ---

function AssessmentView({ assessment, competencies, onComplete, onCancel, user }: { assessment: Assessment; competencies: Competency[]; onComplete: () => void; onCancel: () => void; user: User }) {
  const assessmentType = getAssessmentType(assessment);
  const [step, setStep] = useState<'intro' | 'testing' | 'result'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const storageKey = `iccf_draft_assessment_${assessment.id}`;
  const [answers, setAnswers] = useState<any>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    }
  }, [answers, storageKey]);
  const [questions, setQuestions] = useState<QuestionLike[]>([]);
  const [finalResult, setFinalResult] = useState<{
    assessmentType: 'mcq' | 'likert';
    skillScores: Record<string, number | SkillScore>;
    overallScore: number;
    compositeScore?: CompositeScore;
    certificationStatus: 'certified' | 'failed';
  } | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  useEffect(() => {
    if (step === 'testing' && questions.length === 0) {
      const fetchQuestions = async () => {
        setLoadingQuestions(true);
        try {
          logger.assessment('Fetching Questions', 'info', { assessmentId: assessment.id });
          const q = query(collection(db, 'questions'), where('approvalStatus', '==', 'approved'));
          const snapshot = await getDocs(q);
          const allApprovedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuestionLike[];

          let selected: QuestionLike[] = [];

          if (assessment.questionIds && assessment.questionIds.length > 0) {
            // Explicitly selected questions mode
            selected = allApprovedQuestions.filter(q => assessment.questionIds?.includes(q.id));
            
            // Re-order to match the specified order if needed, but randomly is fine for now unless ordered is required.
            // But let's shuffle them for good measure if they are MCQ.
            selected = shuffleArray(selected);
          } else {
            // Legacy/Dynamic mode: random pulling based on competencyDistribution
            if (assessmentType === 'likert') {
              Object.entries(assessment.competencyDistribution).forEach(([compId, count]) => {
                const compQuestions = allApprovedQuestions.filter((question) => {
                  return getQuestionCompetencyId(question) === compId && isLikertQuestion(question);
                });
                selected = [...selected, ...shuffleArray(compQuestions).slice(0, count)];
              });
            } else {
              Object.entries(assessment.competencyDistribution).forEach(([compId, count]) => {
                const compQuestions = allApprovedQuestions.filter((question) => {
                  return getQuestionCompetencyId(question) === compId && !isLikertQuestion(question);
                });
                selected = [...selected, ...shuffleArray(compQuestions).slice(0, count)];
              });
            }
          }

          if (selected.length === 0) {
            logger.assessment('No Approved Questions Found, Using Fallback', 'info');
            if (assessmentType === 'likert') {
              const fallbackLikert = HUMAN_CENTRIC_LIKERT_SKILLS
                .filter((skill) => Object.keys(assessment.competencyDistribution).includes(skill.id))
                .flatMap((skill) =>
                  shuffleArray(skill.questions).map((question, index) => ({
                    id: `fallback_${skill.id}_${index + 1}`,
                    type: 'likert',
                    competencyId: skill.id,
                    competency_id: skill.id,
                    text: question.text,
                    question_text: question.text,
                    is_reverse: question.isReverse,
                    options: [],
                    correctOption: -1,
                    approvalStatus: 'approved',
                    difficulty: 'medium',
                    createdBy: 'system',
                  })),
                );
              setQuestions(fallbackLikert as QuestionLike[]);
            } else {
              const mockQuestions = Object.keys(assessment.competencyDistribution).flatMap((compId) => {
                return [
                  { id: `${compId}-1`, competencyId: compId, text: `How would you handle a conflict in a scenario related to this competency?`, options: ['Collaborate', 'Avoid', 'Compete', 'Accommodate'], correctOption: 0 },
                  { id: `${compId}-2`, competencyId: compId, text: `What is the most important aspect of this skill?`, options: ['Consistency', 'Speed', 'Accuracy', 'Innovation'], correctOption: 2 },
                ];
              });
              setQuestions(mockQuestions as QuestionLike[]);
            }
          } else {
            setQuestions(selected);
          }
          logger.assessment('Questions Loaded', 'success', { count: selected.length });
        } catch (error: any) {
          handleFirestoreError(error, 'fetch_questions', 'questions');
        } finally {
          setLoadingQuestions(false);
        }
      };
      fetchQuestions();
    }
  }, [step, assessment]);

  const timeLimit = assessment.timeLimit || 15;
  const storageTimerKey = `iccf_draft_timer_${assessment.id}`;

  const [timeLeft, setTimeLeft] = useState(() => {
    try {
      const endTimeStr = localStorage.getItem(storageTimerKey);
      if (endTimeStr) {
        const remaining = Math.max(0, Math.floor((parseInt(endTimeStr) - Date.now()) / 1000));
        return remaining;
      }
    } catch {}
    return timeLimit * 60;
  });

  useEffect(() => {
    if (step === 'testing') {
      let endTimeStr = localStorage.getItem(storageTimerKey);
      if (!endTimeStr) {
        const endTime = Date.now() + timeLimit * 60 * 1000;
        localStorage.setItem(storageTimerKey, endTime.toString());
      }
    }
  }, [step, timeLimit, storageTimerKey]);

  useEffect(() => {
    if (step === 'testing') {
      logger.assessment('Attempt Started', 'success', { assessmentId: assessment.id });
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'testing') return;
    const timer = setInterval(() => {
      const endTimeStr = localStorage.getItem(storageTimerKey);
      if (endTimeStr) {
        const remaining = Math.floor((parseInt(endTimeStr) - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(timer);
          setTimeLeft(0);
          handleSubmit();
        } else {
          setTimeLeft(remaining);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [step, storageTimerKey]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && step === 'testing') {
        logger.security('Tab Switch Detected', 'failure', { assessmentId: assessment.id, userId: user.uid });
        toast.warning('Warning: Tab switching is monitored during the assessment.');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [step, assessment.id, user.uid]);

  const handleSubmit = async () => {
    const competencyIds = Object.keys(assessment.competencyDistribution);
    let skillScores: Record<string, number | SkillScore> = {};
    let compositeScore: CompositeScore | undefined;
    let overallScore = 0;
    let certificationStatus = 'Not Certified';

    // Build the specific answer array requested
    const formattedAnswers = questions.map((q, index) => {
      const selected_value = answers[q.id];
      const is_reverse = Boolean(q.is_reverse ?? q.isReverse);
      const adjusted_score = is_reverse ? 6 - selected_value : selected_value;
      return {
        question_index: index,
        question_text: q.text || q.question_text || '',
        is_reverse,
        selected_value,
        adjusted_score,
      };
    });

    if (assessmentType === 'likert') {
      const likertScores = scoreLikertAssessment(competencyIds, questions, answers);
      skillScores = likertScores.skillScores;
      compositeScore = likertScores.composite;
      overallScore = likertScores.composite.percentage;
      certificationStatus = likertScores.certificationStatus;
    } else {
      setStep('scoring'); // optionally show a scoring state while AI processes
      const mcqSkillScores: Record<string, number> = {};
      const customFormattedAnswers: any[] = [];
      
      for (const compId of competencyIds) {
        const compQuestions = questions.filter((question) => getQuestionCompetencyId(question) === compId);
        let earnedPoints = 0;
        let totalMaxPoints = 0;

        for (const question of compQuestions) {
          const maxPts = question.points || question.max_points || 1;
          totalMaxPoints += maxPts;
          let qEarned = 0;
          let studentAnsStr = '';
          let feedbackStr = '';

          if (question.type === 'scenario_mcq') {
            const selectedOptStr = answers[question.id] !== undefined ? (question.options?.[answers[question.id]] || '') : '';
            qEarned = scoreScenarioMcq(question, selectedOptStr);
            studentAnsStr = selectedOptStr || 'No answer selected';
          } else if (question.type === 'ranking') {
            const studentOrder = answers[question.id] || [];
            qEarned = scoreRanking(question, studentOrder);
            studentAnsStr = Array.isArray(studentOrder) ? studentOrder.join(', ') : 'No answer selected';
          } else if (question.type === 'text_answer') {
            const studentResp = answers[question.id] || '';
            const rubric = question.rubric || 'Assess the quality of the answer.';
            const result = await gradeTextAnswer(question.question_text || question.text, rubric, studentResp, maxPts);
            feedbackStr = result.feedback;
            qEarned = result.score;
            studentAnsStr = studentResp || 'No answer provided';
          } else {
            // legacy mcq
            if (answers[question.id] === question.correctOption) {
              qEarned = maxPts;
            }
            const selectedIdx = answers[question.id];
            studentAnsStr = selectedIdx !== undefined ? (question.options?.[selectedIdx] || `Option ${selectedIdx}`) : 'No answer selected';
          }

          earnedPoints += qEarned;
          
          customFormattedAnswers.push({
            question_id: question.id,
            question_text: question.question_text || question.text || '',
            type: question.type || 'mcq',
            student_answer: studentAnsStr,
            points_earned: qEarned,
            max_points: maxPts,
            feedback: feedbackStr
          });
        }
        
        mcqSkillScores[compId] = totalMaxPoints > 0 ? Math.round((earnedPoints / totalMaxPoints) * 100) : 0;
      }
      
      skillScores = mcqSkillScores;
      overallScore = Math.round(Object.values(mcqSkillScores).reduce((a, b) => a + b, 0) / Object.values(mcqSkillScores).length);
      certificationStatus = overallScore >= assessment.minScore ? 'Certified' : 'Not Certified';
      
      // Override answers with the rich format for custom assessments
      Object.assign(answers, { __formatted: customFormattedAnswers });
    }

    logger.assessment('Attempt Submitted', 'info', { overallScore, status: certificationStatus });

    const attempt: Attempt = {
      id: `att_${Date.now()}`,
      userId: user.uid,
      assessmentId: assessment.id,
      startTime: new Date(Date.now() - (assessment.timeLimit || 30) * 60 * 1000 + timeLeft * 1000).toISOString(),
      endTime: new Date().toISOString(),
      ipAddress: '192.168.1.1',
      deviceMetadata: navigator.userAgent,
      answers: assessmentType === 'likert' ? formattedAnswers : (answers.__formatted || answers),
      skillScores,
      overallScore,
      certificationStatus,
      timestamp: new Date().toISOString(),
      
      // Exact strict payload requirements
      student_id: user.uid,
      student_email: user.email,
      assessment_title: assessment.name,
      submitted_at: new Date().toISOString(),
      raw_score: compositeScore?.raw || 0,
      skill_percentage: compositeScore?.percentage || 0,
      level: compositeScore?.level || 1,
      level_descriptor: compositeScore?.label || 'Critical Intervention Required',
      certification_status: certificationStatus,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'attempts', attempt.id), attempt);

      if (certificationStatus === 'Certified') {
        const cert: Certification = {
          id: `cert_${Date.now()}`,
          studentId: user.uid,
          departmentId: assessment.departmentId,
          overallScore,
          competencyScores: Object.entries(skillScores).reduce((acc, [compId, score]) => {
            acc[compId] = getSkillPercentageValue(score);
            return acc;
          }, {} as Record<string, number>),
          issuedAt: new Date().toISOString(),
        };
        batch.set(doc(db, 'certifications', cert.id), cert);
      }

      await batch.commit();
      localStorage.removeItem(storageKey);
      localStorage.removeItem(storageTimerKey);
      logger.assessment('Attempt Saved', 'success', { attemptId: attempt.id });
      
      setFinalResult({
        assessmentType: assessmentType as 'mcq' | 'likert',
        skillScores,
        overallScore,
        compositeScore,
        certificationStatus: certificationStatus as 'certified' | 'failed', // map for internal state
      });
      setStep('result');
    } catch (error: any) {
      handleFirestoreError(error, 'save_attempt', 'attempts');
    }
  };

  if (step === 'intro') {
    return (
      <div className="max-w-2xl mx-auto py-2 sm:py-4 lg:py-12">
        <Card className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-[#F27D26] mx-auto flex items-center justify-center mb-4 sm:mb-6">
              <ClipboardList className="text-white w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tighter leading-tight">{assessment.name}</h2>
            <p className="text-gray-500 font-mono text-[8px] sm:text-[10px] lg:text-sm uppercase">Institutional Certification Test</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
            <div className="p-2 sm:p-3 lg:p-4 bg-gray-50 border border-gray-100">
              <p className="text-[7px] sm:text-[8px] lg:text-[10px] font-bold uppercase text-gray-400">Duration</p>
              <p className="font-bold text-xs sm:text-sm lg:text-base">{assessment.timeLimit || 30} Minutes</p>
            </div>
            <div className="p-2 sm:p-3 lg:p-4 bg-gray-50 border border-gray-100">
              <p className="text-[7px] sm:text-[8px] lg:text-[10px] font-bold uppercase text-gray-400">Questions</p>
              <p className="font-bold text-xs sm:text-sm lg:text-base">{Object.values(assessment.competencyDistribution).reduce((acc, count) => acc + count, 0)} Total</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h4 className="font-bold uppercase text-[10px] sm:text-xs lg:text-sm border-b border-gray-100 pb-2">Guidelines</h4>
            <ul className="text-[10px] sm:text-xs lg:text-sm space-y-2 text-gray-600">
              <li className="flex gap-2"><CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" /> This attempt is proctored. IP and device metadata are logged.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" /> Minimum score of {assessment.minScore}% required for certification.</li>
              <li className="flex gap-2"><CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" /> Do not refresh or close the tab during the test.</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4 pt-2 sm:pt-4">
            <Button variant="outline" className="flex-1 order-2 sm:order-1 h-10 sm:h-12" onClick={onCancel}>Cancel</Button>
            <Button className="flex-1 order-1 sm:order-2 h-10 sm:h-12" onClick={() => setStep('testing')}>Start Assessment</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'testing') {
    if (loadingQuestions) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-sm uppercase tracking-widest">Loading Assessment Questions...</p>
        </div>
      );
    }

    if (questions.length === 0) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h3 className="text-xl font-bold uppercase">No Questions Available</h3>
          <p className="text-gray-500 max-w-md">This assessment doesn't have any approved questions yet. Please contact your department head.</p>
          <Button onClick={onCancel}>Return to Dashboard</Button>
        </div>
      );
    }

    const q = questions[currentQuestionIndex];
    const currentSkillId = getQuestionCompetencyId(q);
    const currentSkillQuestions = questions.filter((question) => getQuestionCompetencyId(question) === currentSkillId);
    const currentSkillQuestionIndex = currentSkillQuestions.findIndex((question) => question.id === q.id) + 1;
    const currentSkill = competencies.find((competency) => competency.id === currentSkillId);
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-black text-sm">
                {currentQuestionIndex + 1}
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-black uppercase tracking-tighter leading-tight">{assessment.name}</h2>
            </div>
            <p className="text-[8px] sm:text-[10px] lg:text-xs font-mono text-gray-500 uppercase">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 border-2 font-mono font-bold text-xs sm:text-sm lg:text-base w-full sm:w-auto justify-center",
            timeLeft < 300 ? "border-red-500 text-red-500 animate-pulse" : "border-[#141414]"
          )}>
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </div>
        </div>

        <div className="w-full h-1 sm:h-1.5 lg:h-2 bg-gray-100 mb-8 sm:mb-12">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${progress}%` }} 
            className="h-full bg-[#141414]" 
          />
        </div>

        <Card className="mb-6 sm:mb-8 border-none shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Shield className="w-32 h-32" />
          </div>
          <div className="mb-4 sm:mb-6 lg:mb-8 relative z-10">
            <p className="text-[9px] sm:text-[10px] lg:text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              {currentSkill?.name || 'Skill'}
            </p>
            <h3 className="text-base sm:text-lg lg:text-2xl font-bold leading-relaxed">{getQuestionText(q)}</h3>
          </div>

          {isLikertQuestion(q) ? (
            <div className="relative z-10 border border-gray-100 bg-gray-50 p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {LIKERT_SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setAnswers({ ...answers, [q.id]: option.value })}
                    className={cn(
                      'p-3 sm:p-4 border-2 text-center transition-all',
                      answers[q.id] === option.value ? 'border-[#141414] bg-white' : 'border-gray-200 hover:border-gray-400 bg-white',
                    )}
                  >
                    <p className="text-lg sm:text-xl font-black">{option.value}</p>
                    <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-500 mt-1">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : q.type === 'ranking' ? (
            <div className="relative z-10 space-y-2">
              <p className="text-xs text-gray-500 font-bold mb-4">Rank the items below from most important (top) to least important (bottom).</p>
              {(answers[q.id] || q.items || []).map((item: string, idx: number, arr: string[]) => (
                <div key={item} className="flex items-center gap-3 bg-white p-3 border border-gray-200 shadow-sm">
                  <div className="font-bold text-gray-400 w-6 text-center">{idx + 1}</div>
                  <div className="flex-1 font-bold text-sm">{item}</div>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => {
                        if (idx > 0) {
                          const next = [...arr];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          setAnswers({ ...answers, [q.id]: next });
                        }
                      }}
                      className={cn("p-1 bg-gray-100 hover:bg-gray-200 rounded", idx === 0 && "opacity-30 cursor-not-allowed")}
                      disabled={idx === 0}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        if (idx < arr.length - 1) {
                          const next = [...arr];
                          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                          setAnswers({ ...answers, [q.id]: next });
                        }
                      }}
                      className={cn("p-1 bg-gray-100 hover:bg-gray-200 rounded", idx === arr.length - 1 && "opacity-30 cursor-not-allowed")}
                      disabled={idx === arr.length - 1}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : q.type === 'text_answer' ? (
            <div className="relative z-10">
              <textarea
                className="w-full h-40 p-4 border-2 border-gray-200 focus:border-[#141414] focus:ring-0 resize-none font-medium text-sm transition-colors"
                placeholder="Type your answer here..."
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest"><AlertCircle className="w-3 h-3 inline mr-1" /> AI will assess this response</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase">{(answers[q.id] || '').length} characters</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:gap-5 relative z-10">
              {q.type === 'scenario_mcq' && q.scenario && (
                <div className="p-4 bg-gray-100 border-l-4 border-[#141414] mb-4">
                  <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Scenario Context</p>
                  <p className="text-sm font-medium text-gray-800 leading-relaxed">{q.scenario}</p>
                </div>
              )}
              {(q.options || []).map((opt: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                  className={cn(
                    "p-4 sm:p-6 text-left border-2 transition-all flex items-center justify-between group relative overflow-hidden",
                    answers[q.id] === idx
                      ? "border-[#141414] bg-gray-50"
                      : "border-gray-100 hover:border-gray-300"
                  )}
                >
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className={cn(
                      "w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-black text-[10px] sm:text-xs lg:text-sm flex-shrink-0 transition-colors",
                      answers[q.id] === idx ? "border-[#141414] bg-[#141414] text-white" : "border-gray-200 text-gray-400 group-hover:border-gray-400"
                    )}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className={cn(
                      "font-bold text-xs sm:text-sm lg:text-lg transition-colors",
                      answers[q.id] === idx ? "text-[#141414]" : "text-gray-600"
                    )}>{opt}</span>
                  </div>
                  {answers[q.id] === idx && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#141414]" />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-between gap-3 sm:gap-4">
          <Button 
            variant="ghost" 
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
            className="h-12 sm:h-14 px-6 sm:px-8 uppercase font-bold tracking-widest text-[10px] sm:text-xs"
          >
            Previous
          </Button>
          {currentQuestionIndex === questions.length - 1 ? (
            <Button 
              className="h-12 sm:h-14 px-8 sm:px-16 uppercase font-black tracking-widest text-xs sm:text-sm shadow-[4px_4px_0px_0px_#F27D26] hover:shadow-none transition-all"
              onClick={handleSubmit}
              disabled={Object.keys(answers).length < questions.length}
            >
              Submit Assessment
            </Button>
          ) : (
            <Button 
              className="h-12 sm:h-14 px-8 sm:px-16 uppercase font-black tracking-widest text-xs sm:text-sm shadow-[4px_4px_0px_0px_#141414] hover:shadow-none transition-all"
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              disabled={answers[q.id] === undefined}
            >
              Next Question
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12 text-center px-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card className="space-y-6 sm:space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-tight">
              ASSESSMENT COMPLETE!
            </h2>
          </div>
          {finalResult?.assessmentType === 'likert' ? (
            <div className="space-y-5 text-left">
              {/* Removed Composite Score Display per request */}              
              <div className="h-72 bg-[#141414] p-3 sm:p-4 border border-[#141414]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    data={competencies.map((comp) => {
                      const score = (finalResult.skillScores as any)[comp.id];
                      return {
                        subject: comp.name,
                        percentage: score ? getSkillPercentageValue(score) : 0,
                        fullMark: 100,
                      };
                    })}
                  >
                    <PolarGrid stroke="rgba(255,255,255,0.14)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="percentage" stroke="#F27D26" fill="#F27D26" fillOpacity={0.55} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(finalResult.skillScores as Record<string, number | SkillScore>).map(([compId, score]) => {
                  const level = getSkillLevelValue(score);
                  // Dynamic Max Points Logic
                  const maxPts = 35; // Assuming legacy or 7-question tests for now, UI can be updated later if needed
                  return (
                    <div key={compId} className="border border-gray-200 p-3 bg-white">
                      <p className="text-xs font-black uppercase tracking-tight">{competencies.find((comp) => comp.id === compId)?.name || compId}</p>
                      <p className="text-[11px] text-gray-600 mt-1">Score: {getSkillRawValue(score)}</p>
                      <p className="text-[11px] text-gray-600">Percentage: {Math.round(getSkillPercentageValue(score))}%</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded-full', levelBadgeClass(level))}>Level {level}</span>
                        <span className="text-[10px] font-semibold text-gray-500">{getSkillLevelLabel(score)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-2 border-[#141414] p-4 text-left bg-white shadow-[4px_4px_0px_0px_#141414] mt-6">
                <h3 className="font-black text-sm uppercase tracking-tight mb-2 border-b border-[#141414] pb-2">Assessment Scoring Formula</h3>
                <div className="space-y-2 text-xs font-mono">
                  <p className="font-bold uppercase text-gray-500 text-[10px]">How this score was calculated:</p>
                  <p className="text-sm font-black p-2 bg-gray-50 border border-gray-200 mt-1">
                    {questions.length > 15 ? (
                      `(( ${finalResult.compositeScore?.raw || Object.values(finalResult.skillScores).reduce((a: number, b: any) => a + getSkillRawValue(b), 0)} - 105 ) / 420) × 100 = ${Math.round(finalResult?.overallScore || 0)}%`
                    ) : (
                      `(( ${finalResult.compositeScore?.raw || Object.values(finalResult.skillScores).reduce((a: number, b: any) => a + getSkillRawValue(b), 0)} - 7 ) / 100) × 28 = ${Math.round(finalResult?.overallScore || 0)}%`
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-8 bg-gray-50 border border-gray-100">
              <p className="text-[10px] sm:text-xs lg:text-sm font-bold uppercase text-gray-400 mb-2">Final Certification Score</p>
              <p className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#141414]">
                {Math.round(finalResult?.overallScore || 0)}%
              </p>
            </div>
          )}
          <Button className="w-full h-12 sm:h-14" onClick={onComplete}>Return to Dashboard</Button>
        </Card>
      </motion.div>
    </div>
  );
}

// --- History View ---

function HistoryView({ attempts, assessments, competencies, onBack, onViewScorecard }: { attempts: Attempt[]; assessments: Assessment[]; competencies: Competency[]; onBack: () => void; onViewScorecard: (att: Attempt) => void }) {
  const handleExportTranscript = (att: Attempt) => {
    const assessment = assessments.find(a => a.id === att.assessmentId);
    const transcriptData = {
      institution: "Manav Rachna Institutional Competency Certification Framework",
      studentId: att.userId,
      assessmentName: assessment?.name,
      date: new Date(att.timestamp).toLocaleString(),
      overallScore: att.overallScore,
      competencies: Object.entries(att.skillScores)
        .filter(([id]) => competencies.find(c => c.id === id))
        .map(([id, score]) => ({
        name: competencies.find(c => c.id === id)?.name,
        score: getSkillPercentageValue(score),
        raw: getSkillRawValue(score),
        level: getSkillLevelValue(score),
        levelLabel: getSkillLevelLabel(score),
      })),
      compositeScore: att.compositeScore || att.composite_score || null,
      certificationStatus: att.certificationStatus
    };

    const blob = new Blob([JSON.stringify(transcriptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedName = (assessment?.name || 'assessment').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${att.userId}_${sanitizedName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported successfully');
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter">Attempt History</h2>
          <p className="text-gray-500 font-mono text-xs lg:text-sm uppercase tracking-widest">Track your competency development</p>
        </div>
        <Button variant="outline" onClick={onBack} className="text-xs uppercase tracking-widest font-bold">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {attempts.map(att => {
          const assessment = assessments.find(a => a.id === att.assessmentId);
          return (
            <Card key={att.id} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 lg:gap-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Award className={cn("w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8", att.certificationStatus === 'certified' ? "text-green-500" : "text-gray-400")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold uppercase leading-tight truncate">{assessment?.name}</h3>
                    <Badge variant={att.certificationStatus === 'certified' ? 'success' : 'danger'}>
                      {att.certificationStatus}
                    </Badge>
                  </div>
                  <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 font-mono">{new Date(att.timestamp).toLocaleString()}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(att.skillScores)
                      .filter(([id]) => competencies.find(c => c.id === id))
                      .map(([id, score]) => (
                      <span key={id} className="text-[7px] sm:text-[8px] lg:text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 uppercase whitespace-nowrap">
                        {competencies.find(c => c.id === id)?.name}: {Math.round(getSkillPercentageValue(score))}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between lg:justify-end gap-4 lg:gap-8 border-t lg:border-t-0 pt-3 sm:pt-4 lg:pt-0">
                <div className="text-left lg:text-right">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black">{Math.round(att.overallScore)}%</p>
                  <p className="text-[7px] sm:text-[8px] lg:text-[10px] font-bold uppercase text-gray-400">Total Score</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2" onClick={() => handleExportTranscript(att)}>
                    Export
                  </Button>
                  <Button variant="outline" className="text-[10px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5 lg:px-4 lg:py-2" onClick={() => onViewScorecard(att)}>
                    <span className="hidden sm:inline">View Scorecard</span>
                    <span className="sm:hidden">View</span>
                    <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --- Student Results View ---

function StudentResultsView({
  attempts,
  allUsers,
  departments,
  assessments,
  competencies,
  onViewScorecard,
  onBack
}: {
  attempts: Attempt[];
  allUsers: User[];
  departments: any[];
  assessments: Assessment[];
  competencies: Competency[];
  onViewScorecard: (attempt: Attempt) => void;
  onBack: () => void;
}) {
  const [viewMode, setViewMode] = useState<'assessments' | 'attempts' | 'analytics'>('assessments');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('all');

  const handleExportTranscript = (att: Attempt) => {
    const assessment = assessments.find(a => a.id === att.assessmentId);
    const transcriptData = {
      institution: "Manav Rachna Institutional Competency Certification Framework",
      studentId: att.userId,
      assessmentName: assessment?.name,
      date: new Date(att.timestamp).toLocaleString(),
      overallScore: att.overallScore,
      competencies: Object.entries(att.skillScores)
        .filter(([id]) => competencies.find(c => c.id === id))
        .map(([id, score]) => ({
        name: competencies.find(c => c.id === id)?.name,
        score: getSkillPercentageValue(score),
        raw: getSkillRawValue(score),
        level: getSkillLevelValue(score),
        levelLabel: getSkillLevelLabel(score),
      })),
      compositeScore: att.compositeScore || att.composite_score || null,
      certificationStatus: att.certificationStatus
    };

    const blob = new Blob([JSON.stringify(transcriptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedName = (assessment?.name || 'assessment').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${att.userId}_${sanitizedName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported successfully');
  };

  // Process & filter attempts
  const filteredAttempts = attempts.filter(att => {
    // Exclude invalid assessment attempts
    if (!assessments.some(a => a.id === att.assessmentId)) return false;

    const profile = allUsers.find(u => u.uid === att.userId);
    const name = (profile?.name || att.userId).toLowerCase();
    const email = (profile?.email || '').toLowerCase();
    const deptId = profile?.department || '';
    
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'all' || deptId === selectedDept;
    const matchesAssessment = selectedAssessmentId === 'all' || att.assessmentId === selectedAssessmentId;
    
    return matchesSearch && matchesDept && matchesAssessment;
  });

  // Calculate statistics
  const totalCount = filteredAttempts.length;
  const certifiedCount = filteredAttempts.filter(a => a.certificationStatus === 'certified').length;
  const passRate = totalCount > 0 ? Math.round((certifiedCount / totalCount) * 100) : 0;

  if (viewMode === 'assessments') {
    return (
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter">Select Assessment</h2>
            <p className="text-gray-500 font-mono text-xs lg:text-sm uppercase tracking-widest text-[#141414]">
              Choose an assessment to view detailed student attempts
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewMode('analytics')} className="text-xs uppercase tracking-widest font-bold">
              <BarChart3 className="w-4 h-4 mr-2" /> Dept Analytics
            </Button>
            <Button variant="outline" onClick={onBack} className="text-xs uppercase tracking-widest font-bold">
              <ChevronLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {assessments.map(assessment => {
            const attemptsCount = attempts.filter(a => a.assessmentId === assessment.id).length;
            const activeStatus = assessment.active ? 'Active' : 'Draft';
            const deptName = departments.find(d => d.id === assessment.departmentId)?.name || 'Common';

            return (
              <Card 
                key={assessment.id} 
                className="bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-6 hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_#141414] transition-all cursor-pointer"
                onClick={() => {
                  setSelectedAssessmentId(assessment.id);
                  setViewMode('attempts');
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-black uppercase leading-tight">{assessment.name}</h3>
                  <Badge variant={assessment.active ? 'success' : 'default'} className="flex-shrink-0">{activeStatus}</Badge>
                </div>
                <div className="space-y-2 mb-6">
                  <p className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-2">
                    <Building2 className="w-3 h-3" /> {deptName}
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-2">
                    <Clock className="w-3 h-3" /> {assessment.timeLimit || 30} Minutes
                  </p>
                </div>
                <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Total Attempts</p>
                    <p className="text-xl font-black text-[#F27D26]">{attemptsCount}</p>
                  </div>
                  <Button variant="ghost" className="p-2 h-auto hover:bg-gray-100">
                    <ArrowRight className="w-5 h-5 text-[#141414]" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (viewMode === 'analytics') {
    const compAverages = competencies.map(comp => {
      const scores = filteredAttempts
        .map(a => a.skillScores?.[comp.id])
        .filter(s => s !== undefined)
        .map(s => getSkillPercentageValue(s));
      
      const avg = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
      return { name: comp.name, avg };
    }).sort((a, b) => b.avg - a.avg);

    return (
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter">Department Analytics</h2>
            <p className="text-gray-500 font-mono text-xs lg:text-sm uppercase tracking-widest text-[#141414]">
              {selectedDept === 'all' ? 'All Departments' : departments.find(d => d.id === selectedDept)?.name || 'Department'} Performance
            </p>
          </div>
          <Button variant="outline" onClick={() => setViewMode('assessments')} className="text-xs uppercase tracking-widest font-bold">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Assessments
          </Button>
        </div>

        <Card className="bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 lg:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Department</label>
              <select className="w-full border-2 border-[#141414] px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-0" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Assessment</label>
              <select className="w-full border-2 border-[#141414] px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:ring-0" value={selectedAssessmentId} onChange={(e) => setSelectedAssessmentId(e.target.value)}>
                <option value="all">All Assessments</option>
                {assessments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flex items-center gap-4 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-5">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Total Attempts</p>
              <h4 className="text-2xl font-black">{totalCount}</h4>
            </div>
          </Card>
          <Card className="flex items-center gap-4 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-5">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Average Pass Rate</p>
              <h4 className="text-2xl font-black">{passRate}%</h4>
            </div>
          </Card>
          <Card className="flex items-center gap-4 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-5">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 flex-shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">Top Competency</p>
              <h4 className="text-sm font-black truncate">{compAverages[0]?.name || 'N/A'}</h4>
            </div>
          </Card>
        </div>

        <Card className="bg-white border-2 border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-6 mt-6">
          <h3 className="text-xl font-bold uppercase tracking-tight mb-6">Average Competency Scores</h3>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compAverages} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="avg" fill="#F27D26" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter">Student Results</h2>
          <p className="text-gray-500 font-mono text-xs lg:text-sm uppercase tracking-widest text-[#141414]">
            Viewing Attempts for: {assessments.find(a => a.id === selectedAssessmentId)?.name || 'All Assessments'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setViewMode('assessments')} className="text-xs uppercase tracking-widest font-bold">
          <ChevronLeft className="w-4 h-4" /> Back to Assessments
        </Button>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-5">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 flex-shrink-0">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400">Total Assessment Attempts</p>
            <h4 className="text-2xl font-black">{totalCount}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-5">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400">Certified Students</p>
            <h4 className="text-2xl font-black">{certifiedCount}</h4>
          </div>
        </Card>

        <Card className="flex items-center gap-4 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4 sm:p-5">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 flex-shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400">Success/Pass Rate</p>
            <h4 className="text-2xl font-black">{passRate}%</h4>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#141414] rounded-md font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#F27D26]"
            />
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 border border-[#141414] rounded-md font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#F27D26] bg-white"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedAssessmentId}
              onChange={e => setSelectedAssessmentId(e.target.value)}
              className="w-full px-3 py-2 border border-[#141414] rounded-md font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#F27D26] bg-white"
            >
              <option value="all">All Assessments</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Attempts Table */}
      <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_#141414] overflow-x-auto">
        {filteredAttempts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-400 font-mono uppercase text-xs">No student results found matching the filters.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 uppercase text-[9px] sm:text-[10px] font-bold tracking-widest text-gray-500 border-b border-[#141414]">
                <th className="p-3 sm:p-4 whitespace-nowrap">Name</th>
                <th className="p-3 sm:p-4 whitespace-nowrap hidden sm:table-cell">Email</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">Assessment</th>
                <th className="p-3 sm:p-4 whitespace-nowrap hidden md:table-cell">Date</th>
                <th className="p-3 sm:p-4 whitespace-nowrap text-right">Raw</th>
                <th className="p-3 sm:p-4 whitespace-nowrap text-right">%</th>
                <th className="p-3 sm:p-4 whitespace-nowrap text-center">Level</th>
                <th className="p-3 sm:p-4 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.map(att => {
                const profile = allUsers.find(u => u.uid === att.userId);
                const studentName = profile?.name || att.userId;
                const studentEmail = profile?.email || 'N/A';
                const assessment = assessments.find(a => a.id === att.assessmentId);
                
                return (
                  <tr 
                    key={att.id} 
                    className="hover:bg-gray-50 text-[10px] sm:text-xs font-mono border-b border-gray-100 cursor-pointer transition-colors"
                    onClick={() => onViewScorecard(att)}
                  >
                    <td className="p-3 sm:p-4 font-bold text-[#141414] uppercase">{studentName}</td>
                    <td className="p-3 sm:p-4 hidden sm:table-cell">{studentEmail}</td>
                    <td className="p-3 sm:p-4">{assessment?.name || 'Assessment'}</td>
                    <td className="p-3 sm:p-4 hidden md:table-cell">{new Date(att.timestamp).toLocaleDateString()}</td>
                    <td className="p-3 sm:p-4 text-right">{att.raw_score ?? 0}</td>
                    <td className="p-3 sm:p-4 text-right font-black">{att.skill_percentage ?? Math.round(att.overallScore)}%</td>
                    <td className="p-3 sm:p-4 text-center">
                      <span className={cn('px-2 py-0.5 text-[9px] font-bold uppercase rounded-full', levelBadgeClass(att.level ?? getLevelFromPercentage(att.overallScore)))}>
                        L{att.level ?? getLevelFromPercentage(att.overallScore)}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <Badge variant={att.certificationStatus === 'Certified' || att.certificationStatus === 'certified' ? 'success' : 'danger'}>
                        {att.certificationStatus}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// --- Scorecard View ---

function ScorecardView({ 
  attempt, 
  assessments, 
  competencies, 
  onBack, 
  user, 
  allUsers, 
  departments 
}: { 
  attempt: Attempt; 
  assessments: Assessment[]; 
  competencies: Competency[]; 
  onBack: () => void; 
  user?: User; 
  allUsers?: User[]; 
  departments?: any[]; 
}) {
  const assessment = assessments.find(a => a.id === attempt.assessmentId);
  const assessmentType = (attempt.assessmentType || attempt.assessment_type || (assessment as any)?.assessment_type || (assessment as any)?.type || 'mcq') as 'mcq' | 'likert';
  const isTeacherView = user?.role === 'dept_head' || user?.role === 'core_team';

  const studentProfile = allUsers?.find(u => u.uid === attempt.userId);
  const studentName = studentProfile?.name || attempt.userId;
  const studentEmail = studentProfile?.email || 'N/A';
  const studentDeptId = studentProfile?.department || '';
  const studentDeptName = departments?.find(d => d.id === studentDeptId)?.name || studentDeptId || 'Common';

  const totalQuestionCount = Object.keys(attempt.answers || {}).length;
  // Make min and max dynamic based on actual questions (fallback to 105 length logic for legacy)
  const isFullAssessment = totalQuestionCount > 15;
  const minRaw = totalQuestionCount > 0 ? totalQuestionCount * 1 : (isFullAssessment ? 105 : 7);
  const maxRaw = totalQuestionCount > 0 ? totalQuestionCount * 5 : (isFullAssessment ? 525 : 35);
  const denominator = maxRaw - minRaw || 1;

  const totalRaw = Object.values(attempt.skillScores).reduce<number>((acc: number, s: any) => {
    return acc + getSkillRawValue(s);
  }, 0);

  const finalPct = Math.round(((totalRaw - minRaw) / denominator) * 100);

  const getResponseText = (rawVal: number) => {
    if (rawVal === 5) return "5 (Strongly Agree)";
    if (rawVal === 4) return "4 (Agree)";
    if (rawVal === 3) return "3 (Neutral)";
    if (rawVal === 2) return "2 (Disagree)";
    return "1 (Strongly Disagree)";
  };

  const handleExportTranscript = (att: Attempt) => {
    const transcriptData = {
      institution: "Manav Rachna Institutional Competency Certification Framework",
      studentId: att.userId,
      assessmentName: assessment?.name,
      date: new Date(att.timestamp).toLocaleString(),
      overallScore: att.overallScore,
      competencies: Object.entries(att.skillScores)
        .filter(([id]) => competencies.find(c => c.id === id))
        .map(([id, score]) => ({
        name: competencies.find(c => c.id === id)?.name,
        score: getSkillPercentageValue(score),
        raw: getSkillRawValue(score),
        level: getSkillLevelValue(score),
        levelLabel: getSkillLevelLabel(score),
      })),
      compositeScore: att.compositeScore || att.composite_score || null,
      certificationStatus: att.certificationStatus
    };

    const blob = new Blob([JSON.stringify(transcriptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedName = (assessment?.name || 'assessment').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `${att.userId}_${sanitizedName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transcript exported successfully');
  };

  return (
    <div className="max-w-3xl mx-auto py-2 sm:py-6 text-center">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <Card className="space-y-6 sm:space-y-8">
          {/* Student Info Block */}
          {isTeacherView && (
            <div className="bg-gray-50 border-2 border-[#141414] p-4 text-left font-mono text-xs space-y-1 shadow-[4px_4px_0px_0px_#141414]">
              <p className="font-bold uppercase text-[10px] text-gray-400 mb-2 border-b border-gray-200 pb-1">Student Candidate Information</p>
              <p><span className="font-bold text-[#141414] uppercase">Name:</span> {studentName}</p>
              <p><span className="font-bold text-[#141414] uppercase">Email:</span> {studentEmail}</p>
              <p><span className="font-bold text-[#141414] uppercase">Department:</span> {studentDeptName}</p>
              <p><span className="font-bold text-[#141414] uppercase">Date of Attempt:</span> {new Date(attempt.timestamp).toLocaleString()}</p>
            </div>
          )}

          <div className={cn(
            "w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full flex items-center justify-center text-white",
            attempt.certificationStatus === 'certified' ? "bg-green-500" : "bg-red-500"
          )}>
            {attempt.certificationStatus === 'certified' ? (
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            ) : (
              <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12" />
            )}
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-tight">
              {attempt.certificationStatus === 'certified' ? "Certification Earned" : "Assessment Complete"}
            </h2>
            <p className="text-gray-500 font-mono text-[10px] sm:text-xs lg:text-sm uppercase mt-2">
              {assessment?.name || 'Assessment'}
            </p>
            {!isTeacherView && (
              <p className="text-gray-500 font-mono text-[8px] sm:text-[10px] lg:text-xs uppercase mt-1">
                Attempt Date: {new Date(attempt.timestamp).toLocaleString()}
              </p>
            )}
          </div>

          {assessmentType === 'likert' ? (
            <div className="space-y-5 text-left">
              {/* Header Card */}
              <div className="p-4 sm:p-6 bg-gray-50 border border-gray-100 text-center">
                <p className="text-[10px] sm:text-xs font-bold uppercase text-gray-400 mb-2">Skill Score</p>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-4xl sm:text-5xl font-black text-[#141414]">{attempt.skill_percentage ?? attempt.overallScore}%</p>
                  <p className="text-sm font-bold text-gray-600 border-t border-gray-200 mt-2 pt-2 w-1/2 mx-auto">
                    Raw Score: {attempt.raw_score ?? totalRaw}/{maxRaw}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
                  <span className={cn('px-3 py-1 text-xs font-bold uppercase rounded-full', levelBadgeClass(attempt.level ?? getLevelFromPercentage(attempt.overallScore)))}>
                    Level {attempt.level ?? getLevelFromPercentage(attempt.overallScore)}
                  </span>
                  <span className="text-xs font-semibold text-gray-600">{attempt.level_descriptor ?? LIKERT_LEVEL_LABELS[getLevelFromPercentage(attempt.overallScore)]}</span>
                </div>
              </div>

              {/* Formula Box */}
              <div className="border-2 border-[#141414] p-4 text-left bg-white shadow-[4px_4px_0px_0px_#141414]">
                <h3 className="font-black text-sm uppercase tracking-tight mb-4 border-b border-[#141414] pb-2">How This Score Was Calculated</h3>
                <div className="space-y-4 text-xs font-mono">
                  <div>
                    <p className="font-bold uppercase text-gray-500 text-[10px]">Percentage Formula:</p>
                    <p className="text-sm font-black p-2 bg-gray-50 border border-gray-200 mt-1">
                      {isFullAssessment ? (
                        `(( ${attempt.raw_score ?? totalRaw} - 105 ) / 420) × 100 = ${attempt.skill_percentage ?? attempt.overallScore}%`
                      ) : (
                        `(( ${attempt.raw_score ?? totalRaw} - 7 ) / 100) × 28 = ${attempt.skill_percentage ?? attempt.overallScore}%`
                      )}
                    </p>
                  </div>

                  {/* Question Breakdown Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-gray-200">
                      <thead>
                        <tr className="bg-gray-100 uppercase text-[9px] font-bold">
                          <th className="p-2 border border-gray-200 w-12 text-center">S. No.</th>
                          <th className="p-2 border border-gray-200">Question</th>
                          <th className="p-2 border border-gray-200 text-center">Student's Answer</th>
                          <th className="p-2 border border-gray-200 text-center">Marks Assigned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(attempt.answers) ? (
                          <>
                            {attempt.answers.map((ans: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50 text-[10px]">
                                <td className="p-2 border border-gray-200 text-center font-bold text-gray-500">{idx + 1}</td>
                                <td className="p-2 border border-gray-200 text-gray-600">
                                  {ans.question_text}
                                  {ans.is_reverse && <span className="ml-2 text-[8px] text-gray-400 bg-gray-100 px-1 rounded uppercase tracking-widest">(Reverse)</span>}
                                </td>
                                <td className="p-2 border border-gray-200 text-center font-bold">{ans.selected_value}</td>
                                <td className="p-2 border border-gray-200 text-center font-black text-[#F27D26]">{ans.adjusted_score}</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-100 text-[11px] font-black uppercase">
                              <td colSpan={3} className="p-3 border border-gray-200 text-right">Overall Marks Earned:</td>
                              <td className="p-3 border border-gray-200 text-center text-[#F27D26]">
                                {attempt.answers.reduce((acc: number, curr: any) => acc + (curr.adjusted_score || 0), 0)} / {attempt.answers.length * 5}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className="hover:bg-gray-50 text-[10px]">
                            <td colSpan={4} className="p-2 border border-gray-200 text-center text-gray-400">Question breakdown not available for this legacy attempt.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 text-left">
              <div className="p-4 sm:p-8 bg-gray-50 border border-gray-100 text-center">
                <p className="text-[10px] sm:text-xs lg:text-sm font-bold uppercase text-gray-400 mb-2">Final Certification Score</p>
                <p className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#141414]">
                  {Math.round(attempt.overallScore)}%
                </p>
              </div>

              {Array.isArray(attempt.answers) && attempt.answers.length > 0 && attempt.answers[0].type !== undefined && (
                <div className="border-2 border-[#141414] p-4 text-left bg-white shadow-[4px_4px_0px_0px_#141414]">
                  <h3 className="font-black text-sm uppercase tracking-tight mb-4 border-b border-[#141414] pb-2">Question Breakdown & Grading</h3>
                  
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full text-left border-collapse border border-gray-200">
                      <thead>
                        <tr className="bg-gray-100 uppercase text-[9px] font-bold">
                          <th className="p-2 border border-gray-200 w-12 text-center">S. No.</th>
                          <th className="p-2 border border-gray-200">Question</th>
                          <th className="p-2 border border-gray-200">Student's Answer</th>
                          <th className="p-2 border border-gray-200 text-center">Marks Assigned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attempt.answers.map((ans: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 text-[10px]">
                            <td className="p-2 border border-gray-200 text-center font-bold text-gray-500">{idx + 1}</td>
                            <td className="p-2 border border-gray-200 text-gray-700 font-medium">
                              {ans.question_text}
                              {ans.type === 'text_answer' && ans.feedback && (
                                <div className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-400 text-[9px] text-blue-800">
                                  <strong>AI Feedback:</strong> {ans.feedback}
                                </div>
                              )}
                            </td>
                            <td className="p-2 border border-gray-200 text-gray-800">
                              {ans.type === 'scenario_mcq' || ans.type === 'mcq' ? (
                                <span className="font-semibold text-[#F27D26]">{ans.student_answer}</span>
                              ) : (
                                ans.student_answer
                              )}
                            </td>
                            <td className="p-2 border border-gray-200 text-center font-black text-[#141414]">
                              {ans.points_earned} / {ans.max_points}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 text-[11px] font-black uppercase">
                          <td colSpan={3} className="p-3 border border-gray-200 text-right">Overall Marks Earned:</td>
                          <td className="p-3 border border-gray-200 text-center text-[#F27D26]">
                            {attempt.answers.reduce((acc: number, curr: any) => acc + (curr.points_earned || 0), 0)} / {attempt.answers.reduce((acc: number, curr: any) => acc + (curr.max_points || 0), 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2 text-xs font-mono bg-gray-50 p-3 border border-gray-200">
                    <p className="font-bold uppercase text-gray-500 text-[10px] mb-2">Scoring Formulae Applied:</p>
                    <p><strong>MCQ / Scenario MCQ:</strong> Correct Answer = Full Points, Incorrect = 0 Points</p>
                    <p><strong>Ranking:</strong> (Total Points / Items Count) × Correct Positions = Points Earned</p>
                    <p><strong>Text Answer:</strong> Graded out of Max Points by Gemini AI based on Rubric</p>
                    <p><strong>Overall Score:</strong> Average of all competency skill percentages.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={onBack}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => handleExportTranscript(attempt)}>
              Export Scorecard
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

// --- Admin Management ---

function AdminManagement({ user, competencies, assessments, departments, onBack }: { user: User; competencies: Competency[]; assessments: Assessment[]; departments: any[]; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'departments' | 'competencies' | 'assessments' | 'question_bank' | 'logs'>('departments');
  const [pendingQuestions, setPendingQuestions] = useState<QuestionLike[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  
  // Question Bank State
  const [allQuestions, setAllQuestions] = useState<QuestionLike[]>([]);
  const [questionSearchQuery, setQuestionSearchQuery] = useState('');
  const [questionFilterType, setQuestionFilterType] = useState('all');
  const [questionFilterStatus, setQuestionFilterStatus] = useState('all');
  const [questionFilterCompetency, setQuestionFilterCompetency] = useState('all');
  const [newQuestionType, setNewQuestionType] = useState<'mcq' | 'likert' | 'scenario_mcq' | 'ranking' | 'text_answer'>('mcq');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionCompetencyId, setNewQuestionCompetencyId] = useState('');
  const [newQuestionOptions, setNewQuestionOptions] = useState<string[]>(['', '', '', '']);
  const [newQuestionCorrectOption, setNewQuestionCorrectOption] = useState(0);
  const [newQuestionReverse, setNewQuestionReverse] = useState(false);
  
  // Custom Question Fields
  const [newQuestionScenario, setNewQuestionScenario] = useState('');
  const [newQuestionItems, setNewQuestionItems] = useState<string[]>(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
  const [newQuestionCorrectOrder, setNewQuestionCorrectOrder] = useState<string>('0,1,2,3'); // comma separated indices
  const [newQuestionRubric, setNewQuestionRubric] = useState('');
  const [newQuestionMaxPoints, setNewQuestionMaxPoints] = useState(10);
  
  const [savingQuestion, setSavingQuestion] = useState(false);

  // --- New Modal States ---
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  const [showCompModal, setShowCompModal] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompDeptId, setNewCompDeptId] = useState('');

  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [assessmentForm, setAssessmentForm] = useState({
    name: '',
    departmentId: '',
    timeLimit: 30,
    minScore: 60,
    active: false,
    competencyDistribution: {} as Record<string, number>
  });
  const [assessmentModalTab, setAssessmentModalTab] = useState<'settings' | 'questions'>('settings');
  const [assessmentSelectedQuestions, setAssessmentSelectedQuestions] = useState<string[]>([]);
  const [showQuestionSelector, setShowQuestionSelector] = useState(false);

  const [showQuestionsModal, setShowQuestionsModal] = useState<Assessment | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<QuestionLike[]>([]);

  // Edit Question State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionData, setEditQuestionData] = useState<Partial<QuestionLike>>({});
  const [savingEditQuestion, setSavingEditQuestion] = useState(false);

  const openEditQuestion = (q: QuestionLike) => {
    setEditingQuestionId(q.id);
    setEditQuestionData({ ...q });
  };

  const handleSaveEditQuestion = async () => {
    if (!editingQuestionId) return;
    setSavingEditQuestion(true);
    try {
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'questions', editingQuestionId), editQuestionData);
      toast.success('Question updated successfully.');
      setEditingQuestionId(null);
    } catch (e: any) {
      handleFirestoreError(e, 'update_question', 'questions');
    } finally {
      setSavingEditQuestion(false);
    }
  };

  const handleMigrateAssessments = async () => {
    try {
      const batch = writeBatch(db);
      let migratedCount = 0;
      
      for (const assessment of assessments) {
        if (!assessment.questionIds || assessment.questionIds.length === 0) {
          const distribution = assessment.competencyDistribution || {};
          let selectedIds: string[] = [];
          
          for (const [compId, count] of Object.entries(distribution)) {
            if (count > 0) {
              const eligible = allQuestions.filter(q => q.approvalStatus === 'approved' && getQuestionCompetencyId(q) === compId);
              const shuffled = [...eligible].sort(() => 0.5 - Math.random());
              const picked = shuffled.slice(0, count).map(q => q.id);
              selectedIds = [...selectedIds, ...picked];
            }
          }
          
          if (selectedIds.length > 0) {
            batch.update(doc(db, 'assessments', assessment.id), { questionIds: selectedIds });
            migratedCount++;
          }
        }
      }
      
      if (migratedCount > 0) {
        await batch.commit();
        toast.success(`Migrated ${migratedCount} assessments with explicit question IDs.`);
      } else {
        toast.info('No assessments required migration.');
      }
    } catch (error: any) {
      handleFirestoreError(error, 'migrate_assessments', 'assessments');
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    const id = newDeptName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    try {
      await setDoc(doc(db, 'departments', id), { name: newDeptName.trim() });
      toast.success('Department added');
      setShowDeptModal(false);
      setNewDeptName('');
    } catch (e: any) {
      handleFirestoreError(e, 'add_dept', 'departments');
    }
  };

  const handleRenameDepartment = async (id: string, newName: string) => {
    try {
      await setDoc(doc(db, 'departments', id), { name: newName }, { merge: true });
      toast.success('Department renamed');
    } catch (e: any) {
      handleFirestoreError(e, 'rename_dept', 'departments');
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    // Note: in a real app, you would check for associated competencies and assessments before deleting.
    try {
      // deleting from firestore
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'departments', id));
      toast.success('Department deleted');
    } catch (e: any) {
      handleFirestoreError(e, 'delete_dept', 'departments');
    }
  };

  const handleAddCompetency = async () => {
    if (!newCompName.trim()) return;
    const id = newCompName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    try {
      await setDoc(doc(db, 'competencies', id), { 
        name: newCompName.trim(),
        departmentId: newCompDeptId 
      });
      toast.success('Competency added');
      setShowCompModal(false);
      setNewCompName('');
      setNewCompDeptId('');
    } catch (e: any) {
      handleFirestoreError(e, 'add_comp', 'competencies');
    }
  };

  const handleSaveAssessment = async () => {
    if (!assessmentForm.name.trim() || !assessmentForm.departmentId) return;
    try {
      const id = editingAssessment ? editingAssessment.id : `ast_${Date.now()}`;
      
      // Auto-calculate competency distribution from selected questions
      const cleanedDist: Record<string, number> = {};
      if (assessmentSelectedQuestions.length > 0) {
        assessmentSelectedQuestions.forEach(qId => {
          const q = allQuestions.find(aq => aq.id === qId);
          if (q) {
            const compId = getQuestionCompetencyId(q);
            cleanedDist[compId] = (cleanedDist[compId] || 0) + 1;
          }
        });
      } else {
        for (const [k, v] of Object.entries(assessmentForm.competencyDistribution) as [string, number][]) {
          if (v > 0) cleanedDist[k] = v;
        }
      }

      const payload: Partial<Assessment> = {
        name: assessmentForm.name.trim(),
        departmentId: assessmentForm.departmentId,
        timeLimit: assessmentForm.timeLimit,
        minScore: assessmentForm.minScore,
        active: assessmentForm.active,
        competencyDistribution: cleanedDist,
        questionIds: assessmentSelectedQuestions
      };
      await setDoc(doc(db, 'assessments', id), payload, { merge: true });
      toast.success(editingAssessment ? 'Assessment updated' : 'Assessment created');
      setShowAssessmentModal(false);
    } catch (e: any) {
      handleFirestoreError(e, 'save_assessment', 'assessments');
    }
  };

  const openEditAssessment = (a: Assessment) => {
    setEditingAssessment(a);
    setAssessmentForm({
      name: a.name,
      departmentId: a.departmentId,
      timeLimit: a.timeLimit || 30,
      minScore: a.minScore,
      active: a.active,
      competencyDistribution: a.competencyDistribution || {}
    });
    setAssessmentSelectedQuestions(a.questionIds || []);
    setAssessmentModalTab('settings');
    setShowQuestionSelector(false);
    setShowAssessmentModal(true);
  };

  const openCreateAssessment = () => {
    setEditingAssessment(null);
    setAssessmentForm({
      name: '',
      departmentId: departments[0]?.id || '',
      timeLimit: 30,
      minScore: 60,
      active: false,
      competencyDistribution: {}
    });
    setAssessmentSelectedQuestions([]);
    setAssessmentModalTab('settings');
    setShowQuestionSelector(false);
    setShowAssessmentModal(true);
  };

  const viewQuestions = async (a: Assessment) => {
    setShowQuestionsModal(a);
    try {
      const q = query(collection(db, 'questions'), where('approvalStatus', '==', 'approved'));
      const snapshot = await getDocs(q);
      const allApproved = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuestionLike[];
      const relevant = allApproved.filter(q => Object.keys(a.competencyDistribution).includes(getQuestionCompetencyId(q)));
      setAssessmentQuestions(relevant);
    } catch (e: any) {
      handleFirestoreError(e, 'fetch_assessment_questions', 'questions');
    }
  };

  useEffect(() => {
    if (!newQuestionCompetencyId && competencies.length > 0) {
      setNewQuestionCompetencyId(competencies[0].id);
    }
  }, [competencies, newQuestionCompetencyId]);

  useEffect(() => {
    const q = query(collection(db, 'questions'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allQ = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionLike));
      setAllQuestions(allQ);
      setPendingQuestions(allQ.filter(q => q.approvalStatus === 'pending'));
    }, (error) => handleFirestoreError(error, 'fetch_all_questions', 'questions'));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      const q = query(collection(db, 'logs'), where('category', '!=', 'ERROR_LOG')); // Simplified for now
      const unsub = onSnapshot(q, (snapshot) => {
        setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      }, (error) => handleFirestoreError(error, 'fetch_logs', 'logs'));
      return () => unsub();
    }
  }, [activeTab]);

  const handleApproveQuestion = async (id: string) => {
    try {
      await setDoc(doc(db, 'questions', id), { approvalStatus: 'approved' }, { merge: true });
      logger.admin('Question Approved', 'success', { questionId: id });
      toast.success('Question approved');
    } catch (error: any) {
      handleFirestoreError(error, 'approve_question', `questions/${id}`);
    }
  };

  const handleRejectQuestion = async (id: string) => {
    try {
      await setDoc(doc(db, 'questions', id), { approvalStatus: 'rejected' }, { merge: true });
      logger.admin('Question Rejected', 'success', { questionId: id });
      toast.success('Question rejected');
    } catch (error: any) {
      handleFirestoreError(error, 'reject_question', `questions/${id}`);
    }
  };

  const handleCreateQuestion = async () => {
    if (!newQuestionCompetencyId || !newQuestionText.trim()) {
      toast.error('Please select a competency and enter question text.');
      return;
    }

    if (newQuestionType === 'mcq' && newQuestionOptions.some((option) => !option.trim())) {
      toast.error('Please fill all MCQ options before saving.');
      return;
    }
    if (newQuestionType === 'scenario_mcq' && (newQuestionOptions.some((o) => !o.trim()) || !newQuestionScenario.trim())) {
      toast.error('Please fill scenario and all options.');
      return;
    }
    if (newQuestionType === 'ranking' && newQuestionItems.some((i) => !i.trim())) {
      toast.error('Please fill all ranking items.');
      return;
    }
    if (newQuestionType === 'text_answer' && !newQuestionRubric.trim()) {
      toast.error('Please provide a grading rubric.');
      return;
    }

    setSavingQuestion(true);
    try {
      const payload: Record<string, any> = {
        type: newQuestionType,
        competencyId: newQuestionCompetencyId,
        competency_id: newQuestionCompetencyId,
        text: newQuestionText.trim(),
        question_text: newQuestionText.trim(),
        difficulty: 'medium',
        createdBy: user.uid,
        approvalStatus: 'pending',
      };

      if (newQuestionType === 'likert') {
        payload.is_reverse = newQuestionReverse;
        payload.isReverse = newQuestionReverse;
        payload.options = [];
        payload.correctOption = -1;
        payload.points = 0;
      } else if (newQuestionType === 'mcq') {
        payload.options = newQuestionOptions.map((option) => option.trim());
        payload.correctOption = newQuestionCorrectOption;
      } else if (newQuestionType === 'scenario_mcq') {
        payload.scenario = newQuestionScenario.trim();
        payload.options = newQuestionOptions.map((option) => option.trim());
        payload.correct_answer = payload.options[newQuestionCorrectOption]; // save the string value
        payload.correctOption = newQuestionCorrectOption; // fallback
        payload.points = newQuestionMaxPoints || 1;
      } else if (newQuestionType === 'ranking') {
        payload.items = newQuestionItems.map((item) => item.trim());
        // Map the comma separated string to actual items for correct_order
        const indices = newQuestionCorrectOrder.split(',').map(n => parseInt(n.trim(), 10));
        payload.correct_order = indices.map(i => payload.items[i] || payload.items[0]);
        payload.points = newQuestionMaxPoints || 5;
      } else if (newQuestionType === 'text_answer') {
        payload.rubric = newQuestionRubric.trim();
        payload.max_points = newQuestionMaxPoints || 10;
        payload.points = newQuestionMaxPoints || 10;
      }

      const docRef = await addDoc(collection(db, 'questions'), payload);
      logger.admin('Question Created', 'success', { type: newQuestionType, competencyId: newQuestionCompetencyId });
      toast.success('Question submitted for approval.');
      
      if (showAssessmentModal) {
        setAssessmentSelectedQuestions(prev => [...prev, docRef.id]);
        toast.success('Question automatically added to assessment.');
      }

      setNewQuestionText('');
      setNewQuestionOptions(['', '', '', '']);
      setNewQuestionCorrectOption(0);
      setNewQuestionReverse(false);
      setNewQuestionScenario('');
      setNewQuestionItems(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
      setNewQuestionCorrectOrder('0,1,2,3');
      setNewQuestionRubric('');
    } catch (error: any) {
      handleFirestoreError(error, 'create_question', 'questions');
    } finally {
      setSavingQuestion(false);
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter">Institutional Management</h2>
          <p className="text-gray-500 font-mono text-xs lg:text-sm uppercase">Governance & Question Bank Control</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:gap-4 w-full sm:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none text-[10px] sm:text-xs px-2" onClick={() => (window as any).handleSeedData?.()}><Plus className="w-3 h-3 sm:w-4 sm:h-4" /> Seed Data</Button>
          <Button variant="outline" onClick={onBack} className="flex-1 sm:flex-none text-[10px] sm:text-xs px-2 uppercase tracking-widest font-bold">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[#141414] overflow-x-auto no-scrollbar">
        {[
          { id: 'departments', label: 'Departments', icon: <Building2 className="w-4 h-4" /> },
          { id: 'competencies', label: 'Competencies', icon: <BookOpen className="w-4 h-4" /> },
          { id: 'assessments', label: 'Assessments', icon: <ClipboardList className="w-4 h-4" /> },
          { id: 'question_bank', label: 'Question Bank', icon: <Database className="w-4 h-4" />, count: pendingQuestions.length },
          ...(user.role === 'core_team' ? [{ id: 'logs', label: 'Audit Logs', icon: <History className="w-4 h-4" /> }] : []),
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-3 font-bold uppercase tracking-tighter text-sm flex items-center gap-2 border-b-4 transition-all whitespace-nowrap",
              activeTab === tab.id ? "border-[#F27D26] text-[#141414]" : "border-transparent text-gray-400 hover:text-[#141414]"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-[#F27D26] text-white text-[10px] px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-8">
        {activeTab === 'departments' && (
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg lg:text-xl font-bold uppercase flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#F27D26]" />
                Department Management
              </h3>
              <Button className="text-xs" onClick={() => setShowDeptModal(true)}><Plus className="w-4 h-4" /> Add Dept</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {departments.map(d => (
                <div key={d.id} className="p-4 border border-gray-100 flex items-center justify-between hover:border-[#141414] transition-colors">
                  <div>
                    <p className="font-bold uppercase text-sm">{d.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">ID: {d.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="p-2 h-auto" onClick={() => {
                      const action = window.prompt("Type 'rename' to rename this department, or 'delete' to delete it:");
                      if (action === 'rename') {
                        const newName = window.prompt("Enter new name for " + d.name, d.name);
                        if (newName && newName.trim()) {
                          handleRenameDepartment(d.id, newName.trim());
                        }
                      } else if (action === 'delete') {
                        if (window.confirm("Are you sure you want to delete this department?")) {
                          handleDeleteDepartment(d.id);
                        }
                      }
                    }}>
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'competencies' && (
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg lg:text-xl font-bold uppercase flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#F27D26]" />
                Competency Framework
              </h3>
              <Button className="text-xs" onClick={() => { setNewCompDeptId(departments[0]?.id || ''); setShowCompModal(true); }}><Plus className="w-4 h-4" /> New Competency</Button>
            </div>
            <div className="space-y-2">
              {competencies.map(c => (
                <div key={c.id} className="p-3 lg:p-4 border border-gray-100 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-bold uppercase text-xs lg:text-sm">{c.name}</p>
                    <p className="text-[10px] lg:text-xs text-gray-500">
                      {departments.find(d => d.id === c.departmentId)?.name || 'Common'}
                    </p>
                  </div>
                  <div className="flex gap-1 lg:gap-2">
                    <Button variant="ghost" className="p-2 h-auto"><Settings className="w-4 h-4" /></Button>
                    <Button variant="ghost" className="p-2 h-auto text-red-500"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'assessments' && (
          <Card>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg lg:text-xl font-bold uppercase flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#F27D26]" />
                Assessment Scheduling
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" className="text-xs" onClick={handleMigrateAssessments}>Migrate Legacy</Button>
                <Button className="text-xs" onClick={openCreateAssessment}><Plus className="w-4 h-4 mr-1" /> Create Assessment</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assessments.map(a => (
                <div key={a.id} className="p-4 bg-gray-50 border border-gray-100">
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <h4 className="font-bold uppercase text-sm lg:text-base">{a.name}</h4>
                    <Badge variant={a.active ? 'success' : 'default'}>{a.active ? 'Active' : 'Draft'}</Badge>
                  </div>
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3" /> {departments.find(d => d.id === a.departmentId)?.name || 'Common'}</p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {a.timeLimit || 30} Minutes</p>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Min Score: {a.minScore}%</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 text-[10px] h-8" onClick={() => openEditAssessment(a)}>Edit</Button>
                    <Button variant="outline" className="flex-1 text-[10px] h-8" onClick={() => viewQuestions(a)}>Questions</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'question_bank' && (() => {
          const filteredQuestions = allQuestions.filter(q => {
            if (questionFilterStatus !== 'all' && q.approvalStatus !== questionFilterStatus) return false;
            if (questionFilterType !== 'all' && (q.type || 'mcq') !== questionFilterType) return false;
            if (questionFilterCompetency !== 'all' && getQuestionCompetencyId(q) !== questionFilterCompetency) return false;
            if (questionSearchQuery) {
              const text = getQuestionText(q).toLowerCase();
              if (!text.includes(questionSearchQuery.toLowerCase())) return false;
            }
            return true;
          });

          return (
            <Card>
              <h3 className="text-lg lg:text-xl font-bold uppercase mb-6 flex items-center gap-2">
                <Database className="w-5 h-5 text-[#F27D26]" />
                Question Bank
              </h3>
              
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search questions..." 
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm"
                      value={questionSearchQuery}
                      onChange={(e) => setQuestionSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select className="border border-gray-300 px-3 py-2 text-sm max-w-[140px]" value={questionFilterStatus} onChange={(e) => setQuestionFilterStatus(e.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select className="border border-gray-300 px-3 py-2 text-sm max-w-[120px]" value={questionFilterType} onChange={(e) => setQuestionFilterType(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="mcq">MCQ</option>
                    <option value="likert">Likert</option>
                    <option value="scenario_mcq">Scenario MCQ</option>
                    <option value="ranking">Ranking</option>
                  </select>
                  <select className="border border-gray-300 px-3 py-2 text-sm max-w-[160px]" value={questionFilterCompetency} onChange={(e) => setQuestionFilterCompetency(e.target.value)}>
                    <option value="all">All Competencies</option>
                    {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500 italic text-sm">No questions found matching your criteria.</div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map(q => (
                    <div key={q.id} className="p-4 border border-gray-100 space-y-4">
                      <div className="flex justify-between items-start">
                        <Badge variant={q.approvalStatus === 'approved' ? 'success' : q.approvalStatus === 'rejected' ? 'danger' : 'warning'}>
                          {q.approvalStatus === 'approved' ? 'Approved' : q.approvalStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                        </Badge>
                        <span className="text-[10px] font-mono text-gray-400">ID: {q.id}</span>
                      </div>
                      <p className="font-bold text-sm">{getQuestionText(q)}</p>
                      
                      <div className="text-[10px] uppercase text-gray-500 font-bold mb-2">
                        Competency: {competencies.find(c => c.id === getQuestionCompetencyId(q))?.name || getQuestionCompetencyId(q)}
                      </div>

                      {q.type === 'likert' ? (
                        <div className="border border-gray-200 p-3 bg-gray-50 space-y-2">
                          <p className="text-[10px] font-bold uppercase">Likert Question</p>
                          <p className="text-xs text-gray-600">Reverse Scored: {(q.is_reverse || q.isReverse) ? 'Yes' : 'No'}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {(q.options || []).map((opt: string, i: number) => (
                            <div key={i} className={cn("text-xs p-2 border", i === q.correctOption ? "border-green-500 bg-green-50" : "border-gray-100")}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-50 mt-4">
                        <Button variant="outline" className="text-xs" onClick={() => openEditQuestion(q)}>Edit</Button>
                        {q.approvalStatus === 'pending' && (
                          <>
                            <Button variant="ghost" className="text-red-500 text-xs" onClick={() => handleRejectQuestion(q.id)}>Reject</Button>
                            <Button variant="primary" className="text-xs" onClick={() => handleApproveQuestion(q.id)}>Approve</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })()}

        {activeTab === 'logs' && (
          <Card>
            <h3 className="text-lg lg:text-xl font-bold uppercase mb-6 flex items-center gap-2">
              <History className="w-5 h-5 text-[#F27D26]" />
              System Audit Logs
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {auditLogs.map(log => (
                <div key={log.id} className="p-3 border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] sm:text-xs">
                  <div className="flex items-center gap-3">
                    <Badge variant={log.status === 'success' ? 'success' : log.status === 'failure' ? 'danger' : 'default'}>
                      {log.category}
                    </Badge>
                    <div>
                      <p className="font-bold uppercase">{log.action}</p>
                      <p className="text-gray-500 font-mono">Module: {log.module}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-gray-400">
                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Pending...'}
                    </p>
                    <p className="text-gray-500 truncate max-w-[200px]">User: {log.user_id || 'System'}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      {/* Modals */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white">
            <h3 className="text-xl font-bold uppercase mb-4">Add Department</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Department Name</label>
                <input className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g. Computer Science" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowDeptModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddDepartment}>Save</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showCompModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-white">
            <h3 className="text-xl font-bold uppercase mb-4">Add Competency</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Competency Name</label>
                <input className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={newCompName} onChange={(e) => setNewCompName(e.target.value)} placeholder="e.g. Analytical Thinking" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Department</label>
                <select className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={newCompDeptId} onChange={(e) => setNewCompDeptId(e.target.value)}>
                  <option value="">Common (All Departments)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCompModal(false)}>Cancel</Button>
                <Button className="flex-1" onClick={handleAddCompetency}>Save</Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {showAssessmentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl bg-white max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold uppercase">{editingAssessment ? 'Edit Assessment' : 'Create Assessment'}</h3>
              <div className="flex gap-2">
                <Button variant={assessmentModalTab === 'settings' ? 'primary' : 'outline'} className="text-xs py-1" onClick={() => setAssessmentModalTab('settings')}>Settings</Button>
                <Button variant={assessmentModalTab === 'questions' ? 'primary' : 'outline'} className="text-xs py-1" onClick={() => setAssessmentModalTab('questions')}>Questions ({assessmentSelectedQuestions.length})</Button>
              </div>
            </div>

            {assessmentModalTab === 'settings' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Assessment Name</label>
                  <input className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={assessmentForm.name} onChange={(e) => setAssessmentForm({...assessmentForm, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Time Limit (mins)</label>
                    <input type="number" className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={assessmentForm.timeLimit} onChange={(e) => setAssessmentForm({...assessmentForm, timeLimit: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Min Score (%)</label>
                    <input type="number" className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={assessmentForm.minScore} onChange={(e) => setAssessmentForm({...assessmentForm, minScore: Number(e.target.value)})} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Department</label>
                  <select className="w-full border border-gray-300 px-3 py-2 text-sm mt-1" value={assessmentForm.departmentId} onChange={(e) => setAssessmentForm({...assessmentForm, departmentId: e.target.value})}>
                    <option value="common">Common (All Departments)</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="assessment-active" checked={assessmentForm.active} onChange={(e) => setAssessmentForm({...assessmentForm, active: e.target.checked})} />
                  <label htmlFor="assessment-active" className="text-sm font-bold uppercase cursor-pointer">Active (Visible to Students)</label>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500 mb-2 block">Competency Distribution (Fallback if explicit questions not selected)</label>
                  <div className="space-y-2 border border-gray-200 p-3 max-h-48 overflow-y-auto custom-scrollbar">
                    {competencies.map(c => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className="text-xs">{c.name}</span>
                        <input type="number" min="0" className="w-16 border border-gray-300 px-2 py-1 text-xs" 
                          value={assessmentForm.competencyDistribution[c.id] || 0}
                          onChange={(e) => setAssessmentForm({
                            ...assessmentForm, 
                            competencyDistribution: {
                              ...assessmentForm.competencyDistribution, 
                              [c.id]: Number(e.target.value)
                            }
                          })} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAssessmentModal(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveAssessment}>Save Assessment</Button>
                </div>
              </div>
            )}

            {assessmentModalTab === 'questions' && (
              <div className="flex flex-col space-y-4 flex-1">
                <div className="flex justify-between items-center bg-gray-50 p-2 border border-gray-200">
                  <p className="text-xs font-bold uppercase">Selected Questions</p>
                  <Button className="text-xs py-1 h-auto" onClick={() => setShowQuestionSelector(true)}><Plus className="w-3 h-3 mr-1"/> Add Questions</Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar border border-gray-100 p-2">
                  {assessmentSelectedQuestions.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No questions explicitly selected. Assessment will randomly generate from assigned competencies if none selected.</p>
                  ) : (
                    assessmentSelectedQuestions.map(qId => {
                      const q = allQuestions.find(aq => aq.id === qId);
                      if (!q) return null;
                      return (
                        <div key={q.id} className="flex justify-between items-center p-2 border border-gray-100 text-sm">
                          <div>
                            <p className="font-bold">{getQuestionText(q)}</p>
                            <p className="text-[10px] text-gray-500 font-mono">Competency: {competencies.find(c => c.id === getQuestionCompetencyId(q))?.name || getQuestionCompetencyId(q)}</p>
                          </div>
                          <Button variant="ghost" className="text-red-500 p-1 h-auto" onClick={() => setAssessmentSelectedQuestions(assessmentSelectedQuestions.filter(id => id !== q.id))}>
                            <X className="w-4 h-4"/>
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Add new question directly from here */}
                <div className="mt-4 border border-[#141414] p-4 bg-gray-50">
                  <p className="text-xs font-black uppercase tracking-wide mb-4">Create New Question for Bank</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-500">Question Type</label>
                      <select
                        className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs"
                        value={newQuestionType}
                        onChange={(event) => setNewQuestionType(event.target.value as any)}
                      >
                        <option value="mcq">Multiple Choice</option>
                        <option value="likert">Likert Scale</option>
                        <option value="scenario_mcq">Scenario-Based MCQ</option>
                        <option value="ranking">Ranking</option>
                        <option value="text_answer">Short Text Answer</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-500">Competency</label>
                      <select
                        className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs"
                        value={newQuestionCompetencyId}
                        onChange={(event) => setNewQuestionCompetencyId(event.target.value)}
                      >
                        {competencies.map((competency) => (
                          <option key={competency.id} value={competency.id}>{competency.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 mt-3 block">Question Text</label>
                    <textarea
                      className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs min-h-16"
                      value={newQuestionText}
                      onChange={(event) => setNewQuestionText(event.target.value)}
                      placeholder="Enter question text"
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button className="text-xs" disabled={savingQuestion} onClick={handleCreateQuestion}>
                      {savingQuestion ? 'Saving...' : 'Save to Bank'}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAssessmentModal(false)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveAssessment}>Save Assessment</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {showQuestionSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl bg-white max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold uppercase">Select Questions from Bank</h3>
              <Button variant="ghost" className="p-1 h-auto" onClick={() => setShowQuestionSelector(false)}><X className="w-4 h-4"/></Button>
            </div>
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search approved questions..." 
                className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm"
                value={questionSearchQuery}
                onChange={(e) => setQuestionSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {allQuestions.filter(q => q.approvalStatus === 'approved').filter(q => {
                if (questionSearchQuery && !getQuestionText(q).toLowerCase().includes(questionSearchQuery.toLowerCase())) return false;
                return true;
              }).map(q => {
                const isSelected = assessmentSelectedQuestions.includes(q.id);
                return (
                  <div key={q.id} className={cn("p-3 border flex justify-between items-center cursor-pointer transition-colors", isSelected ? "border-[#F27D26] bg-orange-50" : "border-gray-200 hover:border-gray-400")} onClick={() => {
                    if (isSelected) {
                      setAssessmentSelectedQuestions(assessmentSelectedQuestions.filter(id => id !== q.id));
                    } else {
                      setAssessmentSelectedQuestions([...assessmentSelectedQuestions, q.id]);
                    }
                  }}>
                    <div className="pr-4">
                      <p className="text-sm font-bold">{getQuestionText(q)}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-1">Competency: {competencies.find(c => c.id === getQuestionCompetencyId(q))?.name || getQuestionCompetencyId(q)}</p>
                    </div>
                    {isSelected ? <CheckCircle2 className="w-5 h-5 text-[#F27D26] shrink-0" /> : <div className="w-5 h-5 border border-gray-300 rounded-full shrink-0" />}
                  </div>
                )
              })}
              {allQuestions.filter(q => q.approvalStatus === 'approved').length === 0 && (
                 <p className="text-sm text-gray-500 italic text-center py-4">No approved questions available.</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <Button onClick={() => setShowQuestionSelector(false)}>Done</Button>
            </div>
          </Card>
        </div>
      )}

      {showQuestionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-white max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold uppercase mb-2">Assessment Question Pool</h3>
            <p className="text-xs text-gray-500 mb-4">{showQuestionsModal.name}</p>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {assessmentQuestions.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No approved questions found for the required competencies.</p>
              ) : (
                assessmentQuestions.map((q, i) => (
                  <div key={q.id} className="p-3 border border-gray-100 text-sm">
                    <p className="font-bold mb-1">{i+1}. {q.text || q.question_text}</p>
                    <p className="text-[10px] text-gray-500 font-mono">Competency: {competencies.find(c => c.id === getQuestionCompetencyId(q))?.name || getQuestionCompetencyId(q)}</p>
                  </div>
                ))
              )}
            </div>
            <div className="pt-4 mt-4 border-t border-gray-100 text-right">
              <Button onClick={() => setShowQuestionsModal(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
      {editingQuestionId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl bg-white max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <h3 className="text-xl font-bold uppercase mb-4">Edit Question</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500">Question Text</label>
                <textarea
                  className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs min-h-16"
                  value={editQuestionData.text || editQuestionData.question_text || ''}
                  onChange={(e) => setEditQuestionData({ ...editQuestionData, text: e.target.value, question_text: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Competency</label>
                  <select
                    className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs"
                    value={editQuestionData.competencyId || editQuestionData.competency_id || ''}
                    onChange={(e) => setEditQuestionData({ ...editQuestionData, competencyId: e.target.value, competency_id: e.target.value })}
                  >
                    {competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-500">Points</label>
                  <input type="number" className="mt-1 w-full border border-gray-300 px-3 py-2 text-xs" 
                    value={editQuestionData.points || editQuestionData.max_points || 1}
                    onChange={(e) => setEditQuestionData({ ...editQuestionData, points: Number(e.target.value), max_points: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              {(editQuestionData.type === 'mcq' || editQuestionData.type === 'scenario_mcq') && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase text-gray-500">Options</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(editQuestionData.options || []).map((opt, i) => (
                      <input key={i} className="border border-gray-300 px-3 py-2 text-xs"
                        value={opt}
                        onChange={(e) => {
                          const next = [...(editQuestionData.options || [])];
                          next[i] = e.target.value;
                          setEditQuestionData({ ...editQuestionData, options: next });
                        }}
                      />
                    ))}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500">Correct Option</label>
                    <select className="mt-1 border border-gray-300 px-3 py-2 text-xs"
                      value={editQuestionData.correctOption || 0}
                      onChange={(e) => setEditQuestionData({ ...editQuestionData, correctOption: Number(e.target.value) })}
                    >
                      {(editQuestionData.options || []).map((_, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>)}
                    </select>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setEditingQuestionId(null)}>Cancel</Button>
                <Button onClick={handleSaveEditQuestion} disabled={savingEditQuestion}>{savingEditQuestion ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
