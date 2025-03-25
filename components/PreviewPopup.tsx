import React from 'react';
import { X, Download, Loader2 } from 'lucide-react';

interface PreviewPopupProps {
  gifUrl: string;
  onClose: () => void;
  onSave: () => void;
  isGenerating?: boolean;
}

const PreviewPopup: React.FC<PreviewPopupProps> = ({ gifUrl, onClose, onSave, isGenerating = false }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Animation Preview</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden mb-4">
          {isGenerating ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <span className="text-sm text-gray-600">Generating GIF...</span>
              </div>
            </div>
          ) : (
            <img
              src={gifUrl}
              alt="Animation preview"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={onSave}
            disabled={isGenerating}
            className="px-4 py-2 text-sm bg-purple-500 text-white hover:bg-purple-600 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Save GIF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewPopup; 