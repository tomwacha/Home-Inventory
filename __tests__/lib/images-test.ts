import {
  buildItemImageFileName,
  buildResizeActionForMaxDimension,
  MAX_IMAGE_DIMENSION_PX,
} from '@/lib/images';

/**
 * Unit tests for pure image helpers (no camera or file system needed).
 */
describe('buildItemImageFileName', () => {
  // Confirms the file name embeds the timestamp for uniqueness.
  test('builds a jpeg name from a timestamp', () => {
    const fileName = buildItemImageFileName(1_700_000_000_000);

    expect(fileName).toBe('item-1700000000000.jpg');
  });
});

describe('buildResizeActionForMaxDimension', () => {
  // Confirms small images are left alone (caller still may re-encode as JPEG).
  test('returns null when both sides are within the max size', () => {
    const resizeAction = buildResizeActionForMaxDimension(800, 600);

    expect(resizeAction).toBeNull();
  });

  // Confirms landscape photos shrink by width.
  test('resizes landscape images by width', () => {
    const resizeAction = buildResizeActionForMaxDimension(4000, 2000);

    expect(resizeAction).toEqual({
      resize: {
        width: MAX_IMAGE_DIMENSION_PX,
      },
    });
  });

  // Confirms portrait photos shrink by height.
  test('resizes portrait images by height', () => {
    const resizeAction = buildResizeActionForMaxDimension(1200, 3000);

    expect(resizeAction).toEqual({
      resize: {
        height: MAX_IMAGE_DIMENSION_PX,
      },
    });
  });

  // Confirms a square larger than the max shrinks by width (width >= height branch).
  test('resizes oversized square images by width', () => {
    const resizeAction = buildResizeActionForMaxDimension(2048, 2048);

    expect(resizeAction).toEqual({
      resize: {
        width: MAX_IMAGE_DIMENSION_PX,
      },
    });
  });
});
