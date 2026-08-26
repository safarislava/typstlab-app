import { $typst } from '@myriaddreamin/typst.ts';
import type { TypstFile } from '../../core/types';

const mappedPaths = new Set<string>();

/**
 * Synchronizes document files to the Typst compiler Virtual File System (VFS).
 */
export async function syncFilesToVfs(files: Record<string, TypstFile>): Promise<void> {
  const currentPaths = new Set(Object.values(files).map(file => `/${file.path}`));

  for (const path of mappedPaths) {
    if (!currentPaths.has(path)) {
      try {
        await $typst.unmapShadow(path);
      } catch (err) {
        console.warn(`Failed to unmap shadow file ${path}:`, err);
      }
    }
  }

  await Promise.all(
    Object.values(files).map(async file => {
      const path = `/${file.path}`;
      if (file.isBinary && file.binaryData) {
        await $typst.mapShadow(path, file.binaryData);
      } else if (!file.isBinary && file.cells) {
        const content = file.cells.map(c => c.content).join('\n\n');
        await $typst.addSource(path, content);
      }
    })
  );

  mappedPaths.clear();
  currentPaths.forEach(path => mappedPaths.add(path));
}
