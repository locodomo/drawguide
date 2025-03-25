import React from 'react';
import { X, Download } from 'lucide-react';

interface PreviewPopupProps {
  gifUrl: string;
  onClose: () => void;
  onSave: () => void;
}

const PreviewPopup: React.FC<PreviewPopupProps> = ({ gifUrl, onClose, onSave }) => {
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
          <img
            src={gifUrl}
            alt="Animation preview"
            className="w-full h-full object-contain"
          />
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
            className="px-4 py-2 text-sm bg-purple-500 text-white hover:bg-purple-600 rounded-lg flex items-center gap-2"
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