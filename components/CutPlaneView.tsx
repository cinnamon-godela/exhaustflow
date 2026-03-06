import React, { useRef, useEffect } from 'react';
import { SimulationResult, SimulationInputs } from '../types';

interface CutPlaneViewProps {
    data: SimulationResult;
    inputs: SimulationInputs;
}

const CutPlaneView: React.FC<CutPlaneViewProps> = ({ data, inputs }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // FIX: Filter the row and then REVERSE it to match the 4-3-2-1 Top-View layout
    const rowNodes = [...data.grid.filter(n => n.row === 0)].reverse();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // 1. Background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#020617'); 
        gradient.addColorStop(1, '#0f172a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const margin = 80;
        const groundY = height - 60;
        const availableWidth = width - (margin * 2);
        
        const numChillers = inputs.columns || 4; 
        const spacing = inputs.colSpacing;
        const totalRealWidth = (numChillers * 8) + ((numChillers - 1) * spacing);
        const scalePx = availableWidth / Math.max(totalRealWidth, 50);

        const chillerWidthPx = 8 * scalePx;
        const gapPx = spacing * scalePx;
        const chillerHeightPx = 45; 
        const extensionHeightPx = inputs.fanExtension ? 10 : 0; 

        // Helper: Colormap
        const getJetColor = (t: number, alpha = 0.8) => {
            t = Math.max(0, Math.min(1, t));
            let r, g, b;
            if (t < 0.25) { r = 0; g = 0; b = 255; }
            else if (t < 0.5) { r = 0; g = 255; b = 255; }
            else if (t < 0.75) { r = 0; g = 255; b = 0; }
            else { r = 255; g = 0; b = 0; }
            return `rgba(${r},${g},${b},${alpha})`;
        };

        // Physics: Vector Field
        const getVelocity = (x: number, y: number) => {
            let vx = 0, vy = 0;
            const distFromGround = groundY - y;
            if (distFromGround > 0) {
                const windRad = (inputs.windDirection * Math.PI) / 180;
                vx += Math.cos(windRad) * inputs.windSpeed * 0.5;
            }

            rowNodes.forEach((node, i) => {
                if (!node.isActive) return;
                const cx = margin + i * (chillerWidthPx + gapPx) + chillerWidthPx / 2;
                const cy = groundY - chillerHeightPx - extensionHeightPx;
                const dx = x - cx;
                const dy = y - cy;

                if (y < groundY) {
                    const spread = chillerWidthPx * 0.7;
                    const strength = (inputs.flowRate / 60) * 4;
                    const plume = strength * Math.exp(-(dx * dx) / (2 * spread * spread));
                    vy -= plume;
                }
            });
            return { vx, vy };
        };

        const drawStreamline = (startX: number, startY: number, startTemp: number, length: number) => {
            let cx = startX, cy = startY, t = startTemp;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for (let i = 0; i < length; i++) {
                const v = getVelocity(cx, cy);
                cx += v.vx; cy += v.vy;
                if (cy > groundY) cy = groundY;
                ctx.lineTo(cx, cy);
                if (cx < 0 || cx > width || cy < 0) break;
            }
            ctx.strokeStyle = getJetColor(t, 0.4);
            ctx.stroke();
        };

        // Render streamlines
        rowNodes.forEach((node, i) => {
            if (!node.isActive) return;
            const sxBase = margin + i * (chillerWidthPx + gapPx);
            for (let k = 0; k < 10; k++) {
                drawStreamline(sxBase + (k/10)*chillerWidthPx, groundY - chillerHeightPx, 0.9, 100);
            }
        });

        // Draw Chillers
        rowNodes.forEach((node, i) => {
            const xPos = margin + (i * (chillerWidthPx + gapPx));
            const yPos = groundY - chillerHeightPx;

            ctx.fillStyle = node.isActive ? '#64748b' : '#1e293b';
            ctx.fillRect(xPos, yPos, chillerWidthPx, chillerHeightPx);
            if (inputs.fanExtension && node.isActive) {
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(xPos, yPos - extensionHeightPx, chillerWidthPx, extensionHeightPx);
            }
            // ID label (visual confirmation of reversal)
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(`${node.index + 1}`, xPos + 5, yPos + 15);
        });

        ctx.fillStyle = '#020617';
        ctx.fillRect(0, groundY, width, 60);

    }, [data, inputs, rowNodes]);

    return (
        <div className="w-full h-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
             <canvas ref={canvasRef} width={900} height={400} className="w-full h-full" />
        </div>
    );
};

export default CutPlaneView;