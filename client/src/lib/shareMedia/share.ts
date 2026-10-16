import { zipSync } from 'fflate';

/** ASCII file-name slug; strips Vietnamese diacritics ("Bạn hiểu mình" → "ban-hieu-minh"). */
export function slugify(text: string) {
  const slug = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'quiz';
}

export function canShareFiles(files: File[]) {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files });
  } catch {
    return false;
  }
}

/** Opens the native share sheet. Must run from a tap, not after a long await. Resolves false if the user cancels. */
export async function shareFiles(files: File[], details: { title: string; text?: string }) {
  try {
    await navigator.share({ files, title: details.title, text: details.text });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** One file downloads as-is; several are bundled into a ZIP. */
export async function downloadFiles(files: File[], zipName: string) {
  if (files.length === 1) {
    saveBlob(files[0], files[0].name);
    return;
  }
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = new Uint8Array(await file.arrayBuffer());
  // PNG and MP4 are already compressed, so store without deflating.
  saveBlob(new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }), zipName);
}
