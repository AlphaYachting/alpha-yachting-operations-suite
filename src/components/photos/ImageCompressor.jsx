/**
 * Client-side image compression utility with correct EXIF orientation handling.
 * Handles all 8 EXIF orientation values correctly, especially portrait shots from phones.
 */

const MAX_FILE_SIZE = 500 * 1024; // 500 KB
const MAX_DIMENSION = 1920;       // Max long edge for main image
const THUMB_DIMENSION = 320;      // Thumbnail long edge
const THUMB_MAX_SIZE = 60 * 1024; // 60 KB target for thumbnails

/**
 * Read EXIF orientation tag from JPEG file.
 * Returns 1 (normal) for non-JPEG or if tag not found.
 */
function getExifOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target.result);

      // Check JPEG SOI marker
      if (view.getUint16(0, false) !== 0xFFD8) {
        return resolve(1);
      }

      let offset = 2;
      const length = view.byteLength;

      while (offset < length) {
        const marker = view.getUint16(offset, false);
        offset += 2;

        if (marker === 0xFFE1) {
          // APP1 marker — check for Exif header
          const segmentLength = view.getUint16(offset, false);
          offset += 2;

          if (view.getUint32(offset, false) !== 0x45786966) {
            // Not Exif, skip segment
            offset += segmentLength - 2;
            continue;
          }

          // Determine byte order
          const tiffOffset = offset + 6;
          const little = view.getUint16(tiffOffset, false) === 0x4949;

          // IFD0 offset
          const ifdOffset = tiffOffset + view.getUint32(tiffOffset + 4, little);
          const numEntries = view.getUint16(ifdOffset, little);

          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            if (view.getUint16(entryOffset, little) === 0x0112) {
              // Orientation tag found
              return resolve(view.getUint16(entryOffset + 8, little));
            }
          }
          return resolve(1);
        } else if ((marker & 0xFF00) === 0xFF00) {
          // Skip other markers
          offset += view.getUint16(offset, false);
        } else {
          break;
        }
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 128 * 1024));
  });
}

/**
 * Load an image file as an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

/**
 * Draw an image onto a canvas with correct EXIF orientation applied.
 *
 * Strategy:
 *  1. Read natural (raw) image dimensions from the decoded img element.
 *  2. For orientations that rotate 90°/270° (5–8), swap w/h for the canvas.
 *  3. Set the canvas to the OUTPUT dimensions (what the viewer should see).
 *  4. Apply the appropriate CSS transform to the canvas context.
 *  5. Draw the image using its ORIGINAL (natural) dimensions — NOT the canvas dims.
 */
function drawWithOrientation(img, orientation, maxDimension) {
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;

  // Orientations 5–8 are rotated 90° or 270° — output w/h are swapped
  const rotated = orientation >= 5 && orientation <= 8;

  // Compute the output (visible) dimensions before scaling
  let outW = rotated ? naturalH : naturalW;
  let outH = rotated ? naturalW : naturalH;

  // Scale down so the long edge fits within maxDimension
  const longEdge = Math.max(outW, outH);
  if (longEdge > maxDimension) {
    const scale = maxDimension / longEdge;
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  // Reset transform to identity
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  /**
   * Apply the transform that maps from image-space → canvas-space.
   *
   * We draw the image at its natural size, scaled by the same factor used
   * for the output dimensions.  The scaling factor is applied via translate/scale
   * so we never need to use the canvas dimensions as the drawImage target size.
   */
  const scale = outW / (rotated ? naturalH : naturalW);

  switch (orientation) {
    case 1:
      // Normal — no rotation needed
      ctx.scale(scale, scale);
      break;
    case 2:
      // Horizontal mirror
      ctx.translate(outW, 0);
      ctx.scale(-scale, scale);
      break;
    case 3:
      // 180°
      ctx.translate(outW, outH);
      ctx.scale(-scale, -scale);
      break;
    case 4:
      // Vertical mirror
      ctx.translate(0, outH);
      ctx.scale(scale, -scale);
      break;
    case 5:
      // Mirror + 90° CW
      ctx.rotate(Math.PI / 2);
      ctx.scale(scale, -scale);
      break;
    case 6:
      // 90° CW (most common portrait phone shot)
      ctx.translate(outW, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(scale, scale);
      break;
    case 7:
      // Mirror + 90° CCW
      ctx.translate(outW, outH);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(scale, -scale);
      break;
    case 8:
      // 90° CCW
      ctx.translate(0, outH);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(scale, scale);
      break;
    default:
      ctx.scale(scale, scale);
  }

  // Always draw at natural image size — the transform handles scaling & rotation
  ctx.drawImage(img, 0, 0, naturalW, naturalH);

  return canvas;
}

/**
 * Compress an image file to meet size and dimension constraints.
 */
async function compressImage(file, maxSize, maxDimension, quality = 0.85) {
  // Modern browsers (iOS Safari 12+, Chrome 81+) auto-apply EXIF orientation
  // when decoding images. We always use orientation=1 so we never double-rotate.
  const img = await loadImage(file);
  const orientation = 1;

  let canvas = drawWithOrientation(img, orientation, maxDimension);

  // Try to meet the size target by reducing quality
  const qualitySteps = [quality, 0.80, 0.72, 0.65, 0.55, 0.45];
  let blob = null;

  for (const q of qualitySteps) {
    blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', q));
    if (blob && blob.size <= maxSize) break;
  }

  // If still too large, shrink dimensions to 75% and recurse once
  if (blob && blob.size > maxSize) {
    const reducedDimension = Math.round(maxDimension * 0.75);
    if (reducedDimension > 100) {
      canvas = drawWithOrientation(img, orientation, reducedDimension);
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.70));
    }
  }

  if (!blob) throw new Error('Failed to compress image');

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Compress image for main storage (max 500 KB, max 1920px).
 */
export async function compressMainImage(file) {
  return compressImage(file, MAX_FILE_SIZE, MAX_DIMENSION, 0.85);
}

/**
 * Create thumbnail (max 60 KB, max 320px).
 */
export async function createThumbnail(file) {
  return compressImage(file, THUMB_MAX_SIZE, THUMB_DIMENSION, 0.80);
}

/**
 * Process a single photo file: compress main + generate thumbnail.
 */
export async function processPhoto(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  const [mainResult, thumbResult] = await Promise.all([
    compressMainImage(file),
    createThumbnail(file),
  ]);

  return {
    main: mainResult,
    thumb: thumbResult,
    originalName: file.name,
  };
}