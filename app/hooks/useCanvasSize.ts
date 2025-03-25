import { useState, useEffect } from 'react';

export const useCanvasSize = (maxSize: number = 460) => {
  const [canvasSize, setCanvasSize] = useState<number>(maxSize);

  useEffect(() => {
    const updateCanvasSize = () => {
      const isMobile = window.innerWidth < 640;
      const containerPadding = isMobile ? 16 : 32; // Container padding
      const mainPadding = isMobile ? 16 : 32; // Main padding
      const totalPadding = containerPadding + mainPadding;
      
      // Calculate available width accounting for all padding
      const availableWidth = window.innerWidth - totalPadding;
      
      // On mobile, use the container width directly
      const size = isMobile 
        ? Math.min(maxSize, availableWidth)
        : Math.min(maxSize, availableWidth * 0.6);
        
      setCanvasSize(Math.floor(size)); // Ensure we use whole pixels
    };

    // Initial calculation
    updateCanvasSize();

    // Add event listener
    window.addEventListener('resize', updateCanvasSize);

    // Cleanup
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [maxSize]);

  return canvasSize;
}; 