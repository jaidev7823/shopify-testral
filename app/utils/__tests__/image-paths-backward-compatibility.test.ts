import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  isOldStructure,
  resolveOldPathToFilesystem,
  resolvePathWithFallback,
  getAllPossiblePaths,
  findImageFile,
} from '../image-paths.server';

// Mock filesystem operations
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
  },
}));

describe('Backward Compatibility Path Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOldStructure', () => {
    it('should identify new structure paths as not old', () => {
      expect(isOldStructure('/screenshots/shop1/baseline/run1/page1.png')).toBe(false);
      expect(isOldStructure('/screenshots/shop1/runs/run1/page1.png')).toBe(false);
      expect(isOldStructure('/screenshots/shop1/diffs/run1_vs_run2/page1.png')).toBe(false);
    });

    it('should identify old structure paths correctly', () => {
      expect(isOldStructure('/old/path/image.png')).toBe(true);
      expect(isOldStructure('/screenshots/old-format.png')).toBe(true);
      expect(isOldStructure('relative/path/image.png')).toBe(true);
      expect(isOldStructure('/absolute/path/image.png')).toBe(true);
    });
  });

  describe('resolveOldPathToFilesystem', () => {
    it('should handle absolute filesystem paths', () => {
      const absolutePath = path.join(process.cwd(), 'public', 'images', 'test.png');
      expect(resolveOldPathToFilesystem(absolutePath)).toBe(absolutePath);
    });

    it('should handle relative paths', () => {
      const relativePath = 'relative/path/image.png';
      const expected = path.join(process.cwd(), 'public', relativePath);
      expect(resolveOldPathToFilesystem(relativePath)).toBe(expected);
    });

    it('should handle web paths starting with slash', () => {
      const webPath = '/old/path/image.png';
      const expected = path.join(process.cwd(), 'public', 'old/path/image.png');
      expect(resolveOldPathToFilesystem(webPath)).toBe(expected);
    });

    it('should handle old screenshots paths', () => {
      const oldScreenshotsPath = '/screenshots/old-format.png';
      const expected = path.join(process.cwd(), 'public', 'screenshots/old-format.png');
      expect(resolveOldPathToFilesystem(oldScreenshotsPath)).toBe(expected);
    });
  });

  describe('getAllPossiblePaths', () => {
    it('should return multiple possible paths for old structure', () => {
      const oldPath = '/old/path/image.png';
      const possiblePaths = getAllPossiblePaths(oldPath);
      
      expect(possiblePaths.length).toBeGreaterThan(1);
      expect(possiblePaths).toContain(path.join(process.cwd(), 'public', 'old/path/image.png'));
      expect(possiblePaths).toContain(path.join(process.cwd(), 'public', 'screenshots', 'old/path/image.png'));
    });

    it('should include new structure path when applicable', () => {
      const newPath = '/screenshots/shop1/baseline/run1/page1.png';
      const possiblePaths = getAllPossiblePaths(newPath);
      
      expect(possiblePaths).toContain(path.join(process.cwd(), 'public', 'screenshots/shop1/baseline/run1/page1.png'));
    });

    it('should remove duplicate paths', () => {
      const testPath = '/test/path/image.png';
      const possiblePaths = getAllPossiblePaths(testPath);
      
      // Check that there are no duplicates
      const uniquePaths = [...new Set(possiblePaths)];
      expect(possiblePaths.length).toBe(uniquePaths.length);
    });
  });

  describe('resolvePathWithFallback', () => {
    it('should resolve new structure paths correctly', async () => {
      const newPath = '/screenshots/shop1/baseline/run1/page1.png';
      (fs.access as any).mockResolvedValue(undefined); // File exists
      
      const result = await resolvePathWithFallback(newPath);
      
      expect(result.isNewStructure).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.resolvedPath).toBe(path.join(process.cwd(), 'public', 'screenshots/shop1/baseline/run1/page1.png'));
    });

    it('should resolve old structure paths correctly', async () => {
      const oldPath = '/old/path/image.png';
      (fs.access as any).mockResolvedValue(undefined); // File exists
      
      const result = await resolvePathWithFallback(oldPath);
      
      expect(result.isNewStructure).toBe(false);
      expect(result.exists).toBe(true);
      expect(result.resolvedPath).toBe(path.join(process.cwd(), 'public', 'old/path/image.png'));
    });

    it('should handle non-existent files', async () => {
      const nonExistentPath = '/non/existent/image.png';
      (fs.access as any).mockRejectedValue(new Error('File not found'));
      
      const result = await resolvePathWithFallback(nonExistentPath);
      
      expect(result.exists).toBe(false);
      expect(result.resolvedPath).toBe(path.join(process.cwd(), 'public', 'non/existent/image.png'));
    });
  });

  describe('findImageFile', () => {
    it('should find existing files at first possible location', async () => {
      const testPath = '/test/image.png';
      (fs.access as any).mockResolvedValueOnce(undefined); // First path exists
      
      const result = await findImageFile(testPath);
      
      expect(result.foundPath).not.toBeNull();
      expect(result.checkedPaths.length).toBeGreaterThan(0);
    });

    it('should return null when no file is found', async () => {
      const testPath = '/non/existent/image.png';
      (fs.access as any).mockRejectedValue(new Error('File not found'));
      
      const result = await findImageFile(testPath);
      
      expect(result.foundPath).toBeNull();
      expect(result.checkedPaths.length).toBeGreaterThan(0);
    });

    it('should check multiple paths before giving up', async () => {
      const testPath = '/test/image.png';
      
      // Get the possible paths to set up the correct number of mocks
      const possiblePaths = getAllPossiblePaths(testPath);
      
      // Mock fs.access to fail for first few paths, then succeed
      const mockAccess = vi.fn();
      for (let i = 0; i < possiblePaths.length - 1; i++) {
        mockAccess.mockRejectedValueOnce(new Error('Not found'));
      }
      mockAccess.mockResolvedValueOnce(undefined); // Last path exists
      
      (fs.access as any) = mockAccess;
      
      const result = await findImageFile(testPath);
      
      expect(result.foundPath).not.toBeNull();
      expect(result.checkedPaths.length).toBeGreaterThanOrEqual(1);
    });
  });
});