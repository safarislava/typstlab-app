import React from 'react';
import { Download } from 'lucide-react';
import { useTypstCompiler } from '../../../hooks';

export const ExportPdfButton: React.FC = () => {
  const { compilerReady, isCompiling, exportPdf } = useTypstCompiler();

  return (
    <button
      className="export-pdf-btn"
      onClick={() => { void exportPdf(); }}
      disabled={!compilerReady || isCompiling}
      title="Export PDF"
    >
      <Download size={15} />
      <span>Export PDF</span>
    </button>
  );
};
