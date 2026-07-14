import { $typst } from '@myriaddreamin/typst.ts';
import type { TypstFile } from '../store/documentSlice';

/**
 * Syncs the local Redux document files to the Typst compiler's virtual file system (VFS).
 * Maps binary files using mapShadow and text documents using addSource.
 */
export const syncFilesToVfs = async (files: Record<string, TypstFile>): Promise<void> => {
  await Promise.all(
    Object.values(files).map(async (file) => {
      if (file.isBinary && file.binaryData) {
        await $typst.mapShadow(`/${file.path}`, file.binaryData);
      } else if (!file.isBinary && file.cells) {
        const content = file.cells.map(c => c.content).join('\n\n');
        await $typst.addSource(`/${file.path}`, content);
      }
    })
  );
};
