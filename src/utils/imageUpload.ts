export interface QueuedPhotoDraft {
  localId: string;
  fileName: string;
  dataUrl: string;
  caption: string;
  tag: string;
  sizeBytes: number;
}

export interface GroundingLink {
  type: 'web' | 'maps';
  title: string;
  uri: string;
  snippet?: string;
}

/**
 * Pure helper to build a default human-readable caption from an uploaded filename.
 */
export function buildCaptionFromFilename(fileName: string): string {
  const base = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || /^\d+$/.test(base) || /^img\s*\d+$/i.test(base)) {
    return 'Captured wedding celebration moment';
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Pure helper to validate & normalize batch photo drafts before upload.
 */
export function prepareBatchPhotoPayloads(
  drafts: QueuedPhotoDraft[],
  uploaderName: string,
  uploaderRole: 'Couple' | 'Guest',
  defaultTag = 'Candid'
) {
  return drafts
    .filter((d) => Boolean(d.dataUrl && d.dataUrl.startsWith('data:image/') || d.dataUrl.startsWith('/')))
    .map((d, idx) => ({
      id: `p-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      uploaderName: uploaderName.trim() || 'Wedding Guest',
      uploaderRole,
      imageUrl: d.dataUrl,
      caption: d.caption.trim() || buildCaptionFromFilename(d.fileName),
      timestampLabel: 'Just now',
      tags: [d.tag || defaultTag],
    }));
}

/**
 * Pure helper to extract unique, clickable web & Google Maps links from Gemini groundingChunks.
 */
export function extractGroundingLinks(groundingChunks: any[] | undefined | null): GroundingLink[] {
  if (!Array.isArray(groundingChunks)) return [];
  const seen = new Set<string>();
  const links: GroundingLink[] = [];

  for (const chunk of groundingChunks) {
    if (chunk?.web?.uri && !seen.has(chunk.web.uri)) {
      seen.add(chunk.web.uri);
      links.push({
        type: 'web',
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
      });
    }
    if (chunk?.maps?.uri && !seen.has(chunk.maps.uri)) {
      seen.add(chunk.maps.uri);
      const snippet = chunk.maps.placeAnswerSources?.reviewSnippets?.[0]?.content;
      links.push({
        type: 'maps',
        title: chunk.maps.title || 'View Place on Google Maps',
        uri: chunk.maps.uri,
        snippet,
      });
    }
  }
  return links;
}

/**
 * Browser-side image compression using HTML5 Canvas so multiple large camera photos
 * upload reliably and render crisply in PostgreSQL / published links.
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 1400,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(`Invalid image file ${file.name}`));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
