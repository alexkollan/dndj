import React, { useEffect, useRef, useState } from 'react';

/**
 * WaveformEditor
 * Renders a track's waveform and provides interactive handles for cropping.
 * Optimized for memory efficiency and high-precision interaction.
 */
function WaveformEditor({ 
  trackId, audioUrl, startTime, endTime, onCropChange, 
  playbackTime, onSeek, onSeekStart, onSeekEnd,
  initialPeaks = null, onPeaksGenerated
}) {
  const bgCanvasRef = useRef(null);
  const cursorCanvasRef = useRef(null);
  const [cachedPeaks, setCachedPeaks] = useState(initialPeaks ? (typeof initialPeaks === 'string' ? JSON.parse(initialPeaks) : initialPeaks) : null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [hoveredHandle, setHoveredHandle] = useState(null); // 'start', 'end', 'seek'

  const WAVEFORM_WIDTH = 600;

  const playbackTimeRef = useRef(playbackTime);
  const isDraggingRef = useRef(isDraggingSeek);
  const dragTimeRef = useRef(dragTime);
  const durationRef = useRef(0);
  const hoveredHandleRef = useRef(null);

  useEffect(() => { playbackTimeRef.current = playbackTime; }, [playbackTime]);
  useEffect(() => { isDraggingRef.current = isDraggingSeek; }, [isDraggingSeek]);
  useEffect(() => { dragTimeRef.current = dragTime; }, [dragTime]);
  useEffect(() => { hoveredHandleRef.current = hoveredHandle; }, [hoveredHandle]);

  // 1. Fetch metadata / duration
  useEffect(() => {
    if (!audioUrl) return;

    if (cachedPeaks) {
        let tempAudio = new Audio(audioUrl);
        const onLoaded = () => {
            if (tempAudio && tempAudio.duration && tempAudio.duration !== Infinity) {
                setDuration(tempAudio.duration);
                durationRef.current = tempAudio.duration;
            }
            cleanup();
        };
        const cleanup = () => {
            if (tempAudio) {
                tempAudio.removeEventListener('loadedmetadata', onLoaded);
                tempAudio.src = '';
                tempAudio.load();
                tempAudio = null;
            }
        };
        tempAudio.addEventListener('loadedmetadata', onLoaded);
        setTimeout(() => {
            if (tempAudio && tempAudio.duration && durationRef.current === 0) onLoaded();
            else cleanup();
        }, 1000);
        return cleanup;
    }
    
    let isCancelled = false;
    setLoading(true);

    async function loadAudio() {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (!isCancelled) {
          const data = decodedData.getChannelData(0);
          const step = Math.ceil(data.length / WAVEFORM_WIDTH);
          const generatedPeaks = [];

          for (let i = 0; i < WAVEFORM_WIDTH; i++) {
            let min = 1.0; 
            let max = -1.0;
            for (let j = 0; j < step; j++) {
              const datum = data[(i * step) + j] || 0;
              if (datum < min) min = datum;
              if (datum > max) max = datum;
            }
            generatedPeaks.push({ min, max });
          }

          setCachedPeaks(generatedPeaks);
          setDuration(decodedData.duration);
          durationRef.current = decodedData.duration;
          setLoading(false);
          if (onPeaksGenerated) onPeaksGenerated(trackId, JSON.stringify(generatedPeaks));
        }
        audioCtx.close();
      } catch (err) {
        console.error('Waveform load error:', err);
        if (!isCancelled) setLoading(false);
      }
    }

    loadAudio();
    return () => { isCancelled = true; };
  }, [audioUrl, cachedPeaks, trackId]);

  // 3. Draw Static Background
  useEffect(() => {
    if (!cachedPeaks || cachedPeaks.length === 0 || !bgCanvasRef.current) return;
    const canvas = bgCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#10b981'; 
    ctx.globalAlpha = 0.4;
    cachedPeaks.forEach((peak, i) => {
      ctx.fillRect(i, (1 + peak.min) * amp, 1, Math.max(1, (peak.max - peak.min) * amp));
    });

    const currentDuration = duration || durationRef.current;
    if (currentDuration > 0 && currentDuration !== Infinity) {
      const startX = (startTime / currentDuration) * width;
      const endX = ((endTime || currentDuration) / currentDuration) * width;
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, startX, height);
      ctx.fillRect(endX, 0, width - endX, height);
    }
  }, [cachedPeaks, startTime, endTime, duration]);

  // 4. Cursor & Interaction Loop
  useEffect(() => {
    if (!cursorCanvasRef.current) return;
    const canvas = cursorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    let animationId;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const currentDuration = durationRef.current;
      if (!currentDuration) { animationId = requestAnimationFrame(render); return; }

      const hovered = hoveredHandleRef.current;
      const playTime = isDraggingRef.current ? dragTimeRef.current : (playbackTimeRef.current ?? startTime);
      
      const startX = (startTime / currentDuration) * width;
      const endX = ((endTime || currentDuration) / currentDuration) * width;
      const playX = (playTime / currentDuration) * width;

      // Draw Crop Handles
      const drawCropHandle = (x, type) => {
        const isHovered = hovered === type;
        ctx.fillStyle = '#10b981';
        ctx.shadowBlur = isHovered ? 12 : 0;
        ctx.shadowColor = '#10b981';
        ctx.globalAlpha = 1.0;
        ctx.fillRect(x - (isHovered ? 3 : 2), 0, isHovered ? 6 : 4, height);
        if (isHovered) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x-6, 8); ctx.lineTo(x+6, 8); ctx.fill();
        }
      };

      drawCropHandle(startX, 'start');
      drawCropHandle(endX, 'end');

      // Draw Playback Cursor (Always on top)
      const isPlayHovered = hovered === 'seek';
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = isPlayHovered ? 12 : 4;
      ctx.shadowColor = isPlayHovered ? '#fff' : 'rgba(0,0,0,0.8)';
      ctx.fillRect(playX - (isPlayHovered ? 2 : 1), 0, isPlayHovered ? 4 : 2, height);
      
      ctx.shadowBlur = 0;
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [duration, startTime, endTime]);

  const getTargetUnderMouse = (mouseX, rectWidth, currentDuration) => {
    const startX = (startTime / currentDuration) * rectWidth;
    const endX = ((endTime || currentDuration) / currentDuration) * rectWidth;
    const playTime = isDraggingRef.current ? dragTimeRef.current : (playbackTimeRef.current ?? startTime);
    const playX = (playTime / currentDuration) * rectWidth;
    
    const hitThreshold = 12;
    // Check handles FIRST for hover visuals
    if (Math.abs(mouseX - startX) < hitThreshold) return 'start';
    if (Math.abs(mouseX - endX) < hitThreshold) return 'end';
    if (Math.abs(mouseX - playX) < hitThreshold) return 'seek';
    return null;
  };

  const handleMouseDown = (e) => {
    const currentDuration = duration || durationRef.current;
    if (!currentDuration || currentDuration === Infinity) return;

    const rect = cursorCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const target = getTargetUnderMouse(x, rect.width, currentDuration);

    const getTimeFromX = (mx) => (Math.max(0, Math.min(rect.width, mx)) / rect.width) * currentDuration;

    if (target === 'start' || target === 'end') {
      // Grabbing a specific crop handle
      const isStart = target === 'start';
      const onMouseMove = (mE) => {
        const time = getTimeFromX(mE.clientX - rect.left);
        if (isStart) onCropChange(Math.min(time, (endTime || currentDuration) - 0.01), endTime || currentDuration);
        else onCropChange(startTime, Math.max(time, startTime + 0.01));
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      // Not grabbing a handle? THEN IT'S A SEEK.
      setIsDraggingSeek(true);
      if (onSeekStart) onSeekStart();
      
      const updateSeek = (mE) => {
        const time = getTimeFromX(mE.clientX - rect.left);
        setDragTime(time);
      };

      updateSeek(e); // Initial jump

      const onMouseMove = (mE) => updateSeek(mE);
      const onMouseUp = (uE) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        const finalTime = getTimeFromX(uE.clientX - rect.left);
        onSeek(finalTime);
        setIsDraggingSeek(false);
        if (onSeekEnd) onSeekEnd();
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  return (
    <div className="waveform-editor" style={{ position: 'relative', width: WAVEFORM_WIDTH, height: 60, background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
      {loading && <div className="waveform-loading" style={{ color: '#fff', fontSize: '10px', padding: '22px', textAlign: 'center', width: '100%' }}>ANALYZING...</div>}
      <canvas ref={bgCanvasRef} width={WAVEFORM_WIDTH} height={60} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas 
        ref={cursorCanvasRef} 
        width={WAVEFORM_WIDTH} height={60} 
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const target = getTargetUnderMouse(e.clientX - rect.left, rect.width, duration || durationRef.current);
          setHoveredHandle(target);
        }}
        onMouseLeave={() => setHoveredHandle(null)}
        style={{ position: 'absolute', top: 0, left: 0, cursor: hoveredHandle ? 'grab' : 'crosshair' }}
      />
    </div>
  );
}

export default WaveformEditor;
