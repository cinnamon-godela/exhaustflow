import React, { useRef, useEffect } from 'react';
import { SimulationResult, SimulationInputs } from '../types';

interface CutPlaneViewProps {
    data: SimulationResult;
    inputs: SimulationInputs;
}

const CutPlaneView: React.FC<CutPlaneViewProps> = ({ data, inputs }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Get the first row of nodes to represent the lateral cut
    // In a cut plane (side view), we usually look down a row or across columns
    // Let's visualize the first "Row" across its columns
    // If inputs.columns = 4, this gets 4 items.
    const rowNodes = data.grid.filter(n => n.row === 0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Canvas Setup
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // 1. Background (Deep Scientific Blue)
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#000080'); // Standard CFD Blue
        gradient.addColorStop(1, '#000040'); // Darker at bottom
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Layout Constants
        const margin = 50;
        const groundY = height - 50;
        const availableWidth = width - (margin * 2);
        
        const numChillers = inputs.columns; 
        const spacing = inputs.colSpacing;
        
        // Calculate dynamic scaling
        // Total physical width = (NumChillers * 8ft) + ((NumChillers - 1) * spacing_ft)
        const totalRealWidth = (numChillers * 8) + ((numChillers - 1) * spacing);
        const scalePx = availableWidth / Math.max(totalRealWidth, 50); // Prevent div/0

        const chillerWidthPx = 8 * scalePx;
        const gapPx = spacing * scalePx;
        const chillerHeightPx = 40; // Fixed for visual clarity
        
        // Extension adds physical height
        const extensionHeightPx = inputs.fanExtension ? 8 : 0; 

        // --- HELPER: JET COLORMAP (Modified for consistency with Heatmap) ---
        const getJetColor = (t: number, alpha = 0.8) => {
            t = Math.max(0, Math.min(1, t));
            let r, g, b;
            
            if (t < 0.2) {
                // Dark Blue -> Blue
                r = 0; g = 0; b = Math.round(100 + (255-100)*(t/0.2));
            } else if (t < 0.4) {
                // Blue -> Cyan
                r = 0; g = Math.round(255 * ((t-0.2)/0.2)); b = 255;
            } else if (t < 0.6) {
                 // Cyan -> Green
                 r = 0; g = 255; b = Math.round(255 * (1 - (t-0.4)/0.2));
            } else if (t < 0.8) {
                // Green -> Yellow -> Orange
                r = 255; g = Math.round(255 * (1 - (t-0.6)/0.4)) + 100; b = 0; 
                if (g > 255) g = 255;
            } else {
                // Orange -> Red
                r = 255; g = Math.round(100 * (1 - (t-0.8)/0.2)); b = 0; 
            }
            return `rgba(${r},${g},${b},${alpha})`;
        };

        // --- PHYSICS ENGINE: VECTOR FIELD ---
        const getVelocity = (x: number, y: number) => {
            let vx = 0;
            let vy = 0;

            // 1. GLOBAL WIND (Logarithmic Boundary Layer)
            const distFromGround = groundY - y;
            if (distFromGround > 0) {
                const windProfile = Math.log(distFromGround / 50 + 1);
                // Convert wind direction to radians
                const windRad = (inputs.windDirection * Math.PI) / 180;
                const windProj = Math.cos(windRad) * inputs.windSpeed;
                vx += windProj * windProfile * 0.15;
            }

            // 2. CHILLER SOURCES
            rowNodes.forEach((node, i) => {
                if (!node.isActive) return;

                const cx = margin + i * (chillerWidthPx + gapPx) + chillerWidthPx / 2;
                const cy = groundY - chillerHeightPx - extensionHeightPx;

                const dx = x - cx;
                const dy = y - cy; 

                if (y < groundY) {
                    const spread = chillerWidthPx * 0.6 + Math.abs(dy) * 0.15;
                    const strength = (inputs.flowRate / 60) * 3.5; 
                    
                    const eftBoost = inputs.eftBase ? 1.5 : 1.0; 
                    const extBoost = inputs.fanExtension ? 1.2 : 1.0;

                    const plume = strength * eftBoost * extBoost * Math.exp(-(dx * dx) / (2 * spread * spread));
                    vy -= plume; 
                }

                if (y > groundY - 100) {
                    const suctionStrength = inputs.eftBase ? 0.2 : 0.5;
                    const suctionDir = dx > 0 ? -1 : 1;
                    const distFactor = Math.exp(-Math.abs(dx) / (chillerWidthPx));
                    vx += suctionDir * suctionStrength * distFactor;
                }
            });

            // 3. GAP VORTICES
            rowNodes.forEach((node, i) => {
                if (i >= rowNodes.length - 1) return;

                const gapStartX = margin + i * (chillerWidthPx + gapPx) + chillerWidthPx;
                const gapCenterX = gapStartX + gapPx / 2;
                const gapCenterY = groundY - chillerHeightPx * 0.6; 

                const eftDampening = inputs.eftBase ? 0.4 : 1.0;
                const extDampening = inputs.fanExtension ? 0.8 : 1.0;

                const vStrength = (inputs.flowRate / 60) * 150 * eftDampening * extDampening;
                const vRadiusSq = (gapPx * 0.35) ** 2;

                const vlx = gapCenterX - gapPx * 0.25;
                const vly = gapCenterY;
                const dxl = x - vlx;
                const dyl = y - vly;
                const distSql = dxl*dxl + dyl*dyl;
                
                const fl = vStrength / (distSql + vRadiusSq + 100);
                vx += dyl * fl;
                vy += -dxl * fl;

                const vrx = gapCenterX + gapPx * 0.25;
                const vry = gapCenterY;
                const dxr = x - vrx;
                const dyr = y - vry;
                const distSqr = dxr*dxr + dyr*dyr;

                const fr = vStrength / (distSqr + vRadiusSq + 100);
                vx += -dyr * fr;
                vy += dxr * fr;
            });

            return { vx, vy };
        };

        // --- TRACER SYSTEM ---
        const drawStreamline = (startX: number, startY: number, startTemp: number, length: number) => {
            const points: {x: number, y: number, t: number}[] = [];
            let cx = startX;
            let cy = startY;
            let t = startTemp;

            points.push({x: cx, y: cy, t});

            const dt = 1.0; 
            
            for (let i = 0; i < length; i++) {
                const k1 = getVelocity(cx, cy);
                const midX = cx + k1.vx * dt * 0.5;
                const midY = cy + k1.vy * dt * 0.5;
                const k2 = getVelocity(midX, midY);

                cx += k2.vx * dt;
                cy += k2.vy * dt;

                if (t > 0.2) t *= 0.992;

                if (cx < -50 || cx > width + 50 || cy < -50 || cy > height) break;
                if (cy > groundY) {
                    cy = groundY; 
                }

                points.push({x: cx, y: cy, t});
            }

            if (points.length < 2) return;

            for (let i = 0; i < points.length - 1; i++) {
                ctx.beginPath();
                ctx.moveTo(points[i].x, points[i].y);
                ctx.lineTo(points[i+1].x, points[i+1].y);
                ctx.strokeStyle = getJetColor(points[i].t, 0.6); 
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        };

        // --- RENDER SCENE ---

        // 1. Draw Streamlines
        rowNodes.forEach((node, i) => {
            if (!node.isActive) return;
            const sxBase = margin + i * (chillerWidthPx + gapPx);
            
            for (let k = 0; k < 12; k++) {
                const sx = sxBase + (k/12) * chillerWidthPx;
                const sy = groundY - chillerHeightPx - extensionHeightPx - 2;
                drawStreamline(sx, sy, 0.95, 250);
            }
        });

        // B. GAP RECIRCULATION
        rowNodes.forEach((node, i) => {
            if (i >= rowNodes.length - 1) return;
            const gapX = margin + i * (chillerWidthPx + gapPx) + chillerWidthPx;
            
            for (let gx = 0; gx < 8; gx++) {
                for (let gy = 0; gy < 6; gy++) {
                    const sx = gapX + (gx/8) * gapPx;
                    const sy = groundY - 10 - (gy/6) * (chillerHeightPx * 0.8);
                    drawStreamline(sx, sy, 0.45, 150);
                }
            }
        });

        // C. AMBIENT INFILL
        for (let k = 0; k < 200; k++) {
            const sx = Math.random() * width;
            const sy = Math.random() * (height - 50);
            if (sy < groundY - chillerHeightPx - 20) {
                 drawStreamline(sx, sy, 0.1, 100);
            }
        }

        // 2. Draw Geometry (Chillers)
        rowNodes.forEach((node, i) => {
            const xPos = margin + (i * (chillerWidthPx + gapPx));
            const yPos = groundY - chillerHeightPx;

            if (node.isActive) {
                // Main Block (Grey)
                ctx.fillStyle = '#94a3b8'; 
                ctx.fillRect(xPos, yPos, chillerWidthPx, chillerHeightPx);
                
                // Fan Details (Darker Grey Tops)
                ctx.fillStyle = '#475569';
                const fanCount = 2; 
                const fanW = chillerWidthPx / fanCount;
                for(let f=0; f<fanCount; f++) {
                    ctx.fillRect(xPos + f*fanW + 2, yPos - 4, fanW - 4, 4);
                }

                // DRAW DISCHARGE EXTENSION
                if (inputs.fanExtension) {
                    ctx.fillStyle = '#3b82f6'; // Blue tint for extension
                    // Draw box on top
                    ctx.fillRect(xPos + 2, yPos - extensionHeightPx, chillerWidthPx - 4, extensionHeightPx);
                    
                    // Detail lines
                    ctx.strokeStyle = '#93c5fd';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(xPos + 2, yPos - extensionHeightPx/2);
                    ctx.lineTo(xPos + chillerWidthPx - 2, yPos - extensionHeightPx/2);
                    ctx.stroke();
                }

            } else {
                // Ghost outline
                ctx.strokeStyle = '#475569';
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(xPos, yPos, chillerWidthPx, chillerHeightPx);
                ctx.setLineDash([]);
            }
        });

        // 3. Ground
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, groundY, width, height - groundY);

        // 4. Legend Text
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '10px sans-serif';
        ctx.fillText("Temp: Blue (Amb) -> Green -> Red (Hot)", 10, 15);

    }, [data, inputs]);

    return (
        <div className="w-full h-full flex flex-col items-center bg-slate-900 rounded-lg overflow-hidden shadow-inner border border-slate-700">
            <div className="relative w-full h-full">
                <canvas 
                    ref={canvasRef} 
                    width={900} 
                    height={400} 
                    className="w-full h-full object-contain"
                />
                
                {/* Overlay Legend */}
                <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur border border-slate-600 p-2 rounded">
                    <div className="text-[10px] text-slate-300 font-bold mb-1">TEMPERATURE FIELD</div>
                    <div className="w-32 h-2 rounded-sm mb-1" style={{background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)'}}></div>
                    <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                        <span>{inputs.ambientTemp}°F</span>
                        <span>{(inputs.ambientTemp + 30).toFixed(0)}°F</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CutPlaneView;