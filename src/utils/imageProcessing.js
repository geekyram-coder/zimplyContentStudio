/**
 * Resizes an image file using HTML5 Canvas.
 * Matches requirements: max 720px width/height (fit: 'inside'), without enlargement, output as PNG.
 * 
 * @param {File} file - The original image file.
 * @returns {Promise<Blob>} - A promise that resolves to the resized PNG Blob.
 */
export const resizeImageToPng = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX_SIZE = 720;
      let width = img.width;
      let height = img.height;

      // withoutEnlargement: true
      if (width > MAX_SIZE || height > MAX_SIZE) {
        // fit: 'inside'
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      // Draw image to canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Export as PNG
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas export failed'));
        }
      }, 'image/png');
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };

    img.src = url;
  });
};
