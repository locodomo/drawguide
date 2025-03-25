import { parseSVG, makeAbsolute } from 'svg-path-parser';
import simplify from 'simplify-js';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  type: 'line' | 'curve';
  points: Point[];
}

const SIMPLIFICATION_TOLERANCE = 2;
const MIN_STROKE_LENGTH = 10;
const MIN_POINTS_FOR_CURVE = 3;

export function cleanAndSimplifyStrokes(svgPath: string): Stroke[] {
  // Parse SVG path into commands
  const commands = parseSVG(svgPath);
  makeAbsolute(commands); // Convert all commands to absolute coordinates

  let currentStroke: Point[] = [];
  let strokes: Stroke[] = [];

  // Process SVG commands into point arrays
  commands.forEach(cmd => {
    switch (cmd.code) {
      case 'M':
        if (currentStroke && currentStroke.length > 0) {
          addStrokeIfValid(currentStroke, strokes);
        }
        if (cmd.x !== undefined && cmd.y !== undefined) {
          currentStroke = [{ x: cmd.x, y: cmd.y }];
        }
        break;
      case 'L':
      case 'H':
      case 'V':
        if (cmd.x !== undefined && cmd.y !== undefined) {
          if (!currentStroke) currentStroke = [];
          currentStroke.push({ x: cmd.x, y: cmd.y });
        }
        break;
      case 'C':
        if (cmd.x !== undefined && cmd.y !== undefined) {
          if (!currentStroke) currentStroke = [];
          currentStroke.push({ x: cmd.x, y: cmd.y });
        }
        break;
      case 'Z':
        if (currentStroke.length > 0 && currentStroke[0]) {
          currentStroke.push({ ...currentStroke[0] }); // Close path
          addStrokeIfValid(currentStroke, strokes);
        }
        currentStroke = [];
        break;
    }
  });

  // Add any remaining stroke
  if (currentStroke.length > 0) {
    addStrokeIfValid(currentStroke, strokes);
  }

  // Sort strokes from top to bottom, left to right
  strokes.sort((a, b) => {
    const aFirst = a.points[0];
    const bFirst = b.points[0];
    if (Math.abs(aFirst.y - bFirst.y) < 50) {
      return aFirst.x - bFirst.x;
    }
    return aFirst.y - bFirst.y;
  });

  return strokes;
}

function addStrokeIfValid(points: Point[], strokes: Stroke[]) {
  if (points.length < 2) return;

  // Simplify the points array
  const simplified = simplify(points, SIMPLIFICATION_TOLERANCE, true);

  // Calculate stroke length
  let strokeLength = 0;
  for (let i = 1; i < simplified.length; i++) {
    const dx = simplified[i].x - simplified[i-1].x;
    const dy = simplified[i].y - simplified[i-1].y;
    strokeLength += Math.sqrt(dx * dx + dy * dy);
  }

  // Only add strokes that are long enough
  if (strokeLength >= MIN_STROKE_LENGTH) {
    const type = simplified.length >= MIN_POINTS_FOR_CURVE ? 'curve' : 'line';
    strokes.push({ type, points: simplified });
  }
}

export function mergeShortStrokes(strokes: Stroke[]): Stroke[] {
  const merged: Stroke[] = [];
  let currentStroke: Stroke | null = null;

  strokes.forEach(stroke => {
    if (!currentStroke) {
      currentStroke = { ...stroke };
    } else {
      const lastPoint = currentStroke.points[currentStroke.points.length - 1];
      const firstPoint = stroke.points[0];
      
      // Calculate distance between strokes
      const dx = firstPoint.x - lastPoint.x;
      const dy = firstPoint.y - lastPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MIN_STROKE_LENGTH) {
        // Merge strokes
        currentStroke.points = currentStroke.points.concat(stroke.points);
        currentStroke.type = currentStroke.points.length >= MIN_POINTS_FOR_CURVE ? 'curve' : 'line';
      } else {
        merged.push(currentStroke);
        currentStroke = { ...stroke };
      }
    }
  });

  if (currentStroke) {
    merged.push(currentStroke);
  }

  return merged;
}

export function processVectorOutput(svgPath: string): Stroke[] {
  let strokes = cleanAndSimplifyStrokes(svgPath);
  strokes = mergeShortStrokes(strokes);
  return strokes;
} 