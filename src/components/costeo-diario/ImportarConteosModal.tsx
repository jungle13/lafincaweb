'use client';

import React, { useState } from 'react';
import ImportadorTxtModal from '@/components/ui/ImportadorTxtModal';
import {
  parseConteosTxt,
  PROMPT_IMPORTAR_CONTEOS,
  ConteoArchivoParsed
} from '@/lib/conteosParser';

interface ImportarConteosModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: any[];
  onImportSuccess: (parsedData: ConteoArchivoParsed) => void;
}

export default function ImportarConteosModal({
  isOpen,
  onClose,
  catalog,
  onImportSuccess
}: ImportarConteosModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileContent = async (text: string, filename: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      if (!text || !text.trim()) {
        throw new Error('El archivo seleccionado está vacío.');
      }

      const parsed = parseConteosTxt(text, catalog);

      if (parsed.totalItems === 0) {
        throw new Error(
          'No se encontraron insumos válidos en las 7 secciones de conteos. Asegúrate de usar el formato de la plantilla oficial con el prompt de IA.'
        );
      }

      onImportSuccess(parsed);
      onClose();
    } catch (err: unknown) {
      console.error('Error al parsear conteos TXT:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo de conteos.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ImportadorTxtModal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar Conteos de Cocina y Bodega"
      subtitle="Digitaliza de una sola vez Cocina Apertura, Traslados, Devoluciones, Cocina Cierre, Consumos y Bodega"
      dropzoneTitle="Arrastra aquí el archivo .txt de Conteos Diarios"
      dropzoneSubtitle="o haz clic para buscarlo en tu computador"
      promptTitle="¿Tienes fotos de planillas físicas? Usa este Prompt de IA"
      promptDescription="Copia este prompt y pégalo en ChatGPT, Claude o Gemini adjuntando las fotos de los conteos. La IA organizará las 7 hojas en el formato oficial de La Finca para que arrastres el archivo resultante aquí."
      promptTemplate={PROMPT_IMPORTAR_CONTEOS}
      onFileContent={handleFileContent}
      isProcessing={isProcessing}
      error={error}
    />
  );
}
