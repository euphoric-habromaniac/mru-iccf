const mockLocalStorage: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => mockLocalStorage[key] || null,
  setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
  removeItem: (key: string) => { delete mockLocalStorage[key]; },
  clear: () => {
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
  },
  length: 0,
  key: (index: number) => Object.keys(mockLocalStorage)[index] || null,
};
