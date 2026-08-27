import { $typst } from '@myriaddreamin/typst.ts';
import type { TypstFile } from '../../core/types';
import { syncFilesToVfs } from './vfsBridge';
import { compilerQueue } from './compilerQueue';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportProjectToPdf(
  files: Record<string, TypstFile>,
  mainFilePath: string,
  projectName: string
): Promise<void> {
  const activeFile = files[mainFilePath];
  if (!activeFile || activeFile.isBinary) return;

  await syncFilesToVfs(files);

  const pdfBytes = await compilerQueue.run(() =>
    $typst.pdf({ mainFilePath: `/${mainFilePath}` })
  );

  if (pdfBytes) {
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const safeTitle = projectName.toLowerCase().replace(/\s+/g, '_') || 'document';
    downloadBlob(blob, `${safeTitle}.pdf`);
  }
}
