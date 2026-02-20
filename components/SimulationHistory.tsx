import React, { useEffect, useState } from 'react';
import { supabase, SavedSimulation } from '../services/supabase';
import { SimulationInputs, SimulationResult } from '../types';
import { X, Save, Download, Trash2, Clock, Database, AlertCircle, Loader2, WifiOff } from 'lucide-react';

interface SimulationHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    currentInputs: SimulationInputs;
    currentResults: SimulationResult;
    onLoad: (inputs: SimulationInputs) => void;
}

const SimulationHistory: React.FC<SimulationHistoryProps> = ({ 
    isOpen, onClose, currentInputs, currentResults, onLoad 
}) => {
    const [saves, setSaves] = useState<SavedSimulation[]>([]);
    const [loading, setLoading] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchSaves = async () => {
        setLoading(true);
        setError(null);

        if (!supabase) {
            setError("Database not connected. Please set VITE_SUPABASE_URL in your environment.");
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('simulations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching saves:', error);
            setError("Could not connect to database. Check API Keys.");
        } else {
            setSaves(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchSaves();
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!saveName.trim()) return;
        setLoading(true);
        
        if (!supabase) {
            setError("Cannot save: Database not connected.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.from('simulations').insert([
            {
                name: saveName,
                inputs: currentInputs,
                results: currentResults
            }
        ]);

        if (error) {
            setError(error.message);
        } else {
            setSaveName('');
            fetchSaves();
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm("Delete this simulation?")) return;
        
        if (!supabase) return;

        const { error } = await supabase.from('simulations').delete().eq('id', id);
        if (!error) fetchSaves();
    };

    const handleLoad = (sim: SavedSimulation) => {
        onLoad(sim.inputs);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#18181b] w-full max-w-2xl rounded-xl border border-[#27272a] shadow-2xl flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
                    <div className="flex items-center gap-2 text-zinc-100">
                        <Database className="text-blue-500" size={18} />
                        <h2 className="font-bold tracking-tight">Simulation Database</h2>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Save Section */}
                <div className="p-4 border-b border-[#27272a] bg-[#09090b]/50">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">
                        Save Current Configuration
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            placeholder="e.g. High Wind - 40C - Optimised"
                            className="flex-grow bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-500/50"
                        />
                        <button 
                            onClick={handleSave}
                            disabled={loading || !saveName.trim() || !supabase}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-colors"
                        >
                            {loading ? <Loader2 className="animate-spin" size={14}/> : <Save size={14} />}
                            SAVE
                        </button>
                    </div>
                    {error && (
                        <div className="mt-2 text-red-400 text-xs flex items-center gap-1.5 bg-red-500/10 p-2 rounded border border-red-500/20">
                            <AlertCircle size={12} /> {error}
                        </div>
                    )}
                </div>

                {/* List Section */}
                <div className="flex-grow overflow-y-auto p-2 scrollbar-thin">
                     {loading && saves.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-zinc-500">
                            <Loader2 className="animate-spin mr-2" size={16} /> Loading records...
                        </div>
                     ) : saves.length === 0 && !error ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
                            <Database size={32} className="opacity-20" />
                            <span className="text-sm">No saved simulations found.</span>
                        </div>
                     ) : saves.length === 0 && error ? (
                         <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
                            <WifiOff size={32} className="opacity-20" />
                            <span className="text-sm">Connection failed.</span>
                        </div>
                     ) : (
                        <div className="space-y-1">
                            {saves.map((sim) => (
                                <div 
                                    key={sim.id}
                                    onClick={() => handleLoad(sim)}
                                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer border border-transparent hover:border-zinc-700 transition-all"
                                >
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-zinc-200 group-hover:text-blue-400 transition-colors">
                                                {sim.name}
                                            </span>
                                            {sim.results?.riskLevel === 'Critical' && (
                                                <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">CRITICAL</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-mono">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} /> {new Date(sim.created_at).toLocaleDateString()}
                                            </span>
                                            <span>
                                                {sim.inputs.rows}x{sim.inputs.columns} Array
                                            </span>
                                            <span>
                                                {sim.inputs.ambientTemp}°C
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            className="p-2 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500 hover:text-white transition-colors"
                                            title="Load Simulation"
                                        >
                                            <Download size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(sim.id, e)}
                                            className="p-2 hover:bg-red-500/10 hover:text-red-400 text-zinc-600 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

export default SimulationHistory;