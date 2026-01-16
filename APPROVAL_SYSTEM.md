# Visual Regression Approval System

## Overview

This project uses a **Gold Master** (Page-Level) approval system. Instead of approving entire runs as baselines, you approve individual pages. The approved version of a page becomes the "Gold Master" against which all future snapshots of that page are compared.

---

## Architecture

### 1. Gold Master Storage
- **Location**: `public/baselines/{storeId}/{pageName}.png`
- **Concept**: A dedicated folder containing the *single source of truth* image for each page.
- **Update Mechanism**: When you approve a page, the system copies that specific snapshot into this folder, overwriting any previous version.

### 2. Database Models
- **`PageBaseline`**: Tracks the active "Gold Master" for each page.
  - `storeId`: The store the page belongs to.
  - `pageName`: Unique identifier for the page (e.g., "homepage").
  - `imagePath`: Path to the gold master image.
  - `snapshotPageId`: Reference to the original snapshot used as the source.
- **`SnapshotComparison`**: Records the result of comparing a target page against the Gold Master.
  - `approvalStatus`: Tracks if the difference was accepted (APPROVED), rejected (REJECTED), or auto-accepted (AUTO_APPROVED).

---

## Workflow

### 1. Taking Snapshots
- User initiates a snapshot run.
- Playwright captures images to `public/snapshots/{runId}/...`.

### 2. Comparison
- System iterates through each captured page.
- Checks `PageBaseline` table for a standard comparison image.
  - **Found**: Compares Current Snapshot vs Gold Master.
  - **Not Found**: Falls back to comparing against the first run (or no comparison).
- Generates diff image and score.
- Auto-approves if difference < 0.01%.

### 3. Approval
- User reviews pending comparisons in the UI.
- **Approve**:
  1. Image is copied to `public/baselines/{storeId}/`.
  2. `PageBaseline` is updated.
  3. `SnapshotComparison` marked as APPROVED.
- **Reject**:
  1. `SnapshotComparison` marked as REJECTED.
  2. User can provide a reason. (Gold Master remains unchanged).

---

## Technical Details

### API Endpoints
- **Approve**: `POST /app/compare/:runId` `action=approve`
- **Reject**: `POST /app/compare/:runId` `action=reject`

### Code Locations
- **Logic**: `app/services/compareJob.server.ts` (Comparison)
- **Actions**: `app/routes/app.compare.$runId.tsx` (Approval/Rejection)
- **Model**: `prisma/schema.prisma`

### Troubleshooting
- **Missing Baselines**: If a page has no baseline, the UI will show "No Baseline". Approve the current version to set it as the first baseline.
- **Filesystem**: Ensure `public/baselines` is writable.
