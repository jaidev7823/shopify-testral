# Requirements Document

## Introduction

This specification addresses the reorganization of the image path structure in a Shopify visual testing application. The current implementation stores baseline and current snapshots in the same folder structure, creating confusion and maintenance challenges. This reorganization will establish a clear, maintainable folder hierarchy that separates baseline images, test run images, and diff images while maintaining backward compatibility with existing database records.

## Glossary

- **Snapshot_Service**: The service responsible for capturing screenshots of Shopify store pages using Playwright
- **Comparison_Service**: The service that compares two snapshots and generates visual diff images
- **Baseline_Snapshot**: A reference snapshot that represents the expected visual state of a page
- **Current_Snapshot**: A snapshot taken during a test run to be compared against the baseline
- **Diff_Image**: A generated image highlighting visual differences between baseline and current snapshots
- **Snapshot_Run**: A collection of snapshots taken at a specific point in time for a shop
- **Web_Path**: A URL path accessible from the browser (e.g., `/screenshots/shop/...`)
- **Filesystem_Path**: An absolute path on the server filesystem (e.g., `public/screenshots/...`)
- **Path_Migration_Service**: A service that handles migration of existing image paths to the new structure

## Requirements

### Requirement 1: Separate Storage for Baseline and Current Snapshots

**User Story:** As a developer, I want baseline and current snapshots stored in separate folder structures, so that I can easily distinguish between reference images and test run images.

#### Acceptance Criteria

1. WHEN a baseline snapshot is created, THE Snapshot_Service SHALL store it in a dedicated baseline folder structure
2. WHEN a current snapshot is created, THE Snapshot_Service SHALL store it in a dedicated runs folder structure
3. THE Snapshot_Service SHALL NOT store baseline and current snapshots in the same parent directory
4. WHEN querying snapshots by type, THE system SHALL return the correct filesystem path based on whether the snapshot is a baseline or current snapshot

### Requirement 2: Consistent Diff Image Storage

**User Story:** As a developer, I want diff images stored in a predictable location, so that I can easily locate and manage comparison results.

#### Acceptance Criteria

1. WHEN a comparison generates a diff image, THE Comparison_Service SHALL store it in a dedicated diff folder structure
2. THE Comparison_Service SHALL organize diff images by shop identifier
3. THE Comparison_Service SHALL include both baseline and current run identifiers in the diff image path
4. WHEN multiple comparisons are performed, THE system SHALL prevent path collisions by using unique identifiers

### Requirement 3: Path Structure Standardization

**User Story:** As a developer, I want a standardized path structure across all image types, so that the codebase is maintainable and predictable.

#### Acceptance Criteria

1. THE system SHALL define a single source of truth for path generation logic
2. WHEN generating any image path, THE system SHALL use the centralized path generation utility
3. THE system SHALL maintain consistent naming conventions across baseline, current, and diff paths
4. THE system SHALL document the path structure format in code comments

### Requirement 4: Database Path Management

**User Story:** As a developer, I want the database to store web-accessible paths, so that the UI can display images without path transformation.

#### Acceptance Criteria

1. WHEN storing a snapshot path in the database, THE system SHALL store the web-accessible path format
2. WHEN storing a diff image path in the database, THE system SHALL store the web-accessible path format
3. THE system SHALL convert between filesystem paths and web paths when necessary
4. WHEN retrieving paths from the database, THE system SHALL return paths that are directly usable in HTML image tags

### Requirement 5: Backward Compatibility with Existing Records

**User Story:** As a system administrator, I want existing database records to continue working, so that historical snapshots remain accessible without data loss.

#### Acceptance Criteria

1. WHEN accessing an existing snapshot with an old path format, THE system SHALL resolve the path correctly
2. THE system SHALL provide a migration utility to update existing paths to the new structure
3. WHEN the migration utility runs, THE system SHALL preserve all existing image files
4. WHEN the migration utility runs, THE system SHALL update database records to reference new paths
5. IF a path cannot be migrated, THEN THE system SHALL log the error and continue processing remaining records

### Requirement 6: Path Resolution and Validation

**User Story:** As a developer, I want the system to validate image paths, so that broken references are detected early.

#### Acceptance Criteria

1. WHEN generating an image path, THE system SHALL validate that the path components are non-empty
2. WHEN accessing an image file, THE system SHALL verify the file exists before returning the path
3. IF an image file does not exist at the expected path, THEN THE system SHALL return an error indicating the missing file
4. THE system SHALL provide a utility function to check if a path follows the new structure format

### Requirement 7: Service Layer Path Abstraction

**User Story:** As a developer, I want services to use path utilities rather than constructing paths manually, so that path logic is centralized and consistent.

#### Acceptance Criteria

1. THE Snapshot_Service SHALL use the path utility to generate snapshot storage paths
2. THE Comparison_Service SHALL use the path utility to generate diff image paths
3. WHEN a service needs to convert between web and filesystem paths, THE system SHALL provide conversion utilities
4. THE system SHALL NOT construct image paths using string concatenation outside the path utility module

### Requirement 8: Clear Folder Hierarchy

**User Story:** As a developer, I want a clear folder hierarchy that reflects the logical organization of images, so that I can navigate the filesystem easily.

#### Acceptance Criteria

1. THE system SHALL organize images first by shop identifier
2. WITHIN each shop folder, THE system SHALL separate baseline, runs, and diff images into distinct subdirectories
3. WITHIN baseline and runs folders, THE system SHALL organize images by run identifier or timestamp
4. WITHIN each run folder, THE system SHALL store page snapshots with descriptive filenames

### Requirement 9: Path Utility Testing

**User Story:** As a developer, I want comprehensive tests for path utilities, so that path generation logic is reliable and correct.

#### Acceptance Criteria

1. THE system SHALL provide unit tests for all path generation functions
2. THE system SHALL provide unit tests for path validation functions
3. THE system SHALL provide unit tests for path conversion functions (web to filesystem and vice versa)
4. THE system SHALL provide tests for edge cases including special characters in shop names and page identifiers
