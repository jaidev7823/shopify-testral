# Implementation Plan: Image Path Structure Reorganization

## Overview

This implementation plan reorganizes the image path structure in the Shopify visual testing application. The approach focuses on creating a centralized path utility, updating existing services to use the new structure, implementing a migration utility, and ensuring comprehensive testing. The implementation maintains backward compatibility while establishing a clean, maintainable folder hierarchy.

## Tasks

- [x] 1. Create centralized path utility module
  - [x] 1.1 Implement core path generation functions
    - Create `app/utils/image-paths.server.ts` with TypeScript interfaces and functions
    - Implement `getBaselineWebPath`, `getCurrentRunWebPath`, `getDiffWebPath` functions
    - Implement path conversion functions `webPathToFilesystem` and `filesystemToWebPath`
    - Add path validation and component checking functions
    - _Requirements: 3.1, 3.3, 4.3, 6.1, 6.4_

  - [ ]* 1.2 Write property test for path generation consistency
    - **Property 4: Consistent Naming Conventions**
    - **Validates: Requirements 3.3**

  - [ ]* 1.3 Write property test for path conversion round trip
    - **Property 6: Path Conversion Round Trip**
    - **Validates: Requirements 4.3**

  - [ ]* 1.4 Write unit tests for path validation
    - Test empty component validation
    - Test invalid character handling
    - Test path format recognition
    - _Requirements: 6.1, 6.4_

- [x] 2. Update snapshot service to use new path structure
  - [x] 2.1 Modify snapshot service to use path utilities
    - Update `app/services/snapshot.server.ts` to import and use path utilities
    - Modify `takeSnapshot` function to accept `isBaseline` parameter
    - Update path generation to use `getBaselineWebPath` or `getCurrentRunWebPath`
    - Ensure directory creation before screenshot capture
    - _Requirements: 1.1, 1.2, 7.1_

  - [ ]* 2.2 Write property test for snapshot type folder structure
    - **Property 1: Snapshot Type Determines Folder Structure**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 2.3 Write unit tests for snapshot service integration
    - Test baseline snapshot path generation
    - Test current run snapshot path generation
    - Test directory creation behavior
    - _Requirements: 1.1, 1.2_

- [x] 3. Update comparison service for new diff structure
  - [x] 3.1 Modify comparison service to use new diff paths
    - Update `app/services/compareImages.server.ts` to use `getDiffWebPath`
    - Modify comparison functions to accept shop and run ID parameters
    - Update diff image storage to use new folder structure
    - Ensure diff directory creation before image generation
    - _Requirements: 2.1, 2.2, 2.3, 7.2_

  - [ ]* 3.2 Write property test for comprehensive diff path structure
    - **Property 2: Comprehensive Diff Path Structure**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 3.3 Write property test for path uniqueness
    - **Property 3: Path Uniqueness**
    - **Validates: Requirements 2.4**

  - [ ]* 3.4 Write unit tests for comparison service integration
    - Test diff path generation with multiple run IDs
    - Test shop-based organization
    - Test path collision prevention
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4. Checkpoint - Ensure core path utilities and services work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement migration utility
  - [x] 5.1 Create path migration service
    - Create `app/services/migratePaths.server.ts` with migration functions
    - Implement `migrateSnapshotPaths` function to update snapshot records
    - Implement `migrateDiffPaths` function to update comparison records
    - Add file copying logic to preserve existing images
    - Add database update logic for new path formats
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 5.2 Add backward compatibility path resolution
    - Update path utility to handle old path formats
    - Implement path resolution for existing database records
    - Add fallback logic for old path structures
    - _Requirements: 5.1_

  - [ ]* 5.3 Write property test for migration preservation
    - **Property 8: Migration Preservation**
    - **Validates: Requirements 5.3, 5.4**

  - [ ]* 5.4 Write property test for migration error handling
    - **Property 9: Migration Error Handling**
    - **Validates: Requirements 5.5**

  - [ ]* 5.5 Write property test for backward compatibility
    - **Property 7: Backward Compatibility Resolution**
    - **Validates: Requirements 5.1**

  - [ ]* 5.6 Write unit tests for migration utility
    - Test migration with sample old paths
    - Test error handling for unmigrateable paths
    - Test file preservation during migration
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [x] 6. Update database path handling
  - [x] 6.1 Ensure web path format in database operations
    - Review and update any database operations that store image paths
    - Ensure all stored paths use web format (starting with "/")
    - Update path retrieval to return web-accessible paths
    - Add validation for database path format
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 6.2 Write property test for database web path format
    - **Property 5: Database Web Path Format**
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [ ]* 6.3 Write unit tests for database path operations
    - Test web path storage for snapshots
    - Test web path storage for diff images
    - Test path format validation
    - _Requirements: 4.1, 4.2, 4.4_

- [-] 7. Add file existence verification
  - [ ] 7.1 Implement file existence checking
    - Add `imageExists` function to path utility
    - Update services to verify file existence before returning paths
    - Add appropriate error handling for missing files
    - Implement error messages for missing file scenarios
    - _Requirements: 6.2, 6.3_

  - [ ]* 7.2 Write property test for file existence verification
    - **Property 11: File Existence Verification**
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 7.3 Write unit tests for file existence checking
    - Test behavior with existing files
    - Test error handling for missing files
    - Test error message content
    - _Requirements: 6.2, 6.3_

- [~] 8. Implement comprehensive path validation
  - [~] 8.1 Add path component validation
    - Implement validation for empty or invalid path components
    - Add validation for special characters in shop names and page IDs
    - Implement path structure format checking
    - Add descriptive error messages for validation failures
    - _Requirements: 6.1, 6.4_

  - [ ]* 8.2 Write property test for path component validation
    - **Property 10: Path Component Validation**
    - **Validates: Requirements 6.1**

  - [ ]* 8.3 Write property test for path structure recognition
    - **Property 12: Path Structure Recognition**
    - **Validates: Requirements 6.4**

  - [ ]* 8.4 Write unit tests for validation edge cases
    - Test validation with special characters
    - Test validation with empty components
    - Test path format recognition accuracy
    - _Requirements: 6.1, 6.4_

- [~] 9. Ensure hierarchical organization compliance
  - [~] 9.1 Verify folder hierarchy implementation
    - Review all path generation to ensure shop-first organization
    - Verify type separation (baseline/runs/diffs) in all paths
    - Ensure run identifier organization within type folders
    - Verify descriptive filenames for page snapshots
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.2 Write property test for hierarchical organization
    - **Property 13: Hierarchical Organization**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [ ]* 9.3 Write unit tests for folder hierarchy
    - Test shop-first organization
    - Test type separation in paths
    - Test run identifier organization
    - Test descriptive filename generation
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [~] 10. Integration and testing
  - [~] 10.1 Update route handlers to use new path utilities
    - Update `app/routes/app.snapshot.tsx` to use new path utilities where needed
    - Ensure UI can display images using new web paths
    - Update any other route handlers that work with image paths
    - _Requirements: 4.4_

  - [ ]* 10.2 Write integration tests for complete flow
    - Test snapshot creation to path storage flow
    - Test comparison generation to diff storage flow
    - Test UI image display with new paths
    - _Requirements: 1.1, 1.2, 2.1, 4.1, 4.2_

- [~] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- Migration utility preserves existing data while updating to new structure
- All path operations go through centralized utility for consistency