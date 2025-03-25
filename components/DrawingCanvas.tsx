'use client';

import React, { useRef, useState, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import { Stage, Layer, Line, Image as KonvaImage, Rect, Circle, Shape } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { CanvasRecorder } from '@/app/utils/recording';

interface Point {
  x: number;
  y: number;
}

interface DrawingCanvasProps {
  width: number;
  height: number;
  selectedTool: 'brush' | 'eraser' | 'circle' | 'square' | 'triangle' | 'hexagon';
  strokeWidth: number;
  showGrid: boolean;
  gridSize: number;
  selectedColor: string;
  onFrameCapture?: (count: number) => void;
}

export interface DrawingCanvasRef {
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  saveImage: () => void;
  generateAIStrokes: (prompt: string) => Promise<{ imageUrl: string }>;
  loadReferenceImage: (imageUrl: string) => void;
  getCanvas: () => HTMLCanvasElement | null;
  getCanvasDataUrlWithoutGrid: (scale?: number) => string | null;
  startRecording: () => void;
  stopRecording: () => Promise<string>;
  exportGif: () => Promise<void>;
}

interface DrawingElement {
  points: Point[];
  color: string;
  strokeWidth: number;
  tool: 'brush' | 'eraser' | 'circle' | 'square' | 'triangle' | 'hexagon';
  startPoint?: Point;
  endPoint?: Point;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({
  width,
  height,
  selectedTool,
  strokeWidth,
  showGrid,
  gridSize,
  selectedColor,
  onFrameCapture
}, ref) => {
  const [lines, setLines] = useState<DrawingElement[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [guideImage, setGuideImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGifGenerating, setIsGifGenerating] = useState<boolean>(false);
  const [image] = useImage(guideImage || '');
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyStep, setHistoryStep] = useState<number>(0);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [scale, setScale] = useState({ x: 1, y: 1 });
  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<Point | null>(null);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [currentShape, setCurrentShape] = useState<{ type: 'rect' | 'circle'; startX: number; startY: number; width?: number; height?: number; radius?: number } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const recorderRef = useRef<CanvasRecorder>(new CanvasRecorder());
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Handle mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update scale based on window size
  useEffect(() => {
    if (!isMounted) return;

    const handleResize = () => {
      const isMobile = window.innerWidth < 640;
      setScale({
        x: isMobile ? 1 : 1,
        y: isMobile ? 1 : 1
      });
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMounted]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const gridCanvas = gridCanvasRef.current;
    if (!canvas || !gridCanvas) return;

    const ctx = canvas.getContext('2d');
    const gridCtx = gridCanvas.getContext('2d');
    if (!ctx || !gridCtx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    gridCanvas.width = width;
    gridCanvas.height = height;

    // Set initial styles
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw initial grid
    drawGrid(gridCtx);
  }, [width, height]);

  // Draw grid
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Update grid when gridSize changes
  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    if (!gridCanvas) return;

    const gridCtx = gridCanvas.getContext('2d');
    if (!gridCtx) return;

    drawGrid(gridCtx);
  }, [gridSize, width, height]);

  // Show/hide grid
  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    if (!gridCanvas) return;

    gridCanvas.style.display = showGrid ? 'block' : 'none';
  }, [showGrid]);

  // Handle client-side initialization
  useEffect(() => {
    setIsClient(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial canvas properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = strokeWidth;

    // Draw initial state
    redrawCanvas();
  }, []);

  // Update canvas properties when props change
  useEffect(() => {
    if (!isClient) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = strokeWidth;
  }, [selectedColor, strokeWidth, isClient]);

  // Handle lines changes
  useEffect(() => {
    if (!isClient) return;
    redrawCanvas();
  }, [lines, isClient]);

  // Add frame to recording if active
  useEffect(() => {
    if (isRecording && stageRef.current) {
      const dataUrl = getCanvasDataUrlWithoutGrid();
      if (dataUrl) {
        recorderRef.current.addFrame(dataUrl);
        onFrameCapture?.(recorderRef.current.getFrameCount());
      }
    }
  }, [lines, currentPoints, isRecording, onFrameCapture]);

  // Cleanup recording interval
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw reference image if exists
    if (referenceImage) {
      const img = new Image();
      img.src = referenceImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        drawGrid(ctx);
        drawLines();
      };
    } else {
      drawGrid(ctx);
      drawLines();
    }
  };

  const drawLines = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    lines.forEach(line => {
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.strokeWidth;

      ctx.moveTo(line.points[0].x, line.points[0].y);
      line.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });

      ctx.stroke();
    });
  };

  // Helper function to get pointer position from event
  const getPointerPosition = (e: KonvaEventObject<PointerEvent>): Point => {
    const stage = e.target.getStage();
    if (!stage) {
      return { x: 0, y: 0 };
    }
    const point = stage.getPointerPosition();
    if (!point) {
      return { x: 0, y: 0 };
    }
    return { x: point.x, y: point.y };
  };

  // Handle pointer down events (mouse, touch, stylus)
  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    if (e.evt.type === 'touchstart') {
      e.evt.preventDefault();
    }
    isDrawingRef.current = true;
    const pos = getPointerPosition(e);
    
    if (['circle', 'square', 'triangle', 'hexagon'].includes(selectedTool)) {
      setStartPoint(pos);
    } else {
      setCurrentPoints([pos]);
    }
  };

  // Handle pointer move events
  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    if (!isDrawingRef.current) return;
    
    if (e.evt.type === 'touchmove') {
      e.evt.preventDefault();
    }
    
    const pos = getPointerPosition(e);
    
    if (['circle', 'square', 'triangle', 'hexagon'].includes(selectedTool)) {
      setCurrentPoints([pos]);
    } else {
      setCurrentPoints([...currentPoints, pos]);
    }
  };

  // Handle pointer up events
  const handlePointerUp = (e: KonvaEventObject<PointerEvent>) => {
    if (e.evt.type === 'touchend' && isDrawingRef.current) {
      e.evt.preventDefault();
    }
    isDrawingRef.current = false;
    
    if (['circle', 'square', 'triangle', 'hexagon'].includes(selectedTool)) {
      if (startPoint) {
        const pos = getPointerPosition(e);
        const newLine: DrawingElement = {
          points: [startPoint, pos],
          color: selectedColor,
          strokeWidth,
          tool: selectedTool,
          startPoint,
          endPoint: pos
        };
        const newLines = [...lines, newLine];
        setLines(newLines);
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newLines);
        setHistory(newHistory);
        setHistoryStep(historyStep + 1);
      }
      setStartPoint(null);
    } else if (currentPoints.length > 0) {
      const newLine: DrawingElement = {
        points: currentPoints,
        color: selectedTool === 'eraser' ? '#ffffff' : selectedColor,
        strokeWidth,
        tool: selectedTool
      };
      const newLines = [...lines, newLine];
      setLines(newLines);
      setCurrentPoints([]);
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push(newLines);
      setHistory(newHistory);
      setHistoryStep(historyStep + 1);
    }
  };

  // Handle pointer cancel events (for touch devices)
  const handlePointerCancel = (e: KonvaEventObject<PointerEvent>) => {
    // Only prevent default for touch events when actually drawing
    if (e.evt.type === 'touchcancel' && isDrawingRef.current) {
      e.evt.preventDefault();
    }
    isDrawingRef.current = false;
    setStartPoint(null);
    setCurrentPoints([]);
  };

  const renderGrid = () => {
    if (!showGrid) return null;

    const gridLines = [];
    // Vertical lines
    for (let i = 0; i <= width; i += gridSize) {
      gridLines.push(
        <Line
          key={`v${i}`}
          points={[i, 0, i, height]}
          stroke="#e5e7eb"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    // Horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
      gridLines.push(
        <Line
          key={`h${i}`}
          points={[0, i, width, i]}
          stroke="#e5e7eb"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    return gridLines;
  };

  const undo = useCallback(() => {
    setLines((prevLines) => {
      const newLines = [...prevLines];
      newLines.pop();
      return newLines;
    });
  }, []);

  const redo = useCallback(() => {
    // Implement redo functionality if needed
  }, []);

  const clearCanvas = useCallback(() => {
    setLines([]);
  }, []);

  const saveImage = useCallback(() => {
    // Export at 4x resolution
    const dataUrl = getCanvasDataUrlWithoutGrid(4);
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = 'drawing.png';
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  // Add new method to get canvas data URL without grid
  const getCanvasDataUrlWithoutGrid = (scale = 1) => {
    if (!stageRef.current) return null;

    // Create temporary canvas with white background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width * scale;
    tempCanvas.height = height * scale;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!tempCtx) return null;

    try {
      // Create a clean Konva stage for the recording
      const tempStage = new Konva.Stage({
        container: document.createElement('div'),
        width: width * scale,
        height: height * scale,
      });

      // Create a new layer for drawing
      const drawingLayer = new Konva.Layer();
      tempStage.add(drawingLayer);
      
      // Scale the layer
      drawingLayer.scale({ x: scale, y: scale });

      // Add all lines to the temporary stage
      lines.forEach((line) => {
        if (line.tool === 'brush' || line.tool === 'eraser') {
          // For brush and eraser, create lines
          const konvaLine = new Konva.Line({
            points: line.points.flatMap((p) => [p.x, p.y]),
            stroke: line.tool === 'eraser' ? '#ffffff' : line.color,
            strokeWidth: line.strokeWidth,
            tension: 0.5,
            lineCap: 'round',
            lineJoin: 'round',
            globalCompositeOperation:
              line.tool === 'eraser' ? 'destination-out' : 'source-over',
          });
          drawingLayer.add(konvaLine);
        } else if (line.startPoint && line.endPoint) {
          // For shapes, create appropriate shape based on tool
          switch (line.tool) {
            case 'circle': {
              const radius = Math.sqrt(
                Math.pow(line.endPoint.x - line.startPoint.x, 2) +
                Math.pow(line.endPoint.y - line.startPoint.y, 2)
              );
              const circle = new Konva.Circle({
                x: line.startPoint.x,
                y: line.startPoint.y,
                radius: radius,
                stroke: line.color,
                strokeWidth: line.strokeWidth,
                fill: 'transparent',
              });
              drawingLayer.add(circle);
              break;
            }
            case 'square': {
              const rect = new Konva.Rect({
                x: Math.min(line.startPoint.x, line.endPoint.x),
                y: Math.min(line.startPoint.y, line.endPoint.y),
                width: Math.abs(line.endPoint.x - line.startPoint.x),
                height: Math.abs(line.endPoint.y - line.startPoint.y),
                stroke: line.color,
                strokeWidth: line.strokeWidth,
                fill: 'transparent',
              });
              drawingLayer.add(rect);
              break;
            }
            case 'triangle': {
              const width = line.endPoint.x - line.startPoint.x;
              const height = line.endPoint.y - line.startPoint.y;
              const points = [
                line.startPoint.x + width / 2, line.startPoint.y,
                line.startPoint.x, line.startPoint.y + height,
                line.startPoint.x + width, line.startPoint.y + height
              ];
              const triangle = new Konva.Line({
                points: points,
                stroke: line.color,
                strokeWidth: line.strokeWidth,
                closed: true,
                fill: 'transparent',
              });
              drawingLayer.add(triangle);
              break;
            }
            case 'hexagon': {
              const width = line.endPoint.x - line.startPoint.x;
              const height = line.endPoint.y - line.startPoint.y;
              const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
              const centerX = line.startPoint.x + width / 2;
              const centerY = line.startPoint.y + height / 2;
              const points = [];
              for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3 - Math.PI / 6;
                points.push(
                  centerX + radius * Math.cos(angle),
                  centerY + radius * Math.sin(angle)
                );
              }
              const hexagon = new Konva.Line({
                points: points,
                stroke: line.color,
                strokeWidth: line.strokeWidth,
                closed: true,
                fill: 'transparent',
              });
              drawingLayer.add(hexagon);
              break;
            }
          }
        }
      });

      // Draw current points if any (for active drawing)
      if (isDrawingRef.current && currentPoints.length > 0) {
        const currentLine = new Konva.Line({
          points: currentPoints.flatMap((p) => [p.x, p.y]),
          stroke: selectedTool === 'eraser' ? '#ffffff' : selectedColor,
          strokeWidth: strokeWidth,
          tension: 0.5,
          lineCap: 'round',
          lineJoin: 'round',
          globalCompositeOperation:
            selectedTool === 'eraser' ? 'destination-out' : 'source-over',
        });
        drawingLayer.add(currentLine);
      }

      // Draw the layer to get the final image
      drawingLayer.draw();

      // Fill white background on temp canvas
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, width * scale, height * scale);

      // Draw the Konva stage onto the temp canvas
      tempCtx.drawImage(tempStage.toCanvas(), 0, 0);

      return tempCanvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Error creating canvas data URL:', error);
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    generateAIStrokes: async (prompt: string) => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/generate-strokes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Failed to generate strokes';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch (e) {
            // If the error text is not JSON, use it directly
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        setGuideImage(data.imageUrl);
        return { imageUrl: data.imageUrl };
      } catch (error) {
        console.error('Error generating strokes:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    clearCanvas: () => {
      setLines([]);
      setGuideImage(null);
      setHistory([[]]);
      setHistoryStep(0);
    },
    undo: () => {
      if (historyStep > 0) {
        setHistoryStep(historyStep - 1);
        setLines(history[historyStep - 1]);
      }
    },
    redo: () => {
      if (historyStep < history.length - 1) {
        setHistoryStep(historyStep + 1);
        setLines(history[historyStep + 1]);
      }
    },
    saveImage: () => {
      // Export at 4x resolution
      const dataUrl = getCanvasDataUrlWithoutGrid(4);
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = 'drawing.png';
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    loadReferenceImage: (imageUrl: string) => {
      // Clear any existing guide image
      setGuideImage(null);
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Set the guide image
        setGuideImage(imageUrl);
      };
      img.onerror = () => {
        // Handle CORS errors
        console.error('Failed to load image due to CORS restrictions');
        setGuideImage(null);
      };
      img.src = imageUrl;
    },
    getCanvas: () => {
      if (stageRef.current) {
        return stageRef.current.toCanvas();
      }
      return null;
    },
    getCanvasDataUrlWithoutGrid: getCanvasDataUrlWithoutGrid,
    startRecording: () => {
      setIsRecording(true);
      recorderRef.current.startRecording();
      
      // Start capturing frames at regular intervals (30fps)
      recordingIntervalRef.current = setInterval(() => {
        const dataUrl = getCanvasDataUrlWithoutGrid();
        if (dataUrl) {
          recorderRef.current.addFrame(dataUrl);
          onFrameCapture?.(recorderRef.current.getFrameCount());
        }
      }, 33); // 33ms interval for approximately 30fps
    },
    stopRecording: async () => {
      setIsRecording(false);
      recorderRef.current.stopRecording();
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      try {
        setIsGifGenerating(true);
        const blob = await recorderRef.current.generateGif();
        return URL.createObjectURL(blob);
      } catch (error) {
        console.error('Error generating preview GIF:', error);
        throw error;
      } finally {
        setIsGifGenerating(false);
      }
    },
    exportGif: async () => {
      try {
        setIsGifGenerating(true);
        const blob = await recorderRef.current.generateGif();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'drawing-animation.gif';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting GIF:', error);
      } finally {
        setIsGifGenerating(false);
      }
    }
  }));

  if (!isMounted) {
    return null; // or a loading state
  }

  return (
    <div className="relative w-full h-full touch-none">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="text-white">Generating...</div>
        </div>
      )}
      {isGifGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="text-white">Generating GIF...</div>
        </div>
      )}
      <Stage
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="absolute inset-0 touch-none"
        ref={stageRef}
        style={{
          touchAction: 'none',
          display: 'block',
          width: '100%',
          height: '100%'
        }}
        scale={scale}
      >
        <Layer className="grid-layer" visible={showGrid}>
          {renderGrid()}
        </Layer>
        
        <Layer className="drawing-layer">
          {guideImage && image && (
            <KonvaImage
              image={image}
              width={width}
              height={height}
              opacity={0.3}
            />
          )}
          {lines.map((line, i) => {
            if (line.tool === 'brush' || line.tool === 'eraser') {
              return (
                <Line
                  key={i}
                  points={line.points.flatMap((p) => [p.x, p.y])}
                  stroke={line.tool === 'eraser' ? '#fff' : line.color}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              );
            } else if (line.tool === 'circle' && line.startPoint && line.endPoint) {
              const radius = Math.sqrt(
                Math.pow(line.endPoint.x - line.startPoint.x, 2) +
                Math.pow(line.endPoint.y - line.startPoint.y, 2)
              );
              return (
                <Circle
                  key={i}
                  x={line.startPoint.x}
                  y={line.startPoint.y}
                  radius={radius}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  fill="transparent"
                />
              );
            } else if (line.tool === 'square' && line.startPoint && line.endPoint) {
              const width = line.endPoint.x - line.startPoint.x;
              const height = line.endPoint.y - line.startPoint.y;
              return (
                <Rect
                  key={i}
                  x={line.startPoint.x}
                  y={line.startPoint.y}
                  width={width}
                  height={height}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  fill="transparent"
                />
              );
            } else if (line.tool === 'triangle' && line.startPoint && line.endPoint) {
              const width = line.endPoint.x - line.startPoint.x;
              const height = line.endPoint.y - line.startPoint.y;
              const points = [
                line.startPoint.x + width / 2, line.startPoint.y,
                line.startPoint.x, line.startPoint.y + height,
                line.startPoint.x + width, line.startPoint.y + height
              ];
              return (
                <Line
                  key={i}
                  points={points}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  closed
                  fill="transparent"
                />
              );
            } else if (line.tool === 'hexagon' && line.startPoint && line.endPoint) {
              const width = line.endPoint.x - line.startPoint.x;
              const height = line.endPoint.y - line.startPoint.y;
              const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
              const centerX = line.startPoint.x + width / 2;
              const centerY = line.startPoint.y + height / 2;
              const points = [];
              for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3 - Math.PI / 6;
                points.push(
                  centerX + radius * Math.cos(angle),
                  centerY + radius * Math.sin(angle)
                );
              }
              return (
                <Line
                  key={i}
                  points={points}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  closed
                  fill="transparent"
                />
              );
            }
            return null;
          })}
          {isDrawingRef.current && startPoint && currentPoints.length > 0 && (
            <>
              {selectedTool === 'circle' && (
                <Circle
                  x={startPoint.x}
                  y={startPoint.y}
                  radius={Math.sqrt(
                    Math.pow(currentPoints[0].x - startPoint.x, 2) +
                    Math.pow(currentPoints[0].y - startPoint.y, 2)
                  )}
                  stroke={selectedColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
              )}
              {selectedTool === 'square' && (
                <Rect
                  x={startPoint.x}
                  y={startPoint.y}
                  width={currentPoints[0].x - startPoint.x}
                  height={currentPoints[0].y - startPoint.y}
                  stroke={selectedColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
              )}
              {selectedTool === 'triangle' && (
                <Line
                  points={[
                    startPoint.x + (currentPoints[0].x - startPoint.x) / 2, startPoint.y,
                    startPoint.x, startPoint.y + (currentPoints[0].y - startPoint.y),
                    startPoint.x + (currentPoints[0].x - startPoint.x), startPoint.y + (currentPoints[0].y - startPoint.y)
                  ]}
                  stroke={selectedColor}
                  strokeWidth={strokeWidth}
                  closed
                  fill="transparent"
                />
              )}
              {selectedTool === 'hexagon' && (
                <Line
                  points={(() => {
                    const width = currentPoints[0].x - startPoint.x;
                    const height = currentPoints[0].y - startPoint.y;
                    const radius = Math.min(Math.abs(width), Math.abs(height)) / 2;
                    const centerX = startPoint.x + width / 2;
                    const centerY = startPoint.y + height / 2;
                    const points = [];
                    for (let i = 0; i < 6; i++) {
                      const angle = (i * Math.PI) / 3 - Math.PI / 6;
                      points.push(
                        centerX + radius * Math.cos(angle),
                        centerY + radius * Math.sin(angle)
                      );
                    }
                    return points;
                  })()}
                  stroke={selectedColor}
                  strokeWidth={strokeWidth}
                  closed
                  fill="transparent"
                />
              )}
            </>
          )}
          {currentPoints.length > 0 && !['circle', 'square', 'triangle', 'hexagon'].includes(selectedTool) && (
            <Line
              points={currentPoints.flatMap((p) => [p.x, p.y])}
              stroke={selectedTool === 'eraser' ? '#fff' : selectedColor}
              strokeWidth={strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                selectedTool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas; 