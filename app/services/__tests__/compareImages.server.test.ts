import { describe, it, expect } from 'vitest';
import { getDiffWebPath } from '../../utils/image-paths.server';
import type { CompareImagesOptions } from '../compareImages.server';

describe('compareImages interface', () => {
  it('should have correct interface structure', () => {
    // Test that the interface accepts the required parameters
    const options: CompareImagesOptions = {
      shop: 'test-shop',
      baselineRunId: 'run-123',
      currentRunId: 'run-456',
      pageId: 'homepage',
      baselineImagePath: '/screenshots/test-shop/baseline/run-123/homepage.png',
      currentImagePath: '/screenshots/test-shop/runs/run-456/homepage.png'
    };

    // Verify all required fields are present
    expect(options.shop).toBe('test-shop');
    expect(options.baselineRunId).toBe('run-123');
    expect(options.currentRunId).toBe('run-456');
    expect(options.pageId).toBe('homepage');
    expect(options.baselineImagePath).toBe('/screenshots/test-shop/baseline/run-123/homepage.png');
    expect(options.currentImagePath).toBe('/screenshots/test-shop/runs/run-456/homepage.png');
  });

  it('should generate correct diff path using getDiffWebPath', () => {
    const diffPath = getDiffWebPath({
      shop: 'test-shop',
      baselineRunId: 'run-123',
      currentRunId: 'run-456',
      pageId: 'homepage'
    });

    expect(diffPath).toBe('/screenshots/test-shop/diffs/run-123_vs_run-456/homepage.png');
  });

  it('should support different shop and run ID combinations', () => {
    const diffPath = getDiffWebPath({
      shop: 'my-store',
      baselineRunId: 'baseline-001',
      currentRunId: 'current-002',
      pageId: 'product-page'
    });

    expect(diffPath).toBe('/screenshots/my-store/diffs/baseline-001_vs_current-002/product-page.png');
  });

  it('should organize diff images by shop identifier', () => {
    const shop1Path = getDiffWebPath({
      shop: 'shop1',
      baselineRunId: 'run-1',
      currentRunId: 'run-2',
      pageId: 'page'
    });

    const shop2Path = getDiffWebPath({
      shop: 'shop2',
      baselineRunId: 'run-1',
      currentRunId: 'run-2',
      pageId: 'page'
    });

    expect(shop1Path).toContain('/shop1/');
    expect(shop2Path).toContain('/shop2/');
    expect(shop1Path).not.toBe(shop2Path);
  });

  it('should include both baseline and current run identifiers in path', () => {
    const diffPath = getDiffWebPath({
      shop: 'test-shop',
      baselineRunId: 'baseline-abc',
      currentRunId: 'current-xyz',
      pageId: 'homepage'
    });

    expect(diffPath).toContain('baseline-abc_vs_current-xyz');
  });

  it('should store diff images in dedicated diffs folder structure', () => {
    const diffPath = getDiffWebPath({
      shop: 'test-shop',
      baselineRunId: 'run-123',
      currentRunId: 'run-456',
      pageId: 'homepage'
    });

    expect(diffPath).toMatch(/^\/screenshots\/[^\/]+\/diffs\//);
  });
});