import React, { useState, useRef, useEffect } from 'react';
import { SimulationInputs, SimulationResult } from '../types';
import type { InputRanges } from '../services/datasetRanges';
import { clamp } from '../services/datasetRanges';
import { Send, User, Bot, Terminal, MessageSquare, Minimize2, GripHorizontal, Loader2, Zap } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface ChatInterfaceProps {
    inputs: SimulationInputs;
    results: SimulationResult;
    onUpdate: (newInputs: SimulationInputs) => void;
    /** Bounds for the four controllable inputs (same as Quick Input). When set, the assistant may only change inputs within these ranges. */
    inputRanges?: InputRanges;
}

interface Message {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    isCommand?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ inputs, results, onUpdate, inputRanges }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Gemini API key (Vite exposes env via import.meta.env; fallback for local dev)
    const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyC4pPGi8B_Igmp6gfxf0bsUbBss5AQB5oM';
    const isConnected = !!geminiApiKey;

    // Dragging Logic
    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        
        if (!position) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({ x: rect.left, y: rect.top });
            dragOffset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        } else {
            dragOffset.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y
            };
        }
        setIsDragging(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.current.x,
                    y: e.clientY - dragOffset.current.y
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isLoading]);

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        const userText = inputText;
        setInputText('');
        
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userText }]);
        setIsLoading(true);

        if (!isConnected) {
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'assistant',
                    text: "I am not connected to Gemini. Set VITE_GEMINI_API_KEY in your .env to enable the design assistant.",
                    isCommand: false
                }]);
                setIsLoading(false);
            }, 500);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            
            const ranges = inputRanges ?? {
                windSpeed: { min: 0, max: 10 },
                flowRateKcfm: { min: 30, max: 150 },
                orientation: { min: 0, max: 90 },
                rowSpacing: { min: 10, max: 20 },
            };

            const currentStateDescription = `
                Current Simulation State (controllable parameters only):
                - Wind Speed: ${inputs.windSpeed} m/s
                - Flow Rate: ${inputs.flowRate} kCFM (${inputs.flowRate * 1000} CFM)
                - Wind Direction (Orientation): ${inputs.windDirection}°
                - Row Spacing: ${inputs.rowSpacing} ft

                Current Performance Results:
                - Peak Intake Temp: ${results.maxTotalTemp} F
                - Avg Temp Rise: ${results.avgTempRise} F
                - Risk Level: ${results.riskLevel}
                - Effective Path Length (Watson): ${results.benchmark.effectiveLengthMeters} m
                - Watson Predicted Peak Rise: ${results.benchmark.predictedMaxRiseF} F
            `;

            const allowedBounds = `
                You may ONLY suggest changes to these four parameters, and ONLY within these exact bounds (values outside are invalid):
                - windSpeed (m/s): min ${ranges.windSpeed.min}, max ${ranges.windSpeed.max}
                - flowRate (kCFM): min ${ranges.flowRateKcfm.min}, max ${ranges.flowRateKcfm.max}
                - windDirection (degrees): min ${ranges.orientation.min}, max ${ranges.orientation.max}
                - rowSpacing (feet): min ${ranges.rowSpacing.min}, max ${ranges.rowSpacing.max}
                Do not suggest or return rows, columns, colSpacing, ambientTemp, eftBase, fanExtension, or resetLayout. They are fixed in this application.
            `;

            const expertContext = `
                ROLE: You are a senior HVAC engineer and thermal simulation expert specializing in mission-critical data center cooling and air-cooled chiller compounds (ACCs). You answer with the depth of an HVAC expert and a thermal/CFD simulation engineer.

                DOMAIN KNOWLEDGE:
                - HVAC: Chiller plant layout, re-entrainment, plume behavior, ambient conditions, flow rates (CFM), and how wind speed and direction affect intake temperatures.
                - Thermal simulation: Surrogate models, parametric studies, peak/avg temperature rise, risk levels, and design margins (e.g. N+1).
                - Research basis: Watson & Charentenay (2019), "Parametric Study of Air Re-entrainment within Air-Cooled Chiller Compounds":
                  - Plant compound length (L_PC) is the dominant factor (correlation ~0.99).
                  - Re-entrainment scales with wind speed and plant length.
                  - ~25 m compound: ~5°C average, ~10°C peak rise.
                  - Avg Rise (C) ≈ 8.7*max((L-38.9)/26.8,-1)+9.0; Max Rise (C) ≈ 18.7*max((L-38.9)/26.8,-1)+19.5.
                  - Worst case: high wind (e.g. 10 m/s) aligned with chiller length.
                - EFT (Exhaust Flow Technology): Vertical stacks increase plume momentum, reduce downwash and re-entrainment; can reduce peak rise ~65% and improve uniformity. This app's baseline data is for EFT Base ON.

                BEHAVIOR:
                1. Answer all HVAC and thermal simulation questions with expert-level accuracy and clarity.
                2. When the user asks to change conditions (e.g. "simulate higher wind", "try 80k CFM", "worst-case orientation"), suggest only the four allowed parameters and stay within the bounds below.
                3. If the user asks to change geometry, ambient, or hardware (EFT/fan extension), explain that in this app only wind speed, flow rate, wind direction, and row spacing are adjustable; other settings are fixed.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: userText,
                config: {
                    systemInstruction: `
                        ${expertContext}
                        ${currentStateDescription}
                        ${allowedBounds}

                        OUTPUT FORMAT:
                        You must respond with ONLY a single JSON object, no other text. The JSON must have a "responseMessage" string (your reply to the user). Optionally include windSpeed, flowRate, windDirection, rowSpacing as numbers to change inputs. Example: {"responseMessage": "Set wind speed to 10 m/s.", "windSpeed": 10}
                    `,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            windSpeed: { type: Type.NUMBER },
                            flowRate: { type: Type.NUMBER },
                            windDirection: { type: Type.NUMBER },
                            rowSpacing: { type: Type.NUMBER },
                            responseMessage: { type: Type.STRING },
                        },
                        required: ["responseMessage"]
                    }
                }
            });

            const resultText = response.text?.trim();
            if (!resultText) {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'assistant',
                    text: "No response from the assistant. Try rephrasing or check your connection.",
                    isCommand: false
                }]);
                return;
            }

            const raw = resultText.trim();
            const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            let data: { responseMessage?: string; windSpeed?: number; flowRate?: number; windDirection?: number; rowSpacing?: number };
            try {
                data = JSON.parse(jsonStr);
            } catch {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'assistant',
                    text: raw.length > 500 ? raw.slice(0, 500) + '…' : raw,
                    isCommand: false
                }]);
                return;
            }

            const toNum = (x: unknown): number | undefined => {
                if (typeof x === 'number' && !Number.isNaN(x)) return x;
                if (typeof x === 'string') { const n = Number(x); return Number.isNaN(n) ? undefined : n; }
                return undefined;
            };

            const newInputs = { ...inputs };
            let hasChanges = false;

            const w = toNum(data.windSpeed);
            if (w !== undefined) {
                const v = clamp(w, ranges.windSpeed.min, ranges.windSpeed.max);
                if (v !== newInputs.windSpeed) { newInputs.windSpeed = v; hasChanges = true; }
            }
            const fr = toNum(data.flowRate);
            if (fr !== undefined) {
                const v = clamp(fr, ranges.flowRateKcfm.min, ranges.flowRateKcfm.max);
                if (v !== newInputs.flowRate) { newInputs.flowRate = v; hasChanges = true; }
            }
            const wd = toNum(data.windDirection);
            if (wd !== undefined) {
                const v = clamp(wd, ranges.orientation.min, ranges.orientation.max);
                if (v !== newInputs.windDirection) { newInputs.windDirection = v; hasChanges = true; }
            }
            const rs = toNum(data.rowSpacing);
            if (rs !== undefined) {
                const v = clamp(rs, ranges.rowSpacing.min, ranges.rowSpacing.max);
                if (v !== newInputs.rowSpacing) { newInputs.rowSpacing = v; hasChanges = true; }
            }

            if (hasChanges) {
                onUpdate(newInputs);
            }

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: typeof data.responseMessage === 'string' ? data.responseMessage : (hasChanges ? 'Updated.' : 'Done.'),
                isCommand: hasChanges
            }]);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('Design assistant error:', error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: `Something went wrong: ${message}. Try again or rephrase.`,
                isCommand: false
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-12 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-full shadow-2xl flex items-center justify-center text-zinc-200 transition-all z-50 border border-zinc-700"
            >
                <div className="relative">
                    <MessageSquare size={20} />
                    {isConnected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                </div>
            </button>
        );
    }

    const style = position ? { left: position.x, top: position.y } : undefined;
    const positionClasses = position ? '' : 'bottom-6 right-6';

    return (
        <div 
            ref={containerRef}
            style={style as React.CSSProperties}
            className={`
                fixed ${positionClasses} w-80 h-[450px] flex flex-col rounded-xl z-50 overflow-hidden 
                shadow-[0_8px_32px_rgba(0,0,0,0.4)] 
                border border-white/10 
                backdrop-blur-xl bg-zinc-950/80
                transition-opacity duration-200
            `}
        >
            
            {/* Header - Drag Handle */}
            <div 
                onMouseDown={handleMouseDown}
                className="h-10 bg-white/5 border-b border-white/5 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing select-none"
            >
                <div className="flex items-center gap-2">
                    <GripHorizontal size={14} className="text-zinc-600" />
                    <span className="text-xs font-medium text-zinc-400">Design Assistant</span>
                    
                    {/* Connection Status Indicator */}
                    {isConnected ? (
                        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full" title="Gemini Connected">
                            <Zap size={8} className="text-emerald-400 fill-emerald-400" />
                            <span className="text-[9px] font-bold text-emerald-400">ONLINE</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full" title="Missing API Key">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span className="text-[9px] font-bold text-red-400">OFFLINE</span>
                        </div>
                    )}
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                    <Minimize2 size={14} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-grow overflow-y-auto p-3 space-y-3 scrollbar-none">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2 opacity-50 px-4 text-center">
                        <Bot size={24} />
                        <span className="text-xs">
                            {isConnected 
                                ? "Ask me to optimize the layout, simulate weather conditions, or analyze risk." 
                                : "Gemini API Key missing. Please configure your environment."}
                        </span>
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                         <div className={`
                            w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5
                            ${msg.role === 'assistant' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-zinc-800 text-zinc-400'}
                        `}>
                            {msg.role === 'assistant' ? <Bot size={12} /> : <User size={12} />}
                        </div>
                        <div className={`
                            max-w-[85%] text-[11px] py-1.5 px-2.5 rounded-lg leading-relaxed
                            ${msg.role === 'assistant' 
                                ? 'bg-zinc-800/40 text-zinc-300' 
                                : 'bg-yellow-600/10 border border-yellow-500/20 text-yellow-100'
                            }
                        `}>
                            {msg.text}
                            {msg.isCommand && (
                                <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-500/80 font-mono">
                                    <Terminal size={8} /> CONFIG UPDATED
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex gap-2">
                         <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-yellow-500/10 text-yellow-400 text-[10px] mt-0.5">
                            <Bot size={12} />
                        </div>
                        <div className="bg-zinc-800/40 text-zinc-300 rounded-lg py-2 px-3">
                            <Loader2 size={14} className="animate-spin text-zinc-500" />
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-zinc-950/50 border-t border-white/5">
                <div className="relative group">
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                        placeholder={isConnected ? "Optimize spacing for current wind..." : "Connecting..."}
                        className="w-full bg-zinc-900/50 text-zinc-200 text-[11px] rounded-lg pl-3 pr-8 py-2.5 border border-white/5 focus:outline-none focus:bg-zinc-900 focus:border-white/10 transition-all placeholder:text-zinc-700 disabled:opacity-50"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-50"
                    >
                        <Send size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInterface;