import { User as AppUser, Role } from './types';

// ============================================================================
// Types & Mock Interfaces
// ============================================================================
export interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

// Helper to interact with LocalStorage
const getStorageData = (key: string): Record<string, any> => {
  const data = localStorage.getItem(`mock_firebase_${key}`);
  return data ? JSON.parse(data) : {};
};

const setStorageData = (key: string, data: Record<string, any>) => {
  localStorage.setItem(`mock_firebase_${key}`, JSON.stringify(data));
};

// ============================================================================
// Firebase Auth Mock
// ============================================================================
class MockAuth {
  private listeners: ((user: MockUser | null) => void)[] = [];
  public currentUser: MockUser | null = null;

  constructor() {
    // Restore auth state from session/local storage if available
    const savedUser = localStorage.getItem('mock_firebase_auth_user');
    if (savedUser) {
      this.currentUser = JSON.parse(savedUser);
    }
  }

  onAuthStateChanged(callback: (user: MockUser | null) => void) {
    this.listeners.push(callback);
    // Trigger immediately with current state
    setTimeout(() => callback(this.currentUser), 0);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  triggerStateChange() {
    localStorage.setItem('mock_firebase_auth_user', this.currentUser ? JSON.stringify(this.currentUser) : '');
    this.listeners.forEach(callback => callback(this.currentUser));
  }

  async signInWithPopup() {
    // Fake Google Auth popup: logs in a default admin user for convenience
    this.currentUser = {
      uid: 'google_user_123',
      email: 'debashish.pranjal@gmail.com',
      displayName: 'Debashish Pranjal',
      emailVerified: true
    };
    this.triggerStateChange();
    return { user: this.currentUser };
  }

  async signInAnonymously() {
    this.currentUser = {
      uid: `anon_${Date.now()}`,
      email: null,
      displayName: 'Anonymous User',
      emailVerified: false
    };
    this.triggerStateChange();
    return { user: this.currentUser };
  }

  async signOut() {
    this.currentUser = null;
    this.triggerStateChange();
  }
}

export const auth = new MockAuth();
export const googleProvider = {};

export const onAuthStateChanged = (authObj: MockAuth, callback: (user: MockUser | null) => void) => {
  return authObj.onAuthStateChanged(callback);
};

export const signInWithPopup = async (authObj: MockAuth, provider: any) => {
  return authObj.signInWithPopup();
};

export const signInAnonymously = async (authObj: MockAuth) => {
  return authObj.signInAnonymously();
};

export const signOut = async (authObj: MockAuth) => {
  return authObj.signOut();
};

// ============================================================================
// Firebase Firestore Mock
// ============================================================================
export const db = {};

export class MockDocRef {
  constructor(public collectionName: string, public docId: string) {}
}

export class MockCollectionRef {
  constructor(public collectionName: string) {}
}

export interface WhereConstraint {
  type: 'where';
  field: string;
  op: string;
  val: any;
}

export class MockQuery {
  constructor(public collectionRef: MockCollectionRef, public constraints: WhereConstraint[]) {}
}

export class MockDocSnapshot {
  constructor(public id: string, private dataVal: any) {}
  exists() {
    return this.dataVal !== undefined && this.dataVal !== null;
  }
  data() {
    return this.dataVal;
  }
}

export class MockQuerySnapshot {
  constructor(public docs: MockDocSnapshot[]) {}
}

// Reference builders
export const doc = (dbObj: any, collectionName: string, docId: string) => {
  return new MockDocRef(collectionName, docId);
};

export const collection = (dbObj: any, collectionName: string) => {
  return new MockCollectionRef(collectionName);
};

export const where = (field: string, op: string, val: any): WhereConstraint => {
  return { type: 'where', field, op, val };
};

export const query = (collectionRef: MockCollectionRef, ...constraints: WhereConstraint[]) => {
  return new MockQuery(collectionRef, constraints);
};

// Real-time listener management
type FirestoreListener = {
  ref: MockDocRef | MockCollectionRef | MockQuery;
  callback: (snapshot: any) => void;
};
let firestoreListeners: FirestoreListener[] = [];

const notifyListeners = (collectionName: string) => {
  firestoreListeners.forEach(listener => {
    if (listener.ref instanceof MockDocRef && listener.ref.collectionName === collectionName) {
      const data = getStorageData(collectionName);
      const snapshot = new MockDocSnapshot(listener.ref.docId, data[listener.ref.docId]);
      listener.callback(snapshot);
    } else if (listener.ref instanceof MockCollectionRef && listener.ref.collectionName === collectionName) {
      const data = getStorageData(collectionName);
      const docs = Object.entries(data).map(([id, val]) => new MockDocSnapshot(id, val));
      listener.callback(new MockQuerySnapshot(docs));
    } else if (listener.ref instanceof MockQuery && listener.ref.collectionRef.collectionName === collectionName) {
      const docs = applyQueryConstraints(collectionName, listener.ref.constraints);
      const snapshots = docs.map(d => new MockDocSnapshot(d.id, d));
      listener.callback(new MockQuerySnapshot(snapshots));
    }
  });
};

const applyQueryConstraints = (collectionName: string, constraints: WhereConstraint[]): any[] => {
  const data = getStorageData(collectionName);
  let docs = Object.entries(data).map(([id, val]) => ({ id, ...val }));

  constraints.forEach(c => {
    const { field, op, val } = c;
    docs = docs.filter(doc => {
      const docVal = doc[field];
      if (op === '==') return docVal === val;
      if (op === '!=') return docVal !== val;
      if (op === '>') return docVal > val;
      if (op === '>=') return docVal >= val;
      if (op === '<') return docVal < val;
      if (op === '<=') return docVal <= val;
      return true;
    });
  });

  return docs;
};

// Document operations
export const getDoc = async (docRef: MockDocRef): Promise<MockDocSnapshot> => {
  const data = getStorageData(docRef.collectionName);
  return new MockDocSnapshot(docRef.docId, data[docRef.docId]);
};

export const setDoc = async (docRef: MockDocRef, data: any, options?: { merge?: boolean }) => {
  const currentCollection = getStorageData(docRef.collectionName);
  if (options?.merge) {
    currentCollection[docRef.docId] = {
      ...(currentCollection[docRef.docId] || {}),
      ...data
    };
  } else {
    currentCollection[docRef.docId] = data;
  }
  setStorageData(docRef.collectionName, currentCollection);
  setTimeout(() => notifyListeners(docRef.collectionName), 0);
};

export const addDoc = async (collectionRef: MockCollectionRef, data: any): Promise<MockDocRef> => {
  const id = `${collectionRef.collectionName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const currentCollection = getStorageData(collectionRef.collectionName);
  currentCollection[id] = data;
  setStorageData(collectionRef.collectionName, currentCollection);
  setTimeout(() => notifyListeners(collectionRef.collectionName), 0);
  return new MockDocRef(collectionRef.collectionName, id);
};

export const getDocs = async (queryObj: MockQuery | MockCollectionRef): Promise<MockQuerySnapshot> => {
  if (queryObj instanceof MockCollectionRef) {
    const data = getStorageData(queryObj.collectionName);
    const docs = Object.entries(data).map(([id, val]) => new MockDocSnapshot(id, val));
    return new MockQuerySnapshot(docs);
  } else {
    const docs = applyQueryConstraints(queryObj.collectionRef.collectionName, queryObj.constraints);
    const snapshots = docs.map(d => new MockDocSnapshot(d.id, d));
    return new MockQuerySnapshot(snapshots);
  }
};

export const onSnapshot = (
  ref: MockDocRef | MockCollectionRef | MockQuery,
  callback: (snapshot: any) => void,
  errorCallback?: (error: any) => void
) => {
  firestoreListeners.push({ ref, callback });

  // Initial trigger
  setTimeout(() => {
    try {
      if (ref instanceof MockDocRef) {
        const data = getStorageData(ref.collectionName);
        callback(new MockDocSnapshot(ref.docId, data[ref.docId]));
      } else if (ref instanceof MockCollectionRef) {
        const data = getStorageData(ref.collectionName);
        const docs = Object.entries(data).map(([id, val]) => new MockDocSnapshot(id, val));
        callback(new MockQuerySnapshot(docs));
      } else if (ref instanceof MockQuery) {
        const docs = applyQueryConstraints(ref.collectionRef.collectionName, ref.constraints);
        const snapshots = docs.map(d => new MockDocSnapshot(d.id, d));
        callback(new MockQuerySnapshot(snapshots));
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  }, 0);

  return () => {
    firestoreListeners = firestoreListeners.filter(l => l.ref !== ref || l.callback !== callback);
  };
};

// Batch operations
class MockWriteBatch {
  private ops: { docRef: MockDocRef; data: any; options?: { merge?: boolean } }[] = [];

  set(docRef: MockDocRef, data: any, options?: { merge?: boolean }) {
    this.ops.push({ docRef, data, options });
  }

  async commit() {
    const modifiedCollections = new Set<string>();
    this.ops.forEach(({ docRef, data, options }) => {
      const currentCollection = getStorageData(docRef.collectionName);
      if (options?.merge) {
        currentCollection[docRef.docId] = {
          ...(currentCollection[docRef.docId] || {}),
          ...data
        };
      } else {
        currentCollection[docRef.docId] = data;
      }
      setStorageData(docRef.collectionName, currentCollection);
      modifiedCollections.add(docRef.collectionName);
    });

    // Notify listeners
    modifiedCollections.forEach(colName => {
      notifyListeners(colName);
    });
  }
}

export const writeBatch = (dbObj: any) => {
  return new MockWriteBatch();
};

export const serverTimestamp = () => {
  return new Date().toISOString();
};
