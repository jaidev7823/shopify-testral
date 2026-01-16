import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { takeSnapshot } from '../snapshot.server';
import { getBaselineWebPath, getCurrentRunWebPath } from '~/utils/image-paths.server';
import fs from 'fs/promises';
import path from 'path';

// Mock playwright to avoid actual browser launches in tests
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          fill: vi.fn(),
          click: vi.fn(),
          waitForNavigation: vi.fn(),
          waitForTimeout: vi.fn(),
          addStyleTag: vi.fn(),
          screenshot: vi.fn(),
          close: vi.fn(),
          $: vi.fn().mockResolvedValue(null),
        }),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

describe('Snapshot Service Integration', () => {
  const testShop = 'test-shop';
  const testRunId = 'test-run-123';
  const testPageId = 'homepage';
  const testUrl = 'https://test-shop.myshopify.com';

  beforeEach(async () => {
    // Clean up any test files
    const testDir = path.join(process.cwd(), 'public', 'screenshots', testShop);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test files
    const testDir = path.join(process.cwd(), 'public', 'screenshots', testShop);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist, that's fine
    }
  });

  it('should generate baseline snapshot path correctly', async () => {
    const result = await takeSnapshot({
      shop: testShop,
      runId: testRunId,
      pageId: testPageId,
      url: testUrl,
      isBaseline: true,
    });

    const expectedPath = getBaselineWebPath({
      shop: testShop,
      runId: testRunId,
      pageId: testPageId,
    });

    expect(result).toBe(expectedPath);
    expect(result).toBe(`/screenshots/${testShop}/baseline/${testRunId}/${testPageId}.png`);
  });

  it('should generate current run snapshot path correctly', async () => {
    const result = await takeSnapshot({
      shop: testShop,
      runId: testRunId,
      pageId: testPageId,
      url: testUrl,
      isBaseline: false,
    });

    const expectedPath = getCurrentRunWebPath({
      shop: testShop,
      runId: testRunId,
      pageId: testPageId,
    });

    expect(result).toBe(expectedPath);
    expect(result).toBe(`/screenshots/${testShop}/runs/${testRunId}/${testPageId}.png`);
  });

  it('should create directory structure before taking screenshot', async () => {
    await takeSnapshot({
      shop: testShop,
      runId: testRunId,
      pageId: testPageId,
      url: testUrl,
      isBaseline: true,
    });

    // Check that the directory was created
    const expectedDir = path.join(
      process.cwd(),
      'public',
      'screenshots',
      testShop,
      'baseline',
      testRunId
    );

    const dirExists = await fs.access(expectedDir).then(() => true).catch(() => false);
    expect(dirExists).toBe(true);
  });
});