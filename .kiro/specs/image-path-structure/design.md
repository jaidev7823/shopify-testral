# Design Document: Image Path Structure Reorganization

## Overview

This design establishes a new folder structure for organizing visual testing snapshots in a Shopify testing application. The new structure separates baseline snapshots, test run snapshots, and diff images into distinct hierarchies while maintaining backward compatibility with existing database records.

The core principle is to organize images by shop first, then by type (baseline/runs/diffs), then by run identifier. This creates a clear, navigable structure that makes it easy to understand what each image represents and when it was created.

## Architecture

### Folder Structure

The new structure follows this hierarchy:

```
public/
  screenshots/
    {shop}/
      baseline/
        {runId}/
          {pageId}.png
      runs/
        {runId}/
          {pageId}.png
      diffs/
        {baselineRunId}_vs_{currentRunId}/
          {pageId}.png
```

**Rationale:**
- Shop-first organization makes it easy to manage images per store
- Type separation (baseline/runs/diffs) provides clear categorization
- Run ID organization enables easy cleanup and historical tracking
- Page ID filenames make individual snapshots identifiable

### Path Types

The system handles two types of paths:

1. **Web Paths**: URL-accessible paths stored in the database
   - Format: `/screenshots/{shop}/baseline/{runId}/{pageId}.png`
   - Used by the UI to display images
   - Stored in database fields: `SnapshotPage.imagePath`, `SnapshotComparison.diffImagePath`

2. **Filesystem Paths**: Absolute server paths used internally
   - Format: `{projectRoot}/public/screenshots/{shop}/baseline/{runId}/{pageId}.png`
   - Used by services for file operations
   - Converted from web paths when needed

### Migration Strategy

The migration from old to new structure follows these steps:

1. **Create new directory structure** for each shop
2. **Copy existing images** to new locations based on their type
3. **Update database records** with new web paths
4. **Verify all images** are accessible at new paths
5. **Optionally remove old directories** after verification

The migration is designed to be non-destructive, copying rather than moving files initially to allow rollback if needed.

## Components and Interfaces

### Path Utility Module (`app/utils/image-paths.server.ts`)

This is the single source of truth for all path generation logic.

```typescript
interface PathComponents {
  shop: string;
  runId: string;
  pageId: string;
}

interface DiffPathComponents {
  shop: string;
  baselineRunId: string;
  currentRunId: string;
  pageId: string;
}

// Generate web path for baseline snapshot
function getBaselineWebPath(components: PathComponents): string

// Generate web path for current run snapshot
function getCurrentRunWebPath(components: PathComponents): string

// Generate web path for diff image
function getDiffWebPath(components: DiffPathComponents): string

// Convert web path to filesystem path
function webPathToFilesystem(webPath: string): string

// Convert filesystem path to web path
function filesystemToWebPath(fsPath: string): string

// Validate path components
function validatePathComponents(components: PathComponents): boolean

// Check if file exists at path
function imageExists(webPath: string): Promise<boolean>

// Determine if path follows new structure
function isNewStructure(path: string): boolean
```

### Snapshot Service Updates (`app/services/snapshot.server.ts`)

The snapshot service will be updated to use the new path utilities:

```typescript
interface TakeSnapshotOptions {
  shop: string;
  runId: string;
  pageId: string;
  url: string;
  isBaseline: boolean;
}

async function takeSnapshot(options: TakeSnapshotOptions): Promise<string> {
  // Determine path based on isBaseline flag
  const webPath = options.isBaseline 
    ? getBaselineWebPath({ shop: options.shop, runId: options.runId, pageId: options.pageId })
    : getCurrentRunWebPath({ shop: options.shop, runId: options.runId, pageId: options.pageId });
  
  const fsPath = webPathToFilesystem(webPath);
  
  // Ensure directory exists
  await ensureDirectory(path.dirname(fsPath));
  
  // Take screenshot using Playwright
  await page.screenshot({ path: fsPath });
  
  // Return web path for database storage
  return webPath;
}
```

### Comparison Service Updates (`app/services/compareImages.server.ts`)

The comparison service will use the new diff path structure:

```typescript
interface CompareImagesOptions {
  shop: string;
  baselineRunId: string;
  currentRunId: string;
  pageId: string;
  baselineImagePath: string;
  currentImagePath: string;
}

async function compareImages(options: CompareImagesOptions): Promise<ComparisonResult> {
  // Generate diff path
  const diffWebPath = getDiffWebPath({
    shop: options.shop,
    baselineRunId: options.baselineRunId,
    currentRunId: options.currentRunId,
    pageId: options.pageId
  });
  
  const diffFsPath = webPathToFilesystem(diffWebPath);
  
  // Ensure directory exists
  await ensureDirectory(path.dirname(diffFsPath));
  
  // Perform comparison and generate diff
  const result = await performPixelMatch(
    webPathToFilesystem(options.baselineImagePath),
    webPathToFilesystem(options.currentImagePath),
    diffFsPath
  );
  
  return {
    ...result,
    diffImagePath: diffWebPath
  };
}
```

### Migration Service (`app/services/migratePaths.server.ts`)

A new service to handle migration of existing paths:

```typescript
interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors: Array<{ recordId: string; error: string }>;
}

async function migrateSnapshotPaths(): Promise<MigrationResult> {
  // 1. Get all snapshot pages with old path structure
  // 2. For each snapshot, determine if it's baseline or current
  // 3. Generate new path based on type
  // 4. Copy file to new location
  // 5. Update database record
  // 6. Log results
}

async function migrateDiffPaths(): Promise<MigrationResult> {
  // 1. Get all snapshot comparisons with old path structure
  // 2. Generate new diff paths
  // 3. Copy files to new locations
  // 4. Update database records
  // 5. Log results
}

async function verifyMigration(): Promise<boolean> {
  // Check that all database paths point to existing files
}
```

## Data Models

### Database Schema (No Changes Required)

The existing Prisma schema already supports the new structure:

```prisma
model SnapshotPage {
  id          String   @id @default(cuid())
  runId       String
  pageId      String
  imagePath   String   // Stores web path
  // ... other fields
}

model SnapshotComparison {
  id              String   @id @default(cuid())
  baselinePageId  String
  currentPageId   String
  diffImagePath   String?  // Stores web path
  // ... other fields
}
```

The `imagePath` and `diffImagePath` fields will store the new web path format. No schema migration is needed, only data migration.

### Path Format Examples

**Baseline Snapshot:**
- Web Path: `/screenshots/myshop/baseline/run_abc123/homepage.png`
- Filesystem: `{root}/public/screenshots/myshop/baseline/run_abc123/homepage.png`

**Current Run Snapshot:**
- Web Path: `/screenshots/myshop/runs/run_xyz789/homepage.png`
- Filesystem: `{root}/public/screenshots/myshop/runs/run_xyz789/homepage.png`

**Diff Image:**
- Web Path: `/screenshots/myshop/diffs/run_abc123_vs_run_xyz789/homepage.png`
- Filesystem: `{root}/public/screenshots/myshop/diffs/run_abc123_vs_run_xyz789/homepage.png`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

After analyzing the acceptance criteria, I identified several properties that can be combined for more comprehensive testing:

**Property Reflection:**
- Properties 1.1 and 1.2 (baseline and current folder structures) can be combined into a single property about snapshot type determining folder structure
- Properties 2.1, 2.2, and 2.3 (diff storage, shop organization, and run ID inclusion) can be combined into a comprehensive diff path property
- Properties 4.1 and 4.2 (web path storage for snapshots and diffs) can be combined into a single database path format property
- Properties 8.1, 8.2, 8.3, and 8.4 (folder hierarchy requirements) can be combined into a comprehensive hierarchy property

### Property 1: Snapshot Type Determines Folder Structure
*For any* snapshot with a specified type (baseline or current), the generated path should place baseline snapshots in the baseline folder structure and current snapshots in the runs folder structure, with no overlap between the two structures.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Comprehensive Diff Path Structure
*For any* diff image generated from a comparison, the path should be organized by shop identifier, stored in the diffs folder structure, and include both baseline and current run identifiers in the filename.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Path Uniqueness
*For any* set of comparison operations with different parameters (shop, baseline run, current run, page), each should generate a unique diff path with no collisions.
**Validates: Requirements 2.4**

### Property 4: Consistent Naming Conventions
*For any* generated path (baseline, current, or diff), the path should follow consistent naming conventions including shop identifier format, run identifier format, and file extension patterns.
**Validates: Requirements 3.3**

### Property 5: Database Web Path Format
*For any* path stored in the database (snapshot or diff), the path should be in web-accessible format starting with "/" and directly usable in HTML image tags.
**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Path Conversion Round Trip
*For any* valid web path, converting to filesystem path and back to web path should produce an equivalent result, and vice versa.
**Validates: Requirements 4.3**

### Property 7: Backward Compatibility Resolution
*For any* existing snapshot with an old path format, the system should resolve it to a valid filesystem location without errors.
**Validates: Requirements 5.1**

### Property 8: Migration Preservation
*For any* set of existing image files, running the migration utility should preserve all files (no files lost) and update all corresponding database records to new path formats.
**Validates: Requirements 5.3, 5.4**

### Property 9: Migration Error Handling
*For any* migration operation that encounters unmigrateable paths, the system should log errors and continue processing remaining records without stopping.
**Validates: Requirements 5.5**

### Property 10: Path Component Validation
*For any* path generation request with empty or invalid components (shop, runId, pageId), the validation should reject the request and prevent path generation.
**Validates: Requirements 6.1**

### Property 11: File Existence Verification
*For any* image path check, if the file does not exist at the expected location, the system should return an appropriate error indicating the missing file.
**Validates: Requirements 6.2, 6.3**

### Property 12: Path Structure Recognition
*For any* given path string, the system should correctly identify whether it follows the new structure format or an old format.
**Validates: Requirements 6.4**

### Property 13: Hierarchical Organization
*For any* generated path, the structure should organize first by shop identifier, then by type (baseline/runs/diffs), then by run identifier, with page snapshots having descriptive filenames.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

## Error Handling

### Path Generation Errors
- **Invalid Components**: When path components are empty, null, or contain invalid characters, the system should throw a descriptive error
- **Directory Creation Failures**: When unable to create required directories, the system should log the error and provide fallback behavior
- **Permission Issues**: When filesystem permissions prevent file operations, the system should provide clear error messages

### Migration Errors
- **File Not Found**: When an existing database record references a non-existent file, log the error and mark the record for manual review
- **Path Parsing Failures**: When old paths cannot be parsed to determine their type, log the error and skip the record
- **Filesystem Errors**: When file copy operations fail, log the error with details and continue with remaining files

### Validation Errors
- **Malformed Paths**: When paths don't match expected patterns, return validation errors with specific details about what's wrong
- **Type Mismatches**: When a path is expected to be one type but appears to be another, provide clear error messages

## Testing Strategy

### Dual Testing Approach
The testing strategy combines unit tests for specific scenarios with property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific path generation examples with known inputs and outputs
- Edge cases like special characters in shop names and page IDs
- Error conditions and exception handling
- Integration between services and path utilities

**Property Tests** focus on:
- Universal properties that hold across all valid inputs
- Path format consistency across different input combinations
- Round-trip conversions between web and filesystem paths
- Migration behavior across various data sets

### Property-Based Testing Configuration
- **Library**: Use `fast-check` for TypeScript property-based testing
- **Iterations**: Minimum 100 iterations per property test
- **Test Tags**: Each property test references its design document property
- **Tag Format**: `Feature: image-path-structure, Property {number}: {property_text}`

### Test Data Generation
Property tests will generate:
- Random shop identifiers (alphanumeric, with special characters)
- Random run identifiers (UUIDs, timestamps, custom formats)
- Random page identifiers (URLs, slugs, special characters)
- Various combinations of baseline/current snapshot types
- Different comparison scenarios for diff generation

### Integration Testing
- Test the complete flow from snapshot creation to path storage
- Verify UI can display images using generated web paths
- Test migration utility with realistic data sets
- Verify backward compatibility with existing database records

The testing approach ensures both specific correctness (unit tests) and general correctness (property tests), providing confidence that the path reorganization works reliably across all scenarios.