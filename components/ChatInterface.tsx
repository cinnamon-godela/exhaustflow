import React, { useState, useRef, useEffect } from 'react';
import { SimulationInputs } from '../types';
import { Send, User, Bot, Terminal, MessageSquare, Minimize2, GripHorizontal, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

interface ChatInterfaceProps {
    inputs: SimulationInputs;
    onUpdate: (newInputs: SimulationInputs) => void;
}

interface Message {
    id: number;
    role: 'user' | 'assistant';
    text: string;
    isCommand?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ inputs, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(true);
    // Initial message removed as requested
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Dragging Logic
    const [position, setPosition] = useState<{x: number, y: number} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });


    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        
        if (!position) {
            // First time dragging? Calculate current absolute position from the CSS position
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
        
        // Add user message
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userText }]);
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Construct the current state context string
            const currentStateDescription = `
                Current State:
                - Flow Velocity: ${inputs.windSpeed} m/s
                - Flow Angle: ${inputs.windDirection} deg
                - Ambient: ${inputs.ambientTemp} C
                - Flow Rate: ${inputs.flowRate} kCFM
                - Spacing: ${inputs.spacing} ft
                - EFT Base: ${inputs.eftBase}
                - Discharge Extension (Straightener): ${inputs.fanExtension}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: userText,
                config: {
                    systemInstruction: `
                        You are the AI controller for a Data Center Chiller Simulation.
                        Your goal is to interpret the user's natural language intent and map it to specific simulation parameters.
                        
                        ${currentStateDescription}

                        Constraints:
                        - spacing: 5 to 50 (feet)
                        - windSpeed: 0 to 20 (m/s). Representing global airflow velocity.
                        - windDirection: 0 to 360 (degrees). Represents the aerodynamic flow angle vector relative to the grid. 0 degrees is flow from Left-to-Right.
                        - flowRate: 30 to 200 (kCFM)
                        - ambientTemp: 20 to 50 (Celsius)
                        - eftBase: boolean (High-velocity vertical discharge base)
                        - fanExtension: boolean (12" Discharge extension + Flow Straightener. Adds plume height, reduces swirl.)
                        
                        If the user mentions "storm", "hot day", "tight space", etc., infer appropriate values.
                        If the user mentions "straightener", "attachment", "height extension", "venturi", or "swirl reduction", set fanExtension to true.
                        If the user asks to "reset" the layout, set resetLayout to true.

                        Output a JSON object containing ONLY the parameters that should change, plus a 'responseMessage' describing the action.
                    `,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            spacing: { type: Type.NUMBER },
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
                
                // Construct new inputs based on what was returned
                const newInputs = { ...inputs };
                let hasChanges = false;

                if (data.spacing !== undefined) { newInputs.spacing = data.spacing; hasChanges = true; }
                if (data.windSpeed !== undefined) { newInputs.windSpeed = data.windSpeed; hasChanges = true; }
                if (data.windDirection !== undefined) { newInputs.windDirection = data.windDirection; hasChanges = true; }
                if (data.flowRate !== undefined) { newInputs.flowRate = data.flowRate; hasChanges = true; }
                if (data.ambientTemp !== undefined) { newInputs.ambientTemp = data.ambientTemp; hasChanges = true; }
                if (data.eftBase !== undefined) { newInputs.eftBase = data.eftBase; hasChanges = true; }
                if (data.fanExtension !== undefined) { newInputs.fanExtension = data.fanExtension; hasChanges = true; }
                
                if (data.resetLayout) {
                    newInputs.layout = Array(16).fill(true);
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
                <MessageSquare size={20} />
            </button>
        );
    }

    // Use absolute positioning if dragged, otherwise fixed CSS classes
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
                    <span className="text-xs font-medium text-zinc-400">Assistant</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                    <Minimize2 size={14} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-grow overflow-y-auto p-3 space-y-3 scrollbar-none">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-2 opacity-50">
                        <Bot size={24} />
                        <span className="text-xs">Ready for commands...</span>
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
                                    <Terminal size={8} /> PARAMETERS UPDATED
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
                        placeholder={isLoading ? "Processing..." : "Describe a scenario..."}
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