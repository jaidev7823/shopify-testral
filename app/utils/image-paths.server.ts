import * as path from 'path';
import { promises as fs } from 'fs';

/**
 * Components required to generate a snapshot path
 */
export interface PathComponents {
  shop: string;
  runId: string;
  pageId: string;
}

/**
 * Components required to generate a diff image path
 */
export interface DiffPathComponents {
  shop: string;
  baselineRunId: string;
  currentRunId: string;
  pageId: string;
}

/**
 * Path validation error details
 */
export interface PathValidationError {
  field: string;
  message: string;
}

/**
 * Generate web path for baseline snapshot
 * Format: /screenshots/{shop}/baseline/{runId}/{pageId}.png
 */
export function getBaselineWebPath(components: PathComponents): string {
  validatePathComponents(components);
  
  const { shop, runId, pageId } = components;
  return `/screenshots/${shop}/baseline/${runId}/${pageId}.png`;
}

/**
 * Generate web path for current run snapshot
 * Format: /screenshots/{shop}/runs/{runId}/{pageId}.png
 */
export function getCurrentRunWebPath(components: PathComponents): string {
  validatePathComponents(components);
  
  const { shop, runId, pageId } = components;
  return `/screenshots/${shop}/runs/${runId}/${pageId}.png`;
}

/**
 * Generate web path for diff image
 * Format: /screenshots/{shop}/diffs/{baselineRunId}_vs_{currentRunId}/{pageId}.png
 */
export function getDiffWebPath(components: DiffPathComponents): string {
  validateDiffPathComponents(components);
  
  const { shop, baselineRunId, currentRunId, pageId } = components;
  return `/screenshots/${shop}/diffs/${baselineRunId}_vs_${currentRunId}/${pageId}.png`;
}

/**
 * Convert web path to filesystem path
 * Converts /screenshots/... to {projectRoot}/public/screenshots/...
 */
export function webPathToFilesystem(webPath: string): string {
  if (!webPath.startsWith('/screenshots/')) {
    throw new Error(`Invalid web path format: ${webPath}. Must start with /screenshots/`);
  }
  
  // Remove leading slash and prepend public directory
  const relativePath = webPath.substring(1);
  return path.join(process.cwd(), 'public', relativePath);
}

/**
 * Convert filesystem path to web path
 * Converts {projectRoot}/public/screenshots/... to /screenshots/...
 */
export function filesystemToWebPath(fsPath: string): string {
  const publicDir = path.join(process.cwd(), 'public');
  
  if (!fsPath.startsWith(publicDir)) {
    throw new Error(`Filesystem path must be within public directory: ${fsPath}`);
  }
  
  // Remove public directory prefix and add leading slash
  const relativePath = path.relative(publicDir, fsPath);
  return '/' + relativePath.replace(/\\/g, '/'); // Normalize path separators
}

/**
 * Validate path components for snapshot paths
 */
export function validatePathComponents(components: PathComponents): void {
  const errors: PathValidationError[] = [];
  
  if (!components.shop || components.shop.trim() === '') {
    errors.push({ field: 'shop', message: 'Shop identifier cannot be empty' });
  }
  
  if (!components.runId || components.runId.trim() === '') {
    errors.push({ field: 'runId', message: 'Run ID cannot be empty' });
  }
  
  if (!components.pageId || components.pageId.trim() === '') {
    errors.push({ field: 'pageId', message: 'Page ID cannot be empty' });
  }
  
  // Check for invalid characters that could cause filesystem issues
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  
  if (components.shop && invalidChars.test(components.shop)) {
    errors.push({ field: 'shop', message: 'Shop identifier contains invalid characters' });
  }
  
  if (components.runId && invalidChars.test(components.runId)) {
    errors.push({ field: 'runId', message: 'Run ID contains invalid characters' });
  }
  
  if (components.pageId && invalidChars.test(components.pageId)) {
    errors.push({ field: 'pageId', message: 'Page ID contains invalid characters' });
  }
  
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Path validation failed: ${errorMessages}`);
  }
}

/**
 * Validate path components for diff paths
 */
export function validateDiffPathComponents(components: DiffPathComponents): void {
  const errors: PathValidationError[] = [];
  
  if (!components.shop || components.shop.trim() === '') {
    errors.push({ field: 'shop', message: 'Shop identifier cannot be empty' });
  }
  
  if (!components.baselineRunId || components.baselineRunId.trim() === '') {
    errors.push({ field: 'baselineRunId', message: 'Baseline run ID cannot be empty' });
  }
  
  if (!components.currentRunId || components.currentRunId.trim() === '') {
    errors.push({ field: 'currentRunId', message: 'Current run ID cannot be empty' });
  }
  
  if (!components.pageId || components.pageId.trim() === '') {
    errors.push({ field: 'pageId', message: 'Page ID cannot be empty' });
  }
  
  // Check for invalid characters
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  
  if (components.shop && invalidChars.test(components.shop)) {
    errors.push({ field: 'shop', message: 'Shop identifier contains invalid characters' });
  }
  
  if (components.baselineRunId && invalidChars.test(components.baselineRunId)) {
    errors.push({ field: 'baselineRunId', message: 'Baseline run ID contains invalid characters' });
  }
  
  if (components.currentRunId && invalidChars.test(components.currentRunId)) {
    errors.push({ field: 'currentRunId', message: 'Current run ID contains invalid characters' });
  }
  
  if (components.pageId && invalidChars.test(components.pageId)) {
    errors.push({ field: 'pageId', message: 'Page ID contains invalid characters' });
  }
  
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Diff path validation failed: ${errorMessages}`);
  }
}

/**
 * Check if file exists at the given web path
 */
export async function imageExists(webPath: string): Promise<boolean> {
  try {
    const fsPath = webPathToFilesystem(webPath);
    await fs.access(fsPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Determine if path follows the new structure format
 * New structure: /screenshots/{shop}/{type}/{runId}/{pageId}.png
 * Where type is: baseline, runs, or diffs
 */
export function isNewStructure(path: string): boolean {
  // Pattern for new structure paths
  const newStructurePattern = /^\/screenshots\/[^/]+\/(baseline|runs|diffs)\/[^/]+\/[^/]+\.png$/;
  return newStructurePattern.test(path);
}

/**
 * Extract path components from a new structure path
 * Returns null if the path doesn't match the new structure
 */
export function parseNewStructurePath(webPath: string): {
  shop: string;
  type: 'baseline' | 'runs' | 'diffs';
  runId: string;
  pageId: string;
} | null {
  if (!isNewStructure(webPath)) {
    return null;
  }
  
  // Remove /screenshots/ prefix and .png suffix
  const pathWithoutPrefix = webPath.substring('/screenshots/'.length);
  const pathWithoutSuffix = pathWithoutPrefix.substring(0, pathWithoutPrefix.length - '.png'.length);
  
  const parts = pathWithoutSuffix.split('/');
  if (parts.length !== 4) {
    return null;
  }
  
  const [shop, type, runId, pageId] = parts;
  
  if (!['baseline', 'runs', 'diffs'].includes(type)) {
    return null;
  }
  
  return {
    shop,
    type: type as 'baseline' | 'runs' | 'diffs',
    runId,
    pageId
  };
}

/**
 * Backward compatibility: Detect if a path uses the old format
 * Old formats include:
 * - Relative paths not starting with /screenshots/
 * - Absolute filesystem paths
 * - Paths that don't follow the new structure pattern
 */
export function isOldStructure(path: string): boolean {
  // If it's already new structure, it's not old
  if (isNewStructure(path)) {
    return false;
  }
  
  // If it starts with /screenshots/ but doesn't match new structure, it's old
  if (path.startsWith('/screenshots/')) {
    return true;
  }
  
  // If it's an absolute path, it's likely old
  if (path.startsWith('/') && !path.startsWith('/screenshots/')) {
    return true;
  }
  
  // If it's a relative path, it's likely old
  if (!path.startsWith('/')) {
    return true;
  }
  
  return false;
}

/**
 * Backward compatibility: Convert old path format to filesystem path
 * This handles various old path formats that might exist in the database
 */
export function resolveOldPathToFilesystem(oldPath: string): string {
  // If it's already a web path (but old format), try to convert it
  if (oldPath.startsWith('/screenshots/')) {
    try {
      return webPathToFilesystem(oldPath);
    } catch {
      // If conversion fails, treat as relative path
      return path.join(process.cwd(), 'public', oldPath.substring(1));
    }
  }
  
  // If it's already an absolute filesystem path, return as-is
  if (path.isAbsolute(oldPath) && !oldPath.startsWith('/screenshots/')) {
    // Check if it looks like a filesystem path (contains process.cwd() or similar)
    if (oldPath.includes(process.cwd()) || oldPath.includes('public')) {
      return oldPath;
    }
    // Otherwise treat as web path relative to public
    return path.join(process.cwd(), 'public', oldPath.substring(1));
  }
  
  // If it starts with a slash but not /screenshots/, treat as relative to public
  if (oldPath.startsWith('/')) {
    return path.join(process.cwd(), 'public', oldPath.substring(1));
  }
  
  // If it's a relative path, assume it's relative to public directory
  return path.join(process.cwd(), 'public', oldPath);
}

/**
 * Backward compatibility: Try to resolve a path to its filesystem location
 * This function provides fallback logic that tries both new and old path structures
 */
export async function resolvePathWithFallback(imagePath: string): Promise<{
  resolvedPath: string;
  exists: boolean;
  isNewStructure: boolean;
}> {
  // First, try the path as-is if it's new structure
  if (isNewStructure(imagePath)) {
    const fsPath = webPathToFilesystem(imagePath);
    const exists = await imageExists(imagePath);
    return {
      resolvedPath: fsPath,
      exists,
      isNewStructure: true
    };
  }
  
  // If it's old structure, resolve using old path logic
  if (isOldStructure(imagePath)) {
    const fsPath = resolveOldPathToFilesystem(imagePath);
    let exists = false;
    try {
      await fs.access(fsPath);
      exists = true;
    } catch {
      exists = false;
    }
    
    return {
      resolvedPath: fsPath,
      exists,
      isNewStructure: false
    };
  }
  
  // If we can't determine the structure, try both approaches
  // First try as new structure
  try {
    const fsPath = webPathToFilesystem(imagePath);
    await fs.access(fsPath);
    return {
      resolvedPath: fsPath,
      exists: true,
      isNewStructure: true
    };
  } catch {
    // Fall back to old structure resolution
    const fsPath = resolveOldPathToFilesystem(imagePath);
    let exists = false;
    try {
      await fs.access(fsPath);
      exists = true;
    } catch {
      exists = false;
    }
    
    return {
      resolvedPath: fsPath,
      exists,
      isNewStructure: false
    };
  }
}

/**
 * Backward compatibility: Get all possible filesystem paths for a given image path
 * This is useful during migration to find where files might be located
 */
export function getAllPossiblePaths(imagePath: string): string[] {
  const paths: string[] = [];
  
  // If it's new structure, add the standard conversion
  if (isNewStructure(imagePath)) {
    try {
      paths.push(webPathToFilesystem(imagePath));
    } catch {
      // Ignore conversion errors
    }
  }
  
  // Always try old structure resolution
  try {
    paths.push(resolveOldPathToFilesystem(imagePath));
  } catch {
    // Ignore resolution errors
  }
  
  // If it's a web path but not new structure, try some common variations
  if (imagePath.startsWith('/')) {
    // Try as relative to public
    paths.push(path.join(process.cwd(), 'public', imagePath.substring(1)));
    
    // Try as relative to screenshots
    paths.push(path.join(process.cwd(), 'public', 'screenshots', imagePath.substring(1)));
  }
  
  // Remove duplicates
  return [...new Set(paths)];
}

/**
 * Validate that a path is in web format (starts with "/")
 * This should be used before storing paths in the database
 */
export function validateWebPathFormat(path: string): boolean {
  // Must start with "/"
  if (!path.startsWith('/')) {
    return false;
  }
  
  // Must not contain backslashes (Windows path separators)
  if (path.includes('\\')) {
    return false;
  }
  
  // Must not contain the current working directory (filesystem path indicator)
  if (path.includes(process.cwd())) {
    return false;
  }
  
  // Must not contain common filesystem path indicators
  if (path.includes('/home/') || path.includes('/Users/') || path.includes('C:') || path.includes('D:')) {
    return false;
  }
  
  // Must not contain "public" directory in the path (should be web-accessible, not filesystem)
  if (path.includes('/public/')) {
    return false;
  }
  
  return true;
}

/**
 * Ensure a path is in web format before database storage
 * Throws an error if the path is not in the correct format
 */
export function ensureWebPathFormat(path: string, context: string = 'path'): void {
  if (!validateWebPathFormat(path)) {
    throw new Error(
      `Invalid ${context} format: "${path}". Database paths must be web-accessible (start with "/") and not contain filesystem-specific elements.`
    );
  }
}

/**
 * Validate that all paths in a database operation are in web format
 * This can be used to validate bulk operations before database writes
 */
export function validateDatabasePaths(paths: { path: string; context: string }[]): void {
  const invalidPaths = paths.filter(({ path }) => !validateWebPathFormat(path));
  
  if (invalidPaths.length > 0) {
    const errorMessages = invalidPaths.map(({ path, context }) => 
      `${context}: "${path}"`
    ).join(', ');
    
    throw new Error(
      `Invalid database path formats detected: ${errorMessages}. All database paths must be web-accessible.`
    );
  }
}

/**
 * Backward compatibility: Find the actual location of an image file
 * Tries multiple possible paths and returns the first one that exists
 */
export async function findImageFile(imagePath: string): Promise<{
  foundPath: string | null;
  checkedPaths: string[];
}> {
  const possiblePaths = getAllPossiblePaths(imagePath);
  const checkedPaths: string[] = [];
  
  for (const fsPath of possiblePaths) {
    checkedPaths.push(fsPath);
    try {
      await fs.access(fsPath);
      return {
        foundPath: fsPath,
        checkedPaths
      };
    } catch {
      // Continue to next path
    }
  }
  
  return {
    foundPath: null,
    checkedPaths
  };
}