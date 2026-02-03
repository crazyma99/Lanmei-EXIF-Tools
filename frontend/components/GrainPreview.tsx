import React, { useEffect, useRef, useState, useCallback } from 'react';

interface GrainPreviewProps {
  imageUrl: string;
  intensity: number;
  className?: string;
}

export default function GrainPreview({ imageUrl, intensity, className }: GrainPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fixed preview size or match image aspect ratio?
    // Let's keep canvas size small for performance, e.g., max 300px width
    const MAX_WIDTH = 300;
    const scale = Math.min(1, MAX_WIDTH / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    // Draw original image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (intensity > 0) {
      const w = canvas.width;
      const h = canvas.height;
      
      // Create noise
      const noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = w;
      noiseCanvas.height = h;
      const noiseCtx = noiseCanvas.getContext('2d');
      
      if (noiseCtx) {
        const idata = noiseCtx.createImageData(w, h);
        const buffer32 = new Uint32Array(idata.data.buffer);
        const len = buffer32.length;

        for (let i = 0; i < len; i++) {
          // Generate grayscale noise
          const v = (Math.random() * 255) | 0;
          // Alpha is 255 (fully opaque)
          buffer32[i] = (255 << 24) | (v << 16) | (v << 8) | v;
        }
        
        noiseCtx.putImageData(idata, 0, 0);

        // Overlay noise
        ctx.globalCompositeOperation = 'overlay';
        // Adjust opacity based on intensity. 
        // 100 intensity => 1.0 opacity might be too strong, but let's try.
        // Backend uses sigma=20 for intensity=100.
        // Let's cap at 0.6 for visual approximation on web
        ctx.globalAlpha = Math.min(1, (intensity / 100) * 0.8);
        ctx.drawImage(noiseCanvas, 0, 0);
        
        // Reset
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
      }
    }
  }, [intensity]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      draw();
    };
  }, [imageUrl, draw]);

  useEffect(() => {
    if (imageLoaded) {
      draw();
    }
  }, [intensity, imageLoaded, draw]);

  return <canvas ref={canvasRef} className={`rounded-md border border-border shadow-sm ${className}`} />;
}
