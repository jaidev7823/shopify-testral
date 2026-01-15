import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getCurrentRunWebPath, 
  getDiffWebPath, 
  validateWebPathFormat,
  type PathComponents,
  type DiffPathComponents 
} from '~/utils/image-paths.server';

describe('Database Path Integration', () => {
  const testShop = 'test-shop';
  const testRunId = 'run-123';
  const testPageId = 'homepage';
  const testBaselineRunId = 'baseline-run-456';

  describe('Snapshot Path Generation for Database', () => {
    it('should generate web paths that are valid for database storage', () => {
      const pathComponents: PathComponents = {
        shop: testShop,
        runId: testRunId,
        pageId: testPageId
      };

      const webPath = getCurrentRunWebPath(pathComponents);
      
      // Verify the path is in web format
      expect(validateWebPathFormat(webPath)).toBe(true);
      
      // Verify the path structure
      expect(webPath).toBe('/screenshots/test-shop/runs/run-123/homepage.png');
      
      // Verify it starts with "/" (web accessible)
      expect(webPath.startsWith('/')).toBe(true);
      
      // Verify it doesn't contain filesystem-specific elements
      expect(webPath).not.toContain(process.cwd());
      expect(webPath).not.toContain('public');
      expect(webPath).not.toContain('\\');
    });

    it('should generate consistent paths for the same inputs', () => {
      const pathComponents: PathComponents = {
        shop: testShop,
        runId: testRunId,
        pageId: testPageId
      };

      const webPath1 = getCurrentRunWebPath(pathComponents);
      const webPath2 = getCurrentRunWebPath(pathComponents);
      
      expect(webPath1).toBe(webPath2);
      expect(validateWebPathFormat(webPath1)).toBe(true);
      expect(validateWebPathFormat(webPath2)).toBe(true);
    });
  });

  describe('Diff Path Generation for Database', () => {
    it('should generate web paths that are valid for database storage', () => {
      const diffPathComponents: DiffPathComponents = {
        shop: testShop,
        baselineRunId: testBaselineRunId,
        currentRunId: testRunId,
        pageId: testPageId
      };

      const diffWebPath = getDiffWebPath(diffPathComponents);
      
      // Verify the path is in web format
      expect(validateWebPathFormat(diffWebPath)).toBe(true);
      
      // Verify the path structure
      expect(diffWebPath).toBe('/screenshots/test-shop/diffs/baseline-run-456_vs_run-123/homepage.png');
      
      // Verify it starts with "/" (web accessible)
      expect(diffWebPath.startsWith('/')).toBe(true);
      
      // Verify it doesn't contain filesystem-specific elements
      expect(diffWebPath).not.toContain(process.cwd());
      expect(diffWebPath).not.toContain('public');
      expect(diffWebPath).not.toContain('\\');
    });

    it('should include both run IDs in the path for uniqueness', () => {
      const diffPathComponents: DiffPathComponents = {
        shop: testShop,
        baselineRunId: testBaselineRunId,
        currentRunId: testRunId,
        pageId: testPageId
      };

      const diffWebPath = getDiffWebPath(diffPathComponents);
      
      expect(diffWebPath).toContain(testBaselineRunId);
      expect(diffWebPath).toContain(testRunId);
      expect(diffWebPath).toContain('_vs_');
      expect(validateWebPathFormat(diffWebPath)).toBe(true);
    });
  });

  describe('Path Validation for Database Operations', () => {
    it('should validate multiple paths for bulk operations', () => {
      const paths = [
        { path: '/screenshots/shop1/baseline/run1/page1.png', context: 'page1' },
        { path: '/screenshots/shop1/runs/run2/page2.png', context: 'page2' },
        { path: '/screenshots/shop1/diffs/run1_vs_run2/page3.png', context: 'page3' }
      ];

      // All paths should be valid
      paths.forEach(({ path }) => {
        expect(validateWebPathFormat(path)).toBe(true);
      });
    });

    it('should reject filesystem paths that might accidentally be stored', () => {
      const invalidPaths = [
        '/home/user/project/public/screenshots/page.png',
        'C:\\Users\\project\\public\\screenshots\\page.png',
        'screenshots/shop1/page.png', // relative path
        '/project/public/screenshots/page.png' // contains 'public'
      ];

      invalidPaths.forEach(path => {
        expect(validateWebPathFormat(path)).toBe(false);
      });
    });
  });

  describe('HTML Image Tag Compatibility', () => {
    it('should generate paths that are directly usable in HTML img tags', () => {
      const pathComponents: PathComponents = {
        shop: testShop,
        runId: testRunId,
        pageId: testPageId
      };

      const webPath = getCurrentRunWebPath(pathComponents);
      
      // Should be a valid src attribute value
      expect(webPath.startsWith('/')).toBe(true);
      expect(webPath.endsWith('.png')).toBe(true);
      
      // Should not contain characters that need escaping in HTML
      expect(webPath).not.toContain('<');
      expect(webPath).not.toContain('>');
      expect(webPath).not.toContain('"');
      expect(webPath).not.toContain("'");
      
      // Should be web-accessible format
      expect(validateWebPathFormat(webPath)).toBe(true);
    });

    it('should generate diff paths that are directly usable in HTML img tags', () => {
      const diffPathComponents: DiffPathComponents = {
        shop: testShop,
        baselineRunId: testBaselineRunId,
        currentRunId: testRunId,
        pageId: testPageId
      };

      const diffWebPath = getDiffWebPath(diffPathComponents);
      
      // Should be a valid src attribute value
      expect(diffWebPath.startsWith('/')).toBe(true);
      expect(diffWebPath.endsWith('.png')).toBe(true);
      
      // Should not contain characters that need escaping in HTML
      expect(diffWebPath).not.toContain('<');
      expect(diffWebPath).not.toContain('>');
      expect(diffWebPath).not.toContain('"');
      expect(diffWebPath).not.toContain("'");
      
      // Should be web-accessible format
      expect(validateWebPathFormat(diffWebPath)).toBe(true);
    });
  });
});