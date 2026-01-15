import { describe, it, expect } from 'vitest';
import { 
  validateWebPathFormat, 
  ensureWebPathFormat, 
  validateDatabasePaths 
} from '../image-paths.server';

describe('Path Validation Functions', () => {
  describe('validateWebPathFormat', () => {
    it('should accept valid web paths', () => {
      expect(validateWebPathFormat('/screenshots/shop1/baseline/run1/page.png')).toBe(true);
      expect(validateWebPathFormat('/screenshots/shop1/runs/run1/page.png')).toBe(true);
      expect(validateWebPathFormat('/screenshots/shop1/diffs/run1_vs_run2/page.png')).toBe(true);
    });

    it('should reject filesystem paths', () => {
      expect(validateWebPathFormat('/home/user/project/public/screenshots/page.png')).toBe(false);
      expect(validateWebPathFormat('C:\\Users\\project\\public\\screenshots\\page.png')).toBe(false);
    });

    it('should reject relative paths', () => {
      expect(validateWebPathFormat('screenshots/shop1/page.png')).toBe(false);
      expect(validateWebPathFormat('public/screenshots/page.png')).toBe(false);
    });

    it('should reject paths with backslashes', () => {
      expect(validateWebPathFormat('/screenshots\\shop1\\page.png')).toBe(false);
    });
  });

  describe('ensureWebPathFormat', () => {
    it('should not throw for valid web paths', () => {
      expect(() => ensureWebPathFormat('/screenshots/shop1/baseline/run1/page.png')).not.toThrow();
    });

    it('should throw for invalid paths', () => {
      expect(() => ensureWebPathFormat('screenshots/shop1/page.png')).toThrow();
      expect(() => ensureWebPathFormat('/home/user/project/public/screenshots/page.png')).toThrow();
    });

    it('should include context in error message', () => {
      expect(() => ensureWebPathFormat('invalid/path', 'test path')).toThrow('test path');
    });
  });

  describe('validateDatabasePaths', () => {
    it('should not throw for all valid paths', () => {
      const paths = [
        { path: '/screenshots/shop1/baseline/run1/page1.png', context: 'page1' },
        { path: '/screenshots/shop1/runs/run2/page2.png', context: 'page2' },
        { path: '/screenshots/shop1/diffs/run1_vs_run2/page3.png', context: 'page3' }
      ];
      
      expect(() => validateDatabasePaths(paths)).not.toThrow();
    });

    it('should throw for any invalid paths', () => {
      const paths = [
        { path: '/screenshots/shop1/baseline/run1/page1.png', context: 'page1' },
        { path: 'invalid/path', context: 'page2' },
        { path: '/screenshots/shop1/runs/run2/page3.png', context: 'page3' }
      ];
      
      expect(() => validateDatabasePaths(paths)).toThrow();
    });

    it('should include all invalid paths in error message', () => {
      const paths = [
        { path: 'invalid/path1', context: 'page1' },
        { path: 'invalid/path2', context: 'page2' }
      ];
      
      expect(() => validateDatabasePaths(paths)).toThrow('page1');
      expect(() => validateDatabasePaths(paths)).toThrow('page2');
    });
  });
});