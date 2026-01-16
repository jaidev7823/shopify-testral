import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  migrateSnapshotPaths,
  migrateDiffPaths,
  verifyMigration,
  getMigrationStatus,
  setPrismaInstance,
  type MigrationOptions,
} from '../migratePaths.server';

// Mock Prisma client
const mockPrisma = {
  snapshotPage: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  snapshotComparison: {
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  snapshotBaseline: {
    findMany: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
}));

// Mock filesystem operations
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
    mkdir: vi.fn(),
    copyFile: vi.fn(),
    rename: vi.fn(),
  },
}));

// Mock path utilities
vi.mock('~/utils/image-paths.server', () => ({
  getBaselineWebPath: vi.fn(({ shop, runId, pageId }) => 
    `/screenshots/${shop}/baseline/${runId}/${pageId}.png`
  ),
  getCurrentRunWebPath: vi.fn(({ shop, runId, pageId }) => 
    `/screenshots/${shop}/runs/${runId}/${pageId}.png`
  ),
  getDiffWebPath: vi.fn(({ shop, baselineRunId, currentRunId, pageId }) => 
    `/screenshots/${shop}/diffs/${baselineRunId}_vs_${currentRunId}/${pageId}.png`
  ),
  webPathToFilesystem: vi.fn((webPath) => 
    path.join(process.cwd(), 'public', webPath.substring(1))
  ),
  isNewStructure: vi.fn((path) => 
    path.includes('/baseline/') || path.includes('/runs/') || path.includes('/diffs/')
  ),
  resolveOldPathToFilesystem: vi.fn((oldPath) => {
    // Mock the backward compatibility function
    if (oldPath.startsWith('/')) {
      return path.join(process.cwd(), 'public', oldPath.substring(1));
    }
    return path.join(process.cwd(), 'public', oldPath);
  }),
}));

describe('migratePaths.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Inject mock prisma instance
    setPrismaInstance(mockPrisma as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('migrateSnapshotPaths', () => {
    it('should migrate snapshot paths from old to new structure', async () => {
      // Mock data
      const mockSnapshotPages = [
        {
          id: 'page1',
          imagePath: '/old/path/image1.png',
          pageName: 'homepage',
          snapshotRun: {
            id: 'run1',
            storeId: 'shop1',
          },
        },
      ];

      const mockBaselines = [
        { runId: 'run1' }, // This makes run1 a baseline
      ];

      mockPrisma.snapshotPage.findMany.mockResolvedValue(mockSnapshotPages);
      mockPrisma.snapshotBaseline.findMany.mockResolvedValue(mockBaselines);
      mockPrisma.snapshotPage.update.mockResolvedValue({});

      // Mock file operations
      (fs.access as any).mockResolvedValue(undefined); // File exists
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any).mockResolvedValue(undefined);

      const options: MigrationOptions = { dryRun: false, preserveOriginals: true };
      const result = await migrateSnapshotPaths(options);

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(mockPrisma.snapshotPage.update).toHaveBeenCalledWith({
        where: { id: 'page1' },
        data: { imagePath: '/screenshots/shop1/baseline/run1/homepage.png' },
      });
    });

    it('should handle missing source files gracefully', async () => {
      const mockSnapshotPages = [
        {
          id: 'page1',
          imagePath: '/old/path/missing.png',
          pageName: 'homepage',
          snapshotRun: {
            id: 'run1',
            storeId: 'shop1',
          },
        },
      ];

      mockPrisma.snapshotPage.findMany.mockResolvedValue(mockSnapshotPages);
      mockPrisma.snapshotBaseline.findMany.mockResolvedValue([]);

      // Mock file doesn't exist
      (fs.access as any).mockRejectedValue(new Error('File not found'));

      const result = await migrateSnapshotPaths();

      expect(result.success).toBe(true); // Still successful overall
      expect(result.migratedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].recordId).toBe('page1');
    });

    it('should skip records that already use new structure', async () => {
      const mockSnapshotPages = [
        {
          id: 'page1',
          imagePath: '/screenshots/shop1/baseline/run1/homepage.png', // Already new structure
          pageName: 'homepage',
          snapshotRun: {
            id: 'run1',
            storeId: 'shop1',
          },
        },
      ];

      mockPrisma.snapshotPage.findMany.mockResolvedValue(mockSnapshotPages);
      mockPrisma.snapshotBaseline.findMany.mockResolvedValue([]);

      const result = await migrateSnapshotPaths();

      expect(result.migratedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(mockPrisma.snapshotPage.update).not.toHaveBeenCalled();
    });
  });

  describe('migrateDiffPaths', () => {
    it('should migrate diff paths from old to new structure', async () => {
      const mockComparisons = [
        {
          id: 'comp1',
          diffImagePath: '/old/diff/path.png',
          storeId: 'shop1',
          basePageId: 'basePage1',
          targetPageId: 'targetPage1',
        },
      ];

      const mockBasePage = {
        id: 'basePage1',
        pageName: 'homepage',
        snapshotRun: { id: 'baseRun1' },
      };

      const mockTargetPage = {
        id: 'targetPage1',
        pageName: 'homepage',
        snapshotRun: { id: 'targetRun1' },
      };

      mockPrisma.snapshotComparison.findMany.mockResolvedValue(mockComparisons);
      mockPrisma.snapshotPage.findUnique = vi.fn()
        .mockResolvedValueOnce(mockBasePage)
        .mockResolvedValueOnce(mockTargetPage);
      mockPrisma.snapshotComparison.update.mockResolvedValue({});

      // Mock file operations
      (fs.access as any).mockResolvedValue(undefined);
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.copyFile as any).mockResolvedValue(undefined);

      const result = await migrateDiffPaths({ dryRun: false });

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(result.failedCount).toBe(0);
      expect(mockPrisma.snapshotComparison.update).toHaveBeenCalledWith({
        where: { id: 'comp1' },
        data: { diffImagePath: '/screenshots/shop1/diffs/baseRun1_vs_targetRun1/homepage.png' },
      });
    });
  });

  describe('verifyMigration', () => {
    it('should identify missing files after migration', async () => {
      const mockSnapshotPages = [
        {
          id: 'page1',
          imagePath: '/screenshots/shop1/baseline/run1/homepage.png',
        },
      ];

      const mockComparisons = [
        {
          id: 'comp1',
          diffImagePath: '/screenshots/shop1/diffs/run1_vs_run2/homepage.png',
        },
      ];

      mockPrisma.snapshotPage.findMany.mockResolvedValue(mockSnapshotPages);
      mockPrisma.snapshotComparison.findMany.mockResolvedValue(mockComparisons);

      // Mock first file exists, second doesn't
      (fs.access as any)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File not found'));

      const result = await verifyMigration();

      expect(result.success).toBe(false);
      expect(result.missingFiles).toHaveLength(1);
      expect(result.missingFiles[0]).toEqual({
        type: 'diff',
        recordId: 'comp1',
        path: '/screenshots/shop1/diffs/run1_vs_run2/homepage.png',
      });
    });
  });

  describe('getMigrationStatus', () => {
    it('should return accurate migration status counts', async () => {
      mockPrisma.snapshotPage.count
        .mockResolvedValueOnce(100) // Total snapshots
        .mockResolvedValueOnce(80); // Snapshots with new structure

      mockPrisma.snapshotComparison.count
        .mockResolvedValueOnce(50) // Total diffs
        .mockResolvedValueOnce(30); // Diffs with new structure

      const status = await getMigrationStatus();

      expect(status.snapshotsNeedingMigration).toBe(20);
      expect(status.diffsNeedingMigration).toBe(20);
      expect(status.totalRecords).toBe(150);
    });
  });
});