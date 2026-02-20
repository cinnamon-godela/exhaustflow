import React, { useState, useRef, useEffect } from 'react';
import { SimulationInputs, SimulationResult } from '../types';
import { Send, User, Bot, Terminal, MessageSquare, Minimize2, GripHorizontal, Loader2, Zap } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface ChatInterfaceProps {
    inputs: SimulationInputs;
    results: SimulationResult;
    onUpdate: (newInputs: SimulationInputs) => void;
}

interface Message {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    isCommand?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ inputs, results, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Check for API Key presence for the "Tie" status
    const isConnected = !!process.env.API_KEY;

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
                    text: "I am not connected to Gemini. Please ensure your API_KEY is set in the environment variables.",
                    isCommand: false
                }]);
                setIsLoading(false);
            }, 500);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const currentStateDescription = `
                Current Simulation State:
                - Geometry: ${inputs.rows} rows x ${inputs.columns} columns
                - Spacing: Row ${inputs.rowSpacing} ft / Col ${inputs.colSpacing} ft
                - Flow Velocity: ${inputs.windSpeed} m/s
                - Flow Angle: ${inputs.windDirection} deg
                - Ambient: ${inputs.ambientTemp} F
                - Flow Rate: ${inputs.flowRate} kCFM
                - EFT Base (Vertical Stacks): ${inputs.eftBase}
                - Discharge Extension (Straightener): ${inputs.fanExtension}

                Current Performance Results:
                - Peak Intake Temp: ${results.maxTotalTemp} F
                - Avg Temp Rise: ${results.avgTempRise} F
                - Risk Level: ${results.riskLevel}
                - Effective Path Length (Watson Metric): ${results.benchmark.effectiveLengthMeters} meters
                - Watson Predicted Peak Rise: ${results.benchmark.predictedMaxRiseF} F
            `;

            const expertContext = `
                THEORY OF OPERATIONS:
                You are an expert in Computational Fluid Dynamics (CFD) specializing in Mission Critical Data Center Cooling.
                You manage a surrogate model based on parametric analysis of Air-Cooled Chillers (ACCs).
                
                RESEARCH BASIS (Watson & Charentenay, 2019):
                You have been trained on the paper "Parametric Study of Air Re-entrainment within Air-Cooled Chiller Compounds".
                Key Findings from this paper:
                1. **Plant Compound Length ($L_{PC}$)** is the dominant component affecting re-entrainment (Correlation coeff 0.99).
                2. Re-entrainment increases linearly with wind speed and plant length.
                3. **Rule of Thumb**: A 25m long compound results in ~5°C average and ~10°C peak rise.
                4. The model derives specific linear estimates:
                   - Avg Rise (C) = 8.7 * max((L - 38.9)/26.8, -1) + 9.0
                   - Max Rise (C) = 18.7 * max((L - 38.9)/26.8, -1) + 19.5
                5. High wind speeds (10m/s) aligned with the chiller length create the worst-case scenario.

                MITIGATION STRATEGIES (EFT):
                - "EFT Base" (Exhaust Flow Technology) utilizes vertical discharge stacks to increase plume momentum.
                - Physics: It punches through the boundary layer, preventing downwash and re-entrainment.
                - Model Impact: Reduces peak temperature rise by ~65% and enforces uniformity (Peak Shaving).
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: userText,
                config: {
                    systemInstruction: `
                        ${expertContext}
                        
                        ${currentStateDescription}

                        Guidelines:
                        1. **Dialogue**: Act like a consultant. Answer ALL questions. 
                        2. **Using the Paper**: If the user asks about validation, mention Watson & Charentenay (2019). If the user asks about array size, mention that "Plant Length" is the critical factor identified in the research.
                        3. **Parameter Setting**: If the user asks to change something, map it to parameters.
                           - "Make it bigger" -> Increase rows/cols.
                           - "Spread them out" -> Increase rowSpacing/colSpacing.
                           - "Add straighteners/stacks/EFT" -> Set eftBase or fanExtension to true.
                           - "Simulate a storm" -> Increase windSpeed.
                        
                        Constraints:
                        - rows, columns: 1 to 10.
                        - rowSpacing, colSpacing: 5 to 50 (feet).
                        - windSpeed: 0 to 20 (m/s).
                        - windDirection: 0 to 360 (degrees).
                        - flowRate: 30 to 200 (kCFM).
                        - ambientTemp: 60 to 120 (Fahrenheit).

                        OUTPUT FORMAT:
                        Return a JSON object.
                        - If parameters need changing, include them in the JSON.
                        - ALWAYS include a 'responseMessage' field with your text answer/advice. 
                        - If no parameters change, just return the 'responseMessage'.
                    `,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            rows: { type: Type.NUMBER },
                            columns: { type: Type.NUMBER },
                            rowSpacing: { type: Type.NUMBER },
                            colSpacing: { type: Type.NUMBER },
                            windSpeed: { type: Type.NUMBER },
                            windDirection: { type: Type.NUMBER },
                            flowRate: { type: Type.NUMBER },
                            ambientTemp: { type: Type.NUMBER },
                            eftBase: { type: Type.BOOLEAN },
                            fanExtension: { type: Type.BOOLEAN },
                            resetLayout: { type: Type.BOOLEAN },
                            responseMessage: { type: Type.STRING },
                        },
                        required: ["responseMessage"]
                    }
                }
            });

            const resultText = response.text;
            if (resultText) {
                const data = JSON.parse(resultText);
                
                const newInputs = { ...inputs };
                let hasChanges = false;
                let geometryChanged = false;

                if (data.rows !== undefined && data.rows !== inputs.rows) { 
                    newInputs.rows = data.rows; 
                    hasChanges = true; 
                    geometryChanged = true;
                }
                if (data.columns !== undefined && data.columns !== inputs.columns) { 
                    newInputs.columns = data.columns; 
                    hasChanges = true; 
                    geometryChanged = true;
                }
                if (data.rowSpacing !== undefined && data.rowSpacing !== inputs.rowSpacing) { 
                    newInputs.rowSpacing = data.rowSpacing; 
                    hasChanges = true; 
                }
                if (data.colSpacing !== undefined && data.colSpacing !== inputs.colSpacing) { 
                    newInputs.colSpacing = data.colSpacing; 
                    hasChanges = true; 
                }
                if (data.windSpeed !== undefined && data.windSpeed !== inputs.windSpeed) { 
                    newInputs.windSpeed = data.windSpeed; 
                    hasChanges = true; 
                }
                if (data.windDirection !== undefined && data.windDirection !== inputs.windDirection) { 
                    newInputs.windDirection = data.windDirection; 
                    hasChanges = true; 
                }
                if (data.flowRate !== undefined && data.flowRate !== inputs.flowRate) { 
                    newInputs.flowRate = data.flowRate; 
                    hasChanges = true; 
                }
                if (data.ambientTemp !== undefined && data.ambientTemp !== inputs.ambientTemp) { 
                    newInputs.ambientTemp = data.ambientTemp; 
                    hasChanges = true; 
                }
                if (data.eftBase !== undefined && data.eftBase !== inputs.eftBase) { 
                    newInputs.eftBase = data.eftBase; 
                    hasChanges = true; 
                }
                if (data.fanExtension !== undefined && data.fanExtension !== inputs.fanExtension) { 
                    newInputs.fanExtension = data.fanExtension; 
                    hasChanges = true; 
                }
                
                if (geometryChanged || data.resetLayout) {
                    const newSize = newInputs.rows * newInputs.columns;
                    newInputs.layout = Array(newSize).fill(true);
                    hasChanges = true;
                }

                if (hasChanges) {
                    onUpdate(newInputs);
                }

                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'assistant',
                    text: data.responseMessage,
                    isCommand: hasChanges
                }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: "I encountered an error processing that request. Please try again.",
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
                            ${msg.role === 'assistant' ? 'bg-blue-500/10 text-blue-400' : 'bg-zinc-800 text-zinc-400'}
                        `}>
                            {msg.role === 'assistant' ? <Bot size={12} /> : <User size={12} />}
                        </div>
                        <div className={`
                            max-w-[85%] text-[11px] py-1.5 px-2.5 rounded-lg leading-relaxed
                            ${msg.role === 'assistant' 
                                ? 'bg-zinc-800/40 text-zinc-300' 
                                : 'bg-blue-600/10 border border-blue-500/20 text-blue-100'
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
                         <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-blue-500/10 text-blue-400 text-[10px] mt-0.5">
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