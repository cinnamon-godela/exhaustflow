import React, { useState, useMemo, useEffect } from 'react';
import { SimulationInputs } from './types';
import { calculateSimulation } from './services/surrogateModel';
import Controls from './components/Controls';
import HeatmapGrid from './components/HeatmapGrid';
import CutPlaneView from './components/CutPlaneView';
import StatsPanel from './components/StatsPanel';
import ChatInterface from './components/ChatInterface';
import { Grid, Layers, Box } from 'lucide-react';

type ViewMode = 'heatmap' | 'cutplane' | '3d';

const App: React.FC = () => {
    
    // Default to 5 rows x 4 cols = 20 units (matches dataset perfectly)
    const DEFAULT_ROWS = 5;
    const DEFAULT_COLS = 4;

    const [inputs, setInputs] = useState<SimulationInputs>({
        rows: DEFAULT_ROWS,
        columns: DEFAULT_COLS,
        rowSpacing: 12,
        colSpacing: 8,
        windSpeed: 4,         
        windDirection: 0,     
        flowRate: 140,        
        ambientTemp: 40,      
        layout: Array(DEFAULT_ROWS * DEFAULT_COLS).fill(true),
        eftBase: false,
        fanExtension: false
    });

    const [viewMode, setViewMode] = useState<ViewMode>('heatmap');

    // Ensure layout array matches grid dimensions if they change
    useEffect(() => {
        const requiredSize = inputs.rows * inputs.columns;
        if (inputs.layout.length !== requiredSize) {
            setInputs(prev => ({
                ...prev,
                layout: Array(requiredSize).fill(true)
            }));
        }
    }, [inputs.rows, inputs.columns]);

    const results = useMemo(() => calculateSimulation(inputs), [inputs]);

    const handleToggleNode = (index: number) => {
        const newLayout = [...inputs.layout];
        newLayout[index] = !newLayout[index];
        setInputs({ ...inputs, layout: newLayout });
    };

    const handleResetLayout = () => {
        setInputs({ ...inputs, layout: Array(inputs.rows * inputs.columns).fill(true) });
    };

    return (
        <div className="h-screen w-screen bg-[#09090b] text-zinc-300 flex overflow-hidden relative">
            
            {/* COLUMN 1: LEFT SIDEBAR (CONTROLS) */}
            <div className="w-80 flex-shrink-0 border-r border-[#27272a] bg-[#18181b] overflow-y-auto z-20 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
                <Controls 
                    inputs={inputs} 
                    onChange={setInputs} 
                    onResetLayout={handleResetLayout}
                />
            </div>

            {/* COLUMN 2: CENTER CANVAS (VISUALIZATION) */}
            <div className="flex-grow flex flex-col min-w-0 bg-[#09090b] relative z-0">
                
                {/* Center Header / Tabs */}
                <div className="h-14 border-b border-[#27272a] flex items-center justify-between px-6 bg-[#09090b] select-none">
                    <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-lg border border-zinc-800">
                         <button 
                            onClick={() => setViewMode('heatmap')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                viewMode === 'heatmap' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                        >
                            <Grid size={12} />
                            Thermal Map
                        </button>
                        <button 
                            onClick={() => setViewMode('cutplane')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                viewMode === 'cutplane' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                        >
                            <Layers size={12} />
                            CFD Plane
                        </button>
                        <button 
                            onClick={() => setViewMode('3d')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                                viewMode === '3d' 
                                ? 'bg-zinc-800 text-white shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                            }`}
                        >
                            <Box size={12} />
                            3D Model
                        </button>
                    </div>
                    <div className="text-[10px] text-zinc-600 font-mono flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                        SURROGATE SOLVER v2.1
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-grow relative overflow-hidden flex flex-col p-6">
                    {/* Stats Overlay */}
                    <div className="mb-6">
                        <StatsPanel data={results} />
                    </div>

                    <div className="flex-grow border border-[#27272a] rounded-xl bg-black relative overflow-hidden shadow-2xl ring-1 ring-white/5">
                        {viewMode === 'heatmap' && (
                            <HeatmapGrid 
                                data={results} 
                                inputs={inputs} 
                                onToggleNode={handleToggleNode} 
                            />
                        )}
                        {viewMode === 'cutplane' && (
                            <CutPlaneView 
                                data={results} 
                                inputs={inputs} 
                            />
                        )}
                        {viewMode === '3d' && (
                            <div className="w-full h-full relative bg-[#09090b]">
                                {/* Blocker for Sketchfab Header/Tag */}
                                <div className="absolute top-0 left-0 w-full h-12 bg-[#09090b] z-20 pointer-events-none" />
                                
                                <iframe 
                                    title="Data Center Thermal Map" 
                                    className="w-full h-full relative z-10"
                                    frameBorder="0" 
                                    allowFullScreen 
                                    allow="autoplay; fullscreen; xr-spatial-tracking" 
                                    src="https://sketchfab.com/models/b691bef94d26472e9d43103cefa0f383/embed?autostart=1&camera=0&preload=1&transparent=1&ui_theme=dark" 
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FLOATING CHAT INTERFACE */}
            <ChatInterface 
                inputs={inputs}
                onUpdate={setInputs}
            />

        </div>
    );
};

export default App;