import { $typst } from '@myriaddreamin/typst.ts';
import type { TypstFile } from '../store/documentSlice';

// Keep track of paths that have been mapped to the Typst compiler VFS
const mappedPaths = new Set<string>();

/**
 * Syncs the local Redux document files to the Typst compiler's virtual file system (VFS).
 * Maps binary files using mapShadow and text documents using addSource.
 * Automatically unmaps files that have been deleted or renamed.
 */
export const syncFilesToVfs = async (files: Record<string, TypstFile>): Promise<void> => {
  const currentPaths = new Set(Object.values(files).map(file => `/${file.path}`));

  // Unmap files that were previously mapped but are no longer in the project (deleted or renamed)
  for (const path of mappedPaths) {
    if (!currentPaths.has(path)) {
      try {
        await $typst.unmapShadow(path);
      } catch (err) {
        console.warn(`Failed to unmap shadow file ${path}:`, err);
      }
    }
  }

  // Sync current files
  await Promise.all(
    Object.values(files).map(async (file) => {
      const path = `/${file.path}`;
      if (file.isBinary && file.binaryData) {
        await $typst.mapShadow(path, file.binaryData);
      } else if (!file.isBinary && file.cells) {
        const content = file.cells.map(c => c.content).join('\n\n');
        await $typst.addSource(path, content);
      }
    })
  );

  // Update mappedPaths to match exactly the current files
  mappedPaths.clear();
  currentPaths.forEach(path => mappedPaths.add(path));
};
