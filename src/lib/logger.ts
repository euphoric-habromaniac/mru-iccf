import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export type LogCategory = 'AUTH_LOG' | 'ASSESSMENT_LOG' | 'DATABASE_LOG' | 'SECURITY_LOG' | 'ADMIN_ACTION_LOG' | 'ERROR_LOG';

export interface LogEntry {
  timestamp: any;
  user_id: string | null;
  category: LogCategory;
  action: string;
  module: string;
  status: 'success' | 'failure' | 'info';
  metadata: Record<string, any>;
}

class Logger {
  private async writeToFirestore(entry: Omit<LogEntry, 'timestamp'>) {
    try {
      await addDoc(collection(db, 'logs'), {
        ...entry,
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to write log to Firestore:', error);
    }
  }

  log(category: LogCategory, action: string, module: string, status: 'success' | 'failure' | 'info', metadata: Record<string, any> = {}) {
    const userId = auth.currentUser?.uid || null;
    const entry = {
      user_id: userId,
      category,
      action,
      module,
      status,
      metadata,
    };

    // Console logging for development
    const consoleMethod = status === 'failure' ? 'error' : status === 'info' ? 'info' : 'log';
    console[consoleMethod](`[${category}] ${action} (${module}):`, entry);

    // Persist to Firestore
    this.writeToFirestore(entry);
  }

  auth(action: string, status: 'success' | 'failure', metadata: Record<string, any> = {}) {
    this.log('AUTH_LOG', action, 'auth_module', status, metadata);
  }

  assessment(action: string, status: 'success' | 'failure' | 'info', metadata: Record<string, any> = {}) {
    this.log('ASSESSMENT_LOG', action, 'assessment_engine', status, metadata);
  }

  database(action: string, status: 'success' | 'failure', metadata: Record<string, any> = {}) {
    this.log('DATABASE_LOG', action, 'database_module', status, metadata);
  }

  security(action: string, status: 'success' | 'failure', metadata: Record<string, any> = {}) {
    this.log('SECURITY_LOG', action, 'security_module', status, metadata);
  }

  admin(action: string, status: 'success' | 'failure', metadata: Record<string, any> = {}) {
    this.log('ADMIN_ACTION_LOG', action, 'admin_module', status, metadata);
  }

  error(action: string, metadata: Record<string, any> = {}) {
    this.log('ERROR_LOG', action, 'error_handler', 'failure', metadata);
  }
}

export const logger = new Logger();
