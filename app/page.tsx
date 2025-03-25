'use client';

import { useState, useRef, useEffect } from 'react';
import DrawingCanvas, { DrawingCanvasRef } from '@/components/DrawingCanvas';
import Toolbar from '@/components/Toolbar';
import PreviewPopup from '@/components/PreviewPopup';
import { Coffee } from 'lucide-react';
import { Outfit } from 'next/font/google';
import { useCanvasSize } from './hooks/useCanvasSize';

const outfit = Outfit({ subsets: ['latin'] });

interface GenerationResponse {
  imageUrl: string;
  error?: string;
}

export default function Home() {
  const [selectedTool, setSelectedTool] = useState<'brush' | 'eraser' | 'circle' | 'square' | 'triangle' | 'hexagon'>('brush');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(10);
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [prompt, setPrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const canvasSize = useCanvasSize(460);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isGenerationLimited, setIsGenerationLimited] = useState<boolean>(false);
  const canvasRef = useRef<DrawingCanvasRef | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sessionAttempts, setSessionAttempts] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [lastGeneratedDate, setLastGeneratedDate] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if the user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo: Cmd/Ctrl + Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canvasRef.current) {
          canvasRef.current.undo();
        }
      }

      // Redo: Cmd/Ctrl + Shift + Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canvasRef.current) {
          canvasRef.current.redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize storage values on client side only
  useEffect(() => {
    // Get daily count and last generated date
    const storedLastGenerated = localStorage.getItem('lastGeneratedDate');
    const currentDate = new Date().toDateString();
    const storedDailyCount = Number(localStorage.getItem('dailyGenerationCount') || '0');

    // Reset daily count if it's a new day
    if (storedLastGenerated !== currentDate) {
      localStorage.setItem('dailyGenerationCount', '0');
      localStorage.removeItem('lastGeneratedDate');
      setDailyCount(0);
      setLastGeneratedDate(null);
      setIsGenerationLimited(false);
    } else {
      setDailyCount(storedDailyCount);
      setLastGeneratedDate(storedLastGenerated);
      // Set generation limit based on stored count
      setIsGenerationLimited(storedDailyCount >= 2);
    }

    // Check limits after initializing state
    checkGenerationLimits();
  }, []);

  // Function to check if user has reached generation limits
  const checkGenerationLimits = () => {
    const currentDate = new Date().toDateString();
    
    const hasReachedLimit = 
      (lastGeneratedDate === currentDate && dailyCount >= 2); // Daily limit of 2
    
    setIsGenerationLimited(hasReachedLimit);
    
    return {
      hasReachedLimit,
      dailyAttemptsRemaining: lastGeneratedDate === currentDate ? Math.max(0, 2 - dailyCount) : 2
    };
  };

  // Function to update generation limits
  const updateGenerationLimits = () => {
    // Update session attempts
    const newSessionAttempts = sessionAttempts + 1;
    setSessionAttempts(newSessionAttempts);
    sessionStorage.setItem('generationAttempts', String(newSessionAttempts));
    
    // Update daily limit
    const currentDate = new Date().toDateString();
    
    if (lastGeneratedDate !== currentDate) {
      // Reset count for new day
      setDailyCount(1);
      localStorage.setItem('dailyGenerationCount', '1');
      setIsGenerationLimited(false);
    } else {
      // Increment count for current day
      const newDailyCount = dailyCount + 1;
      setDailyCount(newDailyCount);
      localStorage.setItem('dailyGenerationCount', String(newDailyCount));
      
      // Set generation limit if reached
      if (newDailyCount >= 2) {
        setIsGenerationLimited(true);
      }
    }
    
    setLastGeneratedDate(currentDate);
    localStorage.setItem('lastGeneratedDate', currentDate);
  };

  interface MangaStyle {
    value: string;
    label: string;
  }

  const mangaStyles: MangaStyle[] = [
    { value: '', label: 'Select a category' },
    { value: 'shounen', label: 'Shounen (Action/Adventure)' },
    { value: 'shoujo', label: 'Shoujo (Romance/Drama)' },
    { value: 'seinen', label: 'Seinen (Mature/Realistic)' },
    { value: 'chibi', label: 'Chibi (Cute/Super-deformed)' },
    { value: 'mecha', label: 'Mecha (Robots/Sci-fi)' },
  ];

  const handleGenerateStrokes = async () => {
    const limits = checkGenerationLimits();
    if (limits.hasReachedLimit) {
      const dailyMessage = limits.dailyAttemptsRemaining === 0 
        ? "You've reached the daily limit. Please try again tomorrow." 
        : "";
      setError(dailyMessage);
      return;
    }

    try {
      setError(null);
      if (!canvasRef.current) return;

      // If prompt is empty, just use the style
      const generationPrompt = prompt.trim() 
        ? `${prompt} in ${selectedStyle} style`
        : `${selectedStyle} style character`;

      await canvasRef.current.generateAIStrokes(generationPrompt);
      updateGenerationLimits();
    } catch (err) {
      console.error('Error generating strokes:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate strokes');
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file || !canvasRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      if (imageUrl) {
        canvasRef.current?.loadReferenceImage(imageUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleShare = async (platform: string) => {
    if (!canvasRef.current) return;

    try {
      // Get the canvas data URL at 4x resolution without grid and generated image
      const dataUrl = canvasRef.current.getCanvasDataUrlWithoutGrid(4);
      if (!dataUrl) {
        throw new Error('Failed to generate image data');
      }
      
      // Create sharing text
      const shareText = 'Check out my drawing made with DrawGuide!';
      
      // Handle different platforms
      switch (platform) {
        case 'twitter': {
          // Create a temporary link to download the image
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = 'drawing.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Open Twitter with the text
          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`);
          break;
        }
        case 'threads':
        case 'instagram': {
          // Save the image first
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = 'drawing.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Show instructions
          alert(`Image saved! You can now upload it to ${platform === 'threads' ? 'Threads' : 'Instagram'}.`);
          break;
        }
        case 'pinterest': {
          // Save the image first
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = 'drawing.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Open Pinterest with the URL
          window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}&description=${encodeURIComponent(shareText)}`);
          break;
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      setError('Failed to share image. Please try saving the image first and then sharing it manually.');
    }
  };

  useEffect(() => {
    setShowTooltip(true);
  }, []);

  const handleStartRecording = () => {
    if (canvasRef.current) {
      setIsRecording(true);
      setFrameCount(0);
      canvasRef.current.startRecording();
    }
  };

  const handleStopRecording = async () => {
    if (canvasRef.current) {
      try {
        setIsRecording(false);
        setIsGeneratingGif(true);
        const gifUrl = await canvasRef.current.stopRecording();
        setPreviewUrl(gifUrl);
      } catch (error) {
        console.error('Error stopping recording:', error);
      } finally {
        setIsGeneratingGif(false);
      }
    }
  };

  const handleExportGif = async () => {
    if (canvasRef.current) {
      setIsGeneratingGif(true);
      await canvasRef.current.exportGif();
      // Close preview after saving
      setPreviewUrl(null);
      setIsGeneratingGif(false);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Add frame count update handler
  const handleFrameCapture = (count: number) => {
    setFrameCount(count);
  };

  return (
    <main className={`min-h-screen p-2 sm:p-4 bg-gray-50 ${outfit.className}`}>
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-2 sm:p-4 rounded-lg shadow-sm">
          <div className="space-y-2 mb-2 sm:mb-4">
            <Toolbar
              selectedTool={selectedTool}
              strokeWidth={strokeWidth}
              showGrid={showGrid}
              gridSize={gridSize}
              selectedColor={selectedColor}
              onToolSelect={setSelectedTool}
              onStrokeWidthChange={setStrokeWidth}
              onGridToggle={() => setShowGrid(!showGrid)}
              onGridSizeChange={setGridSize}
              onColorChange={setSelectedColor}
              onClearCanvas={() => {
                if (canvasRef.current) {
                  canvasRef.current.clearCanvas();
                }
              }}
              onUndo={() => {
                if (canvasRef.current) {
                  canvasRef.current.undo();
                }
              }}
              onRedo={() => {
                if (canvasRef.current) {
                  canvasRef.current.redo();
                }
              }}
              onSaveImage={() => {
                if (canvasRef.current) {
                  canvasRef.current.saveImage();
                }
              }}
              onShare={handleShare}
              onFileUpload={handleFileUpload}
              fileInputRef={fileInputRef}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              onExportGif={handleExportGif}
              isRecording={isRecording}
              frameCount={frameCount}
            />
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                <input
                  type="text"
                  value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setError(null);
                    }}
                    placeholder="Describe what you want to draw or..."
                    className="px-2.5 py-1 border rounded-lg w-full text-xs text-black"
                  />
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="px-2.5 py-1 border rounded-lg bg-white w-full text-xs text-left flex items-center justify-between"
                    >
                      <span className="truncate text-gray-900">
                        {selectedStyle ? mangaStyles.find(style => style.value === selectedStyle)?.label || 'Select a category' : 'Select a category'}
                      </span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 w-full bg-white border rounded-lg shadow-lg z-10">
                        {mangaStyles.slice(1).map((style) => (
                          <button
                            key={style.value}
                            onClick={() => {
                              setSelectedStyle(style.value);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-center w-full px-3 py-2 text-left hover:bg-gray-50 text-xs text-gray-900"
                          >
                            <span>{style.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                <button
                  onClick={handleGenerateStrokes}
                    className="px-3 py-1 bg-orange-500 hover:bg-orange-500/100 text-white rounded-lg disabled:opacity-50 disabled:hover:bg-orange-500 disabled:cursor-not-allowed whitespace-nowrap shadow-sm text-xs group relative"
                    disabled={isGenerationLimited}
                    title={isGenerationLimited ? "Generation limit reached" : "Generate a sketch"}
                  >
                    Generate Sketch
                    {!isGenerationLimited && showTooltip && (
                      <span className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-gray-800 text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {`${dailyCount}/2 generations used today`}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 shadow-sm whitespace-nowrap text-xs"
                  >
                    Upload Reference
                </button>
                </div>
              </div>
              {error && (
                <div className="text-red-500 text-[10px]">
                  Error: {error}
                </div>
              )}
              {isGenerationLimited && (
                <div className="text-orange-500 text-[10px] flex flex-col">
                  {dailyCount >= 2 && lastGeneratedDate === new Date().toDateString() && (
                    <span>You have reached the daily generation limit. Please try again tomorrow.</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <div 
              className="relative w-full max-w-[460px] aspect-square bg-white rounded-lg overflow-hidden"
              style={{ width: `${canvasSize}px` }} // Explicitly set container width to match canvas
            >
              <div className="absolute inset-0 border border-gray-200 rounded-lg">
          <DrawingCanvas
            ref={canvasRef}
                  width={canvasSize}
                  height={canvasSize}
            selectedTool={selectedTool}
            strokeWidth={strokeWidth}
            showGrid={showGrid}
            gridSize={gridSize}
            selectedColor={selectedColor}
          />
        </div>
      </div>
          </div>
          <div className="text-center text-xs text-gray-500 mt-2">
            This site is powered by <a href="https://locodomo.framer.website" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-600">locodomo.com</a>
          </div>
        </div>
      </div>
      
      {/* Floating Buy Me a Coffee Button - keeping original size */}
      <a
        href="https://buymeacoffee.com/locodomoy"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 bg-[#FFDD00] text-[#000000] px-3 py-1.5 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 text-sm"
      >
        <Coffee size={20} />
        <span>Buy me a coffee</span>
      </a>

      {previewUrl && (
        <PreviewPopup
          gifUrl={previewUrl}
          onClose={handleClosePreview}
          onSave={handleExportGif}
          isGenerating={isGeneratingGif}
        />
      )}

      {/* Add hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileInputChange}
        onClick={(e) => {
          // Reset value to allow selecting the same file again
          (e.target as HTMLInputElement).value = '';
        }}
      />
    </main>
  );
}
