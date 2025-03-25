export interface AIGeneratedStroke {
  type: 'line' | 'curve';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface DrawingData {
  lines: {
    tool: 'brush' | 'eraser' | 'circle' | 'square' | 'triangle' | 'hexagon';
    points: { x: number; y: number }[];
    color: string;
    strokeWidth: number;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
  }[];
  aiStrokes?: AIGeneratedStroke[];
  timestamp?: string;
}

export const saveDrawing = (name: string, drawingData: DrawingData): void => {
  try {
    const drawings = loadAllDrawings();
    drawings[name] = {
      ...drawingData,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('drawings', JSON.stringify(drawings));
  } catch (error) {
    console.error('Error saving drawing:', error);
  }
};

export const loadDrawing = (name: string): DrawingData | null => {
  try {
    const drawings = loadAllDrawings();
    return drawings[name] || null;
  } catch (error) {
    console.error('Error loading drawing:', error);
    return null;
  }
};

export const loadAllDrawings = (): Record<string, DrawingData & { timestamp: string }> => {
  try {
    const drawings = localStorage.getItem('drawings');
    return drawings ? JSON.parse(drawings) : {};
  } catch (error) {
    console.error('Error loading drawings:', error);
    return {};
  }
};

export const deleteDrawing = (name: string): void => {
  try {
    const drawings = loadAllDrawings();
    delete drawings[name];
    localStorage.setItem('drawings', JSON.stringify(drawings));
  } catch (error) {
    console.error('Error deleting drawing:', error);
  }
}; 