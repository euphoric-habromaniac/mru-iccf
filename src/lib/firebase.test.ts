import './setupTests';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { 
  auth, 
  doc, 
  collection, 
  where, 
  query, 
  setDoc, 
  getDoc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  writeBatch 
} from '../mockFirebase';

describe('Firebase Connection & Operations Simulation Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    auth.currentUser = null;
    // Drain any pending asynchronous timers from previous tests
    await new Promise(resolve => setTimeout(resolve, 15));
  });

  describe('Authentication Actions', () => {
    it('should initialize auth with no logged-in user', () => {
      expect(auth.currentUser).toBeNull();
    });

    it('should set current user on popup sign in', async () => {
      const result = await auth.signInWithPopup();
      expect(result.user).not.toBeNull();
      expect(result.user?.email).toBe('debashish.pranjal@gmail.com');
      expect(auth.currentUser?.uid).toBe('google_user_123');
    });

    it('should allow anonymous sign in', async () => {
      const result = await auth.signInAnonymously();
      expect(result.user?.uid).toContain('anon_');
      expect(result.user?.displayName).toBe('Anonymous User');
    });

    it('should clear user on sign out', async () => {
      await auth.signInWithPopup();
      expect(auth.currentUser).not.toBeNull();
      await auth.signOut();
      expect(auth.currentUser).toBeNull();
    });
  });

  describe('Firestore Document Actions', () => {
    it('should write and read user documents successfully', async () => {
      const userRef = doc(null, 'users', 'student_123');
      const testData = {
        name: 'Test Student',
        email: 'test@mru.ac.in',
        role: 'student',
        password: 'password123'
      };

      await setDoc(userRef, testData);

      const snapshot = await getDoc(userRef);
      expect(snapshot.exists()).toBe(true);
      expect(snapshot.data()).toEqual(testData);
    });

    it('should support addDoc for collection appending', async () => {
      const attemptsCol = collection(null, 'attempts');
      const attemptData = {
        userId: 'student_123',
        assessmentId: 'assess_1',
        overallScore: 85,
        timestamp: new Date().toISOString()
      };

      const docRef = await addDoc(attemptsCol, attemptData);
      expect(docRef.collectionName).toBe('attempts');
      expect(docRef.docId).not.toBeNull();

      const snapshot = await getDoc(docRef);
      expect(snapshot.exists()).toBe(true);
      expect(snapshot.data().overallScore).toBe(85);
    });
  });

  describe('Firestore Batch & Query Actions', () => {
    it('should execute writeBatch correctly', async () => {
      const batch = writeBatch(null);
      const doc1 = doc(null, 'users', 'student_a');
      const doc2 = doc(null, 'users', 'student_b');

      batch.set(doc1, { name: 'Student A' });
      batch.set(doc2, { name: 'Student B' });
      await batch.commit();

      const snap1 = await getDoc(doc1);
      const snap2 = await getDoc(doc2);
      expect(snap1.data().name).toBe('Student A');
      expect(snap2.data().name).toBe('Student B');
    });

    it('should perform queries with where constraints', async () => {
      const userCol = collection(null, 'users');
      await setDoc(doc(null, 'users', 'u1'), { email: 'abc@mru.ac.in', role: 'student' });
      await setDoc(doc(null, 'users', 'u2'), { email: 'xyz@mru.ac.in', role: 'dept_head' });

      // Drain the setDoc notify timers first
      await new Promise(resolve => setTimeout(resolve, 15));

      const q = query(userCol, where('role', '==', 'dept_head'));
      const querySnap = await getDocs(q);

      expect(querySnap.docs.length).toBe(1);
      expect(querySnap.docs[0].data().email).toBe('xyz@mru.ac.in');
    });

    it('should notify real-time listeners onSnapshot', async () => {
      const userRef = doc(null, 'users', 'realtime_user');
      const listenerCallback = vi.fn();

      const unsubscribe = onSnapshot(userRef, listenerCallback);

      // Wait for initial trigger
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(listenerCallback).toHaveBeenCalledTimes(1);

      await setDoc(userRef, { name: 'Updated Name' });
      // Wait for notify trigger
      await new Promise(resolve => setTimeout(resolve, 15));

      expect(listenerCallback).toHaveBeenCalledTimes(2);
      expect(listenerCallback.mock.calls[1][0].data().name).toBe('Updated Name');

      unsubscribe();
    });
  });
});
