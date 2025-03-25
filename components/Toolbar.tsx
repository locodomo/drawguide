'use client';

import React, { useRef, useState } from 'react';
import { 
  Brush, 
  Eraser, 
  Grid as GridIcon,
  Undo2, 
  Redo2, 
  Save,
  Trash2,
  PaintBucket,
  X,
  Share2,
  Twitter,
  Instagram,
  Pin,
  Circle as CircleIcon,
  Square,
  Triangle,
  Hexagon,
  Shapes,
  FileVideo,
  StopCircle,
  Film
} from 'lucide-react';

type ToolType = 'brush' | 'eraser' | 'circle' | 'square' | 'triangle' | 'hexagon';
type ShapeType = 'circle' | 'square' | 'triangle' | 'hexagon';

interface ToolbarProps {
  selectedTool: ToolType;
  strokeWidth: number;
  showGrid: boolean;
  gridSize: number;
  selectedColor: string;
  onToolSelect: (tool: ToolType) => void;
  onStrokeWidthChange: (width: number) => void;
  onGridToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onColorChange: (color: string) => void;
  onClearCanvas: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveImage: () => void;
  onShare?: (platform: string) => void;
  onFileUpload?: (file: File) => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onExportGif?: () => void;
  isRecording?: boolean;
  frameCount?: number;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedTool,
  strokeWidth,
  showGrid,
  gridSize,
  selectedColor,
  onToolSelect,
  onStrokeWidthChange,
  onGridToggle,
  onGridSizeChange,
  onColorChange,
  onClearCanvas,
  onUndo,
  onRedo,
  onSaveImage,
  onShare,
  onFileUpload,
  onStartRecording,
  onStopRecording,
  onExportGif,
  isRecording,
  frameCount = 0,
  fileInputRef
}) => {
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
  const [isGridSettingsOpen, setIsGridSettingsOpen] = useState(false);
  const [isStrokeSettingsOpen, setIsStrokeSettingsOpen] = useState(false);
  const [isShapesDropdownOpen, setIsShapesDropdownOpen] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('circle');

  const shapes = [
    { value: 'circle', label: 'Circle', icon: CircleIcon },
    { value: 'square', label: 'Square', icon: Square },
    { value: 'triangle', label: 'Triangle', icon: Triangle },
    { value: 'hexagon', label: 'Hexagon', icon: Hexagon },
  ];

  const shareOptions = [
    { platform: 'twitter', label: 'Twitter', icon: Twitter },
    { platform: 'threads', label: 'Threads', icon: Instagram },
    { platform: 'instagram', label: 'Instagram', icon: Instagram },
    { platform: 'pinterest', label: 'Pinterest', icon: Pin },
  ];

  const handleUploadClick = () => {
    if (fileInputRef?.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center mb-4 p-4 bg-white rounded-lg shadow-sm">
      <div className="flex gap-2 items-center">
        <img 
          src="/mslogo.svg" 
          alt="Logo" 
          width={23} 
          height={23} 
          className="mr-2"
        />
        <button
          onClick={() => onToolSelect('brush')}
          className={`p-1 rounded-lg hover:bg-gray-100 text-gray-900 ${
            selectedTool === 'brush' ? 'bg-orange-100' : ''
          }`}
          title="Brush"
        >
          <Brush size={16} />
        </button>
        <button
          onClick={() => onToolSelect('eraser')}
          className={`p-1 rounded-lg hover:bg-gray-100 text-gray-900 ${
            selectedTool === 'eraser' ? 'bg-orange-100' : ''
          }`}
          title="Eraser"
        >
          <Eraser size={16} />
        </button>
        <div className="relative">
          <button
            onClick={() => setIsShapesDropdownOpen(!isShapesDropdownOpen)}
            className={`p-1 rounded-lg hover:bg-gray-100 text-gray-900 ${
              ['circle', 'square', 'triangle', 'hexagon'].includes(selectedTool) ? 'bg-orange-100' : ''
            }`}
            title="Shapes"
          >
            <Shapes size={16} />
          </button>
          {isShapesDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
              {shapes.map((shape) => {
                const Icon = shape.icon;
                return (
                  <button
                    key={shape.value}
                    onClick={() => {
                      setSelectedShape(shape.value as ShapeType);
                      onToolSelect(shape.value as ToolType);
                      setIsShapesDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 text-xs text-gray-900 ${
                      selectedTool === shape.value ? 'bg-orange-50' : ''
                    }`}
                  >
                    <Icon size={16} />
                    <span>{shape.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsStrokeSettingsOpen(!isStrokeSettingsOpen)}
          className={`p-1 rounded-lg hover:bg-gray-100 text-gray-900 ${
            isStrokeSettingsOpen ? 'bg-orange-100' : ''
          }`}
          title="Stroke Width"
        >
          <PaintBucket size={16} />
        </button>
        {isStrokeSettingsOpen && (
          <div className="absolute top-full left-0 mt-1 p-4 w-64 bg-white border rounded-lg shadow-lg z-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Stroke Width</span>
                <button
                  onClick={() => setIsStrokeSettingsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{strokeWidth}</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-5 h-5 rounded cursor-pointer"
        />
      </div>

      <div className="relative">
        <button
          onClick={() => {
            onGridToggle();
            if (!showGrid) {
              setIsGridSettingsOpen(true);
            }
          }}
          className={`p-1 rounded-lg hover:bg-gray-100 text-gray-900 ${
            showGrid ? 'bg-orange-100' : ''
          }`}
          title="Toggle Grid"
        >
          <GridIcon size={16} />
        </button>
        {showGrid && isGridSettingsOpen && (
          <div className="absolute top-full left-0 mt-1 p-4 w-64 bg-white border rounded-lg shadow-lg z-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Grid Size</span>
                <button
                  onClick={() => setIsGridSettingsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{gridSize}</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={gridSize}
                onChange={(e) => onGridSizeChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <div className="h-6 w-px bg-gray-200 mx-2" />

      <div className="flex gap-2 ml-auto">
        <button
          onClick={onUndo}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-900"
          title="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={onRedo}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-900"
          title="Redo"
        >
          <Redo2 size={16} />
        </button>
        <button
          onClick={onSaveImage}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-900"
          title="Save Image"
        >
          <Save size={16} />
        </button>
        {!isRecording && onStartRecording && (
          <div className="relative group">
            <button
              onClick={onStartRecording}
              className="p-1 rounded-lg hover:bg-red-50 text-red-500"
              title="Start Recording"
            >
              <FileVideo size={16} />
            </button>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              Start Recording Drawing Process
            </div>
          </div>
        )}
        {isRecording && onStopRecording && (
          <div className="relative group">
            <button
              onClick={onStopRecording}
              className="p-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-500 animate-pulse"
              title="Stop Recording"
            >
              <StopCircle size={16} />
            </button>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              Stop Recording ({frameCount} frames captured)
            </div>
          </div>
        )}
        {onExportGif && frameCount > 0 && (
          <div className="relative group">
            <button
              onClick={onExportGif}
              className="p-1 rounded-lg hover:bg-purple-50 text-purple-500"
              title="Export GIF"
            >
              <Film size={16} />
            </button>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              Export Animation ({frameCount} frames)
            </div>
          </div>
        )}
        <button
          onClick={onClearCanvas}
          className="p-1 rounded-lg text-red-500 hover:bg-red-50"
          title="Clear Canvas"
        >
          <Trash2 size={16} />
        </button>
        <div className="relative">
          <button
            onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
            className={`p-1 rounded-lg hover:bg-blue-50 text-blue-500 ${
              isShareDropdownOpen ? 'bg-blue-100' : ''
            }`}
            title="Share"
          >
            <Share2 size={16} />
          </button>
          {isShareDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
              {shareOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.platform}
                    onClick={() => {
                      if (onShare) onShare(option.platform);
                      setIsShareDropdownOpen(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 text-xs text-gray-900`}
                  >
                    <Icon size={16} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toolbar; 