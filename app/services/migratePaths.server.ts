import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import * as path from "path";
import {
  getBaselineWebPath,
  getCurrentRunWebPath,
  getDiffWebPath,
  webPathToFilesystem,
  filesystemToWebPath,
  isNewStructure,
  resolveOldPathToFilesystem,
  imageExists,
  type PathComponents,
  type DiffPathComponents,
} from "~/utils/image-paths.server";

// Allow dependency injection for testing
let prismaInstance: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

// For testing - allows injecting a mock
export function setPrismaInstance(instance: PrismaClient): void {
  prismaInstance = instance;
}

/**
 * Result of a migration operation
 */
export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors: Array<{ recordId: string; error: string }>;
}

/**
 * Detailed migration statistics
 */
export interface MigrationStats {
  snapshotMigration: MigrationResult;
  diffMigration: MigrationResult;
  totalProcessed: number;
  totalMigrated: number;
  totalFailed: number;
}

/**
 * Options for migration operations
 */
export interface MigrationOptions {
  dryRun?: boolean;
  preserveOriginals?: boolean;
  logProgress?: boolean;
}

/**
 * Migrate snapshot paths from old structure to new structure
 * This function:
 * 1. Gets all snapshot pages with old path structure
 * 2. Determines if each snapshot is baseline or current based on SnapshotBaseline table
 * 3. Generates new paths using the path utilities
 * 4. Copies files to new locations (preserving originals)
 * 5. Updates database records with new paths
 */
export async function migrateSnapshotPaths(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, preserveOriginals = true, logProgress = false } = options;
  const prisma = getPrisma();
  
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // Get all snapshot pages that need migration (those with old path structure)
    const snapshotPages = await prisma.snapshotPage.findMany({
      include: {
        snapshotRun: true,
      },
    });

    // Filter to only those with old path structure
    const pagesToMigrate = snapshotPages.filter(page => !isNewStructure(page.imagePath));
    
    if (logProgress) {
      console.log(`Found ${pagesToMigrate.length} snapshot pages to migrate`);
    }

    // Get all baseline runs to determine snapshot types
    const baselineRuns = await prisma.snapshotBaseline.findMany();
    const baselineRunIds = new Set(baselineRuns.map(b => b.runId));

    for (const page of pagesToMigrate) {
      try {
        const { snapshotRun } = page;
        const isBaseline = baselineRunIds.has(snapshotRun.id);
        
        // Extract components from the snapshot run and page data
        const pathComponents: PathComponents = {
          shop: snapshotRun.storeId,
          runId: snapshotRun.id,
          pageId: page.pageName, // Using pageName as pageId
        };

        // Generate new path based on whether it's baseline or current
        const newWebPath = isBaseline
          ? getBaselineWebPath(pathComponents)
          : getCurrentRunWebPath(pathComponents);

        // Get old and new filesystem paths
        const oldFsPath = getOldFilesystemPath(page.imagePath);
        const newFsPath = webPathToFilesystem(newWebPath);

        // Check if old file exists
        if (!(await fileExists(oldFsPath))) {
          result.errors.push({
            recordId: page.id,
            error: `Source file not found: ${oldFsPath}`,
          });
          result.failedCount++;
          continue;
        }

        if (!dryRun) {
          // Ensure new directory exists
          await fs.mkdir(path.dirname(newFsPath), { recursive: true });

          // Copy file to new location
          if (preserveOriginals) {
            await fs.copyFile(oldFsPath, newFsPath);
          } else {
            await fs.rename(oldFsPath, newFsPath);
          }

          // Update database record
          await prisma.snapshotPage.update({
            where: { id: page.id },
            data: { imagePath: newWebPath },
          });
        }

        result.migratedCount++;
        
        if (logProgress && result.migratedCount % 10 === 0) {
          console.log(`Migrated ${result.migratedCount} snapshot pages...`);
        }
      } catch (error) {
        result.errors.push({
          recordId: page.id,
          error: error instanceof Error ? error.message : String(error),
        });
        result.failedCount++;
        result.success = false;
      }
    }

    if (logProgress) {
      console.log(`Snapshot migration completed: ${result.migratedCount} migrated, ${result.failedCount} failed`);
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      recordId: "GLOBAL",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Migrate diff image paths from old structure to new structure
 * This function:
 * 1. Gets all snapshot comparisons with old diff path structure
 * 2. Generates new diff paths using baseline and current run IDs
 * 3. Copies files to new locations (preserving originals)
 * 4. Updates database records with new paths
 */
export async function migrateDiffPaths(
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, preserveOriginals = true, logProgress = false } = options;
  const prisma = getPrisma();
  
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // Get all snapshot comparisons that need migration
    const comparisons = await prisma.snapshotComparison.findMany({
      where: {
        diffImagePath: {
          not: null,
        },
      },
    });

    // Filter to only those with old path structure
    const comparisonsToMigrate = comparisons.filter(
      comp => comp.diffImagePath && !isNewStructure(comp.diffImagePath)
    );
    
    if (logProgress) {
      console.log(`Found ${comparisonsToMigrate.length} diff images to migrate`);
    }

    for (const comparison of comparisonsToMigrate) {
      try {
        if (!comparison.diffImagePath) continue;

        // Get the baseline and current page information
        const basePage = await prisma.snapshotPage.findUnique({
          where: { id: comparison.basePageId },
          include: { snapshotRun: true },
        });

        const targetPage = await prisma.snapshotPage.findUnique({
          where: { id: comparison.targetPageId },
          include: { snapshotRun: true },
        });

        if (!basePage || !targetPage) {
          result.errors.push({
            recordId: comparison.id,
            error: "Could not find associated snapshot pages",
          });
          result.failedCount++;
          continue;
        }

        // Generate new diff path
        const diffComponents: DiffPathComponents = {
          shop: comparison.storeId,
          baselineRunId: basePage.snapshotRun.id,
          currentRunId: targetPage.snapshotRun.id,
          pageId: basePage.pageName, // Using pageName as pageId
        };

        const newWebPath = getDiffWebPath(diffComponents);

        // Get old and new filesystem paths
        const oldFsPath = getOldFilesystemPath(comparison.diffImagePath);
        const newFsPath = webPathToFilesystem(newWebPath);

        // Check if old file exists
        if (!(await fileExists(oldFsPath))) {
          result.errors.push({
            recordId: comparison.id,
            error: `Source file not found: ${oldFsPath}`,
          });
          result.failedCount++;
          continue;
        }

        if (!dryRun) {
          // Ensure new directory exists
          await fs.mkdir(path.dirname(newFsPath), { recursive: true });

          // Copy file to new location
          if (preserveOriginals) {
            await fs.copyFile(oldFsPath, newFsPath);
          } else {
            await fs.rename(oldFsPath, newFsPath);
          }

          // Update database record
          await prisma.snapshotComparison.update({
            where: { id: comparison.id },
            data: { diffImagePath: newWebPath },
          });
        }

        result.migratedCount++;
        
        if (logProgress && result.migratedCount % 10 === 0) {
          console.log(`Migrated ${result.migratedCount} diff images...`);
        }
      } catch (error) {
        result.errors.push({
          recordId: comparison.id,
          error: error instanceof Error ? error.message : String(error),
        });
        result.failedCount++;
        result.success = false;
      }
    }

    if (logProgress) {
      console.log(`Diff migration completed: ${result.migratedCount} migrated, ${result.failedCount} failed`);
    }
  } catch (error) {
    result.success = false;
    result.errors.push({
      recordId: "GLOBAL",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Run complete migration for both snapshots and diffs
 * Returns comprehensive statistics about the migration
 */
export async function migrateAllPaths(
  options: MigrationOptions = {}
): Promise<MigrationStats> {
  const { logProgress = false } = options;
  
  if (logProgress) {
    console.log("Starting complete path migration...");
  }

  // Run snapshot migration
  if (logProgress) {
    console.log("Migrating snapshot paths...");
  }
  const snapshotMigration = await migrateSnapshotPaths(options);

  // Run diff migration
  if (logProgress) {
    console.log("Migrating diff paths...");
  }
  const diffMigration = await migrateDiffPaths(options);

  const stats: MigrationStats = {
    snapshotMigration,
    diffMigration,
    totalProcessed: snapshotMigration.migratedCount + snapshotMigration.failedCount + 
                   diffMigration.migratedCount + diffMigration.failedCount,
    totalMigrated: snapshotMigration.migratedCount + diffMigration.migratedCount,
    totalFailed: snapshotMigration.failedCount + diffMigration.failedCount,
  };

  if (logProgress) {
    console.log("Migration completed:");
    console.log(`  Total processed: ${stats.totalProcessed}`);
    console.log(`  Total migrated: ${stats.totalMigrated}`);
    console.log(`  Total failed: ${stats.totalFailed}`);
    console.log(`  Snapshot migration: ${snapshotMigration.migratedCount} migrated, ${snapshotMigration.failedCount} failed`);
    console.log(`  Diff migration: ${diffMigration.migratedCount} migrated, ${diffMigration.failedCount} failed`);
  }

  return stats;
}

/**
 * Verify that all database paths point to existing files
 * This function checks both snapshot and diff paths
 */
export async function verifyMigration(): Promise<{
  success: boolean;
  missingFiles: Array<{ type: 'snapshot' | 'diff'; recordId: string; path: string }>;
}> {
  const prisma = getPrisma();
  const missingFiles: Array<{ type: 'snapshot' | 'diff'; recordId: string; path: string }> = [];

  try {
    // Check snapshot pages
    const snapshotPages = await prisma.snapshotPage.findMany();
    for (const page of snapshotPages) {
      const fsPath = webPathToFilesystem(page.imagePath);
      if (!(await fileExists(fsPath))) {
        missingFiles.push({
          type: 'snapshot',
          recordId: page.id,
          path: page.imagePath,
        });
      }
    }

    // Check diff images
    const comparisons = await prisma.snapshotComparison.findMany({
      where: {
        diffImagePath: {
          not: null,
        },
      },
    });

    for (const comparison of comparisons) {
      if (comparison.diffImagePath) {
        const fsPath = webPathToFilesystem(comparison.diffImagePath);
        if (!(await fileExists(fsPath))) {
          missingFiles.push({
            type: 'diff',
            recordId: comparison.id,
            path: comparison.diffImagePath,
          });
        }
      }
    }

    return {
      success: missingFiles.length === 0,
      missingFiles,
    };
  } catch (error) {
    console.error("Error during migration verification:", error);
    return {
      success: false,
      missingFiles,
    };
  }
}

/**
 * Get migration status - shows how many records need migration
 */
export async function getMigrationStatus(): Promise<{
  snapshotsNeedingMigration: number;
  diffsNeedingMigration: number;
  totalRecords: number;
}> {
  const prisma = getPrisma();
  try {
    // Count snapshot pages
    const totalSnapshots = await prisma.snapshotPage.count();
    const snapshotsWithNewStructure = await prisma.snapshotPage.count({
      where: {
        imagePath: {
          startsWith: "/screenshots/",
        },
      },
    });

    // This is a rough estimate - we'd need to check each path individually for accuracy
    const snapshotsNeedingMigration = totalSnapshots - snapshotsWithNewStructure;

    // Count diff images
    const totalDiffs = await prisma.snapshotComparison.count({
      where: {
        diffImagePath: {
          not: null,
        },
      },
    });

    const diffsWithNewStructure = await prisma.snapshotComparison.count({
      where: {
        diffImagePath: {
          startsWith: "/screenshots/",
        },
      },
    });

    const diffsNeedingMigration = totalDiffs - diffsWithNewStructure;

    return {
      snapshotsNeedingMigration: Math.max(0, snapshotsNeedingMigration),
      diffsNeedingMigration: Math.max(0, diffsNeedingMigration),
      totalRecords: totalSnapshots + totalDiffs,
    };
  } catch (error) {
    console.error("Error getting migration status:", error);
    return {
      snapshotsNeedingMigration: 0,
      diffsNeedingMigration: 0,
      totalRecords: 0,
    };
  }
}

/**
 * Helper function to convert old path formats to filesystem paths
 * This handles various old path formats that might exist in the database
 */
function getOldFilesystemPath(oldPath: string): string {
  return resolveOldPathToFilesystem(oldPath);
}

/**
 * Helper function to check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean up old directory structure after successful migration
 * WARNING: This permanently deletes old files - use with caution
 */
export async function cleanupOldStructure(
  options: { dryRun?: boolean; logProgress?: boolean } = {}
): Promise<{ deletedDirectories: string[]; errors: string[] }> {
  const { dryRun = true, logProgress = false } = options;
  const deletedDirectories: string[] = [];
  const errors: string[] = [];

  if (logProgress) {
    console.log(`Cleanup old structure (dry run: ${dryRun})`);
  }

  try {
    const publicDir = path.join(process.cwd(), 'public');
    const screenshotsDir = path.join(publicDir, 'screenshots');

    // This is a placeholder for cleanup logic
    // In a real implementation, you'd want to:
    // 1. Identify old directory structures
    // 2. Verify all files have been migrated
    // 3. Remove empty old directories
    // 4. Log what was removed

    if (logProgress) {
      console.log("Cleanup would scan for old directory structures in:", screenshotsDir);
    }

    // For safety, this function doesn't actually delete anything by default
    if (!dryRun) {
      if (logProgress) {
        console.log("Actual cleanup not implemented for safety - manual cleanup recommended");
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { deletedDirectories, errors };
}

/**
 * Backward compatibility: Resolve an image path from database records
 * This function provides fallback logic for existing database records that may use old path formats
 * It tries to find the actual file location and returns both the resolved path and metadata
 */
export async function resolveImagePathForDatabase(imagePath: string): Promise<{
  resolvedFilesystemPath: string | null;
  webPath: string;
  exists: boolean;
  isNewStructure: boolean;
  checkedPaths?: string[];
}> {
  // If it's already new structure, use standard resolution
  if (isNewStructure(imagePath)) {
    const fsPath = webPathToFilesystem(imagePath);
    const exists = await imageExists(imagePath);
    
    return {
      resolvedFilesystemPath: exists ? fsPath : null,
      webPath: imagePath,
      exists,
      isNewStructure: true
    };
  }

  // For old structure paths, try to resolve using old path logic
  const fsPath = resolveOldPathToFilesystem(imagePath);
  let exists = false;
  try {
    await fs.access(fsPath);
    exists = true;
  } catch {
    exists = false;
  }
  
  return {
    resolvedFilesystemPath: exists ? fsPath : null,
    webPath: imagePath, // Keep original web path for now
    exists,
    isNewStructure: false,
    checkedPaths: [fsPath]
  };
}

/**
 * Backward compatibility: Get image for display purposes
 * This function handles both old and new path formats and returns the appropriate web path
 * for use in HTML img tags, with fallback logic for old formats
 */
export async function getImageForDisplay(imagePath: string): Promise<{
  webPath: string;
  exists: boolean;
  isNewStructure: boolean;
}> {
  const resolution = await resolveImagePathForDatabase(imagePath);
  
  // If the image exists and is new structure, return as-is
  if (resolution.exists && resolution.isNewStructure) {
    return {
      webPath: resolution.webPath,
      exists: true,
      isNewStructure: true
    };
  }
  
  // If the image exists but is old structure, we need to convert the filesystem path back to a web path
  if (resolution.exists && !resolution.isNewStructure && resolution.resolvedFilesystemPath) {
    try {
      const webPath = filesystemToWebPath(resolution.resolvedFilesystemPath);
      return {
        webPath,
        exists: true,
        isNewStructure: false
      };
    } catch {
      // If conversion fails, return the original path
      return {
        webPath: resolution.webPath,
        exists: true,
        isNewStructure: false
      };
    }
  }
  
  // If image doesn't exist, return the original path but mark as not existing
  return {
    webPath: resolution.webPath,
    exists: false,
    isNewStructure: resolution.isNewStructure
  };
}