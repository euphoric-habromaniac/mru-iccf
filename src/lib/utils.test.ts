import { describe, it, expect } from 'vitest';
import { generateRandomPassword, parseCsvOrTsv, mapStudentRow, mapTeacherRow } from './utils';

describe('Utility Unit Tests', () => {
  describe('generateRandomPassword', () => {
    it('generates an 8-character alphanumeric string', () => {
      const pwd = generateRandomPassword();
      expect(pwd).toHaveLength(8);
      expect(/^[A-Za-z0-9]+$/.test(pwd)).toBe(true);
    });

    it('generates distinct values sequentially', () => {
      const pwd1 = generateRandomPassword();
      const pwd2 = generateRandomPassword();
      expect(pwd1).not.toBe(pwd2);
    });
  });

  describe('parseCsvOrTsv', () => {
    it('parses standard comma-separated lines correctly', () => {
      const csvText = 'Name,Email,Roll\nJohn Doe,john@mru.ac.in,2K21CSE01\nJane,jane@mru.ac.in,2K21CSE02';
      const result = parseCsvOrTsv(csvText, false);
      expect(result.headers).toEqual(['name', 'email', 'roll']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('John Doe');
      expect(result.rows[0].email).toBe('john@mru.ac.in');
      expect(result.rows[0].roll).toBe('2K21CSE01');
    });

    it('parses tab-separated lines correctly', () => {
      const tsvText = 'Name\tEmail\tRoll\nJohn\tjohn@mru.ac.in\t2K21\n';
      const result = parseCsvOrTsv(tsvText, true);
      expect(result.headers).toEqual(['name', 'email', 'roll']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('John');
    });
  });

  describe('Row Mappers', () => {
    const mockDepts = [{ id: 'CSE', name: 'Computer Science' }];

    it('maps student columns case-insensitively with defaults', () => {
      const csvRow = {
        name: 'Jane Doe',
        rollno: '2K21CSE02',
        emailid: 'jane@mru.ac.in',
        department: 'CSE'
      };
      const result = mapStudentRow(csvRow, mockDepts);
      expect(result.name).toBe('Jane Doe');
      expect(result.rollNumber).toBe('2K21CSE02');
      expect(result.email).toBe('jane@mru.ac.in');
      expect(result.department).toBe('CSE');
      expect(result.password).toHaveLength(8);
    });
  });
});
