import { validImageLevel, IMAGE_DIFFICULTIES, IMAGE_DETAILS } from './image-puzzle.js';
export const IMAGE_DB = 'cube-image-puzzles';
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('puzzles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readImageSave() {
  const db = await database();
  try {
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction('puzzles').objectStore('puzzles').get('active');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    if (record?.version !== 1 || !validImageLevel(record.level) || !Array.isArray(record.history) || !record.history.every(Number.isInteger) || typeof record.source?.dataUrl !== 'string' || !record.source.dataUrl.startsWith('data:image/') || typeof record.source.name !== 'string' || !Object.hasOwn(IMAGE_DIFFICULTIES, record.difficulty) || !Object.hasOwn(IMAGE_DETAILS, record.detail) || !Number.isSafeInteger(record.variation) || record.variation < 0) return null;
    const crop = record.crop;
    if (!crop || ![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.w < 0.04 || crop.h < 0.04 || crop.x + crop.w > 1.000001 || crop.y + crop.h > 1.000001) return null;
    return record;
  } finally { db.close(); }
}
export async function writeImageSave(record) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('puzzles', 'readwrite');
      transaction.objectStore('puzzles').put(record, 'active');
      transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
