/**
 * Client-side image compression utility
 * Target: <= 500 KB per image with high visual quality
 */

const MAX_FILE_SIZE = 500 * 1024; // 500 KB
const MAX_DIMENSION = 1920; // Max long edge
const THUMB_DIMENSION = 320; // Thumbnail long edge
const THUMB_MAX_SIZE = 60 * 1024; // 60 KB target for thumbnails

/**
 * Get corrected orientation from EXIF data
 */
function getOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target.result);
      if (view.getUint16(0, false) !== 0xFFD8) {
        resolve(1); // Not a JPEG
      }
      const length = view.byteLength;
      let offset = 2;
      while (offset < length) {
        if (view.getUint16(offset + 2, false) <= 8) return resolve(1);
        const marker = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xFFE1) {
          if (view.getUint32(offset += 2, false) !== 0x45786966) {
            return resolve(1);
          }
          const little = view.getUint16(offset += 6, false) === 0x4949;
          offset += view.getUint32(offset + 4, little);
          const tags = view.getUint16(offset, little);
          offset += 2;
          for (let i = 0; i < tags; i++) {
            if (view.getUint16(offset + (i * 12), little) === 0x0112) {
              return resolve(view.getUint16(offset + (i * 12) + 8, little));
            }
          }
        } else if ((marker & 0xFF00) !== 0xFF00) {
          break;
        } else {
          offset += view.getUint16(offset, false);
        }
      }
      resolve(1);
    };
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
  });
}

/**
 * Load image from file
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Resize and compress image to meet size requirements
 */
async function compressImage(file, maxSize, maxDimension, quality = 0.82) {
  const img = await loadImage(file);
  const orientation = await getOrientation(file);
  
  // Calculate new dimensions
  let { width, height } = img;
  const longEdge = Math.max(width, height);
  
  if (longEdge > maxDimension) {
    const scale = maxDimension / longEdge;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Create canvas with orientation correction
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Apply orientation transforms
  if (orientation > 4) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  // Transform based on EXIF orientation
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, height, width); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
  }

  ctx.drawImage(img, 0, 0, width, height);

  // Try compression with current quality
  let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  
  // If too large, reduce quality iteratively
  const qualitySteps = [0.75, 0.68, 0.60, 0.50];
  let stepIndex = 0;
  
  while (blob.size > maxSize && stepIndex < qualitySteps.length) {
    blob = await new Promise(resolve => 
      canvas.toBlob(resolve, 'image/jpeg', qualitySteps[stepIndex])
    );
    stepIndex++;
  }

  // If still too large, reduce dimensions
  if (blob.size > maxSize) {
    const reducedDimension = Math.round(maxDimension * 0.75);
    return compressImage(file, maxSize, reducedDimension, 0.75);
  }

  return {
    blob,
    width: canvas.width,
    height: canvas.height
  };
}

/**
 * Compress image for main storage (max 500 KB)
 */
export async function compressMainImage(file) {
  try {
    const result = await compressImage(file, MAX_FILE_SIZE, MAX_DIMENSION);
    return result;
  } catch (error) {
    console.error('Error compressing main image:', error);
    throw error;
  }
}

/**
 * Create thumbnail (max 60 KB target)
 */
export async function createThumbnail(file) {
  try {
    const result = await compressImage(file, THUMB_MAX_SIZE, THUMB_DIMENSION, 0.75);
    return result;
  } catch (error) {
    console.error('Error creating thumbnail:', error);
    throw error;
  }
}

/**
 * Process a single photo file
 */
export async function processPhoto(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  const [mainResult, thumbResult] = await Promise.all([
    compressMainImage(file),
    createThumbnail(file)
  ]);

  return {
    main: mainResult,
    thumb: thumbResult,
    originalName: file.name
  };
}