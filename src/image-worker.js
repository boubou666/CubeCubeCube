import { generateImagePuzzle } from './image-puzzle.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ level: generateImagePuzzle(data) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
