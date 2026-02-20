import React, { useState, useCallback } from 'react';
import { X, Play, Loader2, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import {
  runGroundTruthTest,
  type GroundTruthTestOutput,
  type ConfigResult,
} from '../services/runGroundTruthTest';

interface GroundTruthTestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  apiBaseUrl: string | null;
}

const GroundTruthTestPanel: React.FC<GroundTruthTestPanelProps> = ({
  isOpen,
  onClose,
  apiBaseUrl,
}) => {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<GroundTruthTestOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const runTest = useCallback(async () => {
    if (!apiBaseUrl) return;
    setRunning(true);
    setError(null);
    setOutput(null);
    try {
      const result = await runGroundTruthTest(apiBaseUrl);
      setOutput(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [apiBaseUrl]);

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!isOpen) return null;

  const s = output?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-3xl bg-[#18181b] border-l border-[#27272a] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#09090b]">
          <h2 className="text-sm font-semibold text-zinc-200">API ground-truth test</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-[#27272a] space-y-3">
          <p className="text-xs text-zinc-500">
            Runs 87 configs (Spacing 10/15/20 ft × row profiles), calls the chiller API, and compares predictions to ground truth. Deltas are in Kelvin.
          </p>
          <button
            type="button"
            onClick={runTest}
            disabled={running || !apiBaseUrl}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running… (this may take a minute)
              </>
            ) : (
              <>
                <Play size={16} />
                Run test
              </>
            )}
          </button>
          {apiBaseUrl && (
            <p className="text-[10px] text-zinc-500 font-mono truncate" title={apiBaseUrl}>
              API: {apiBaseUrl}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-900/50 bg-amber-950/20 text-amber-200 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {s && (
            <div className="rounded-lg border border-[#27272a] bg-[#09090b] p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Summary</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-zinc-500">Total configs</span>
                <span className="font-mono text-zinc-200">{s.total}</span>
                <span className="text-zinc-500">OK</span>
                <span className="font-mono text-emerald-400">{s.ok}</span>
                <span className="text-zinc-500">Failed</span>
                <span className="font-mono text-amber-400">{s.failed}</span>
                <span className="text-zinc-500">Overall max |delta|</span>
                <span className="font-mono text-zinc-200">{s.overallMaxAbs.toFixed(4)} K</span>
                <span className="text-zinc-500">Max RMSE (per config)</span>
                <span className="font-mono text-zinc-200">{s.maxRmse.toFixed(4)} K</span>
                <span className="text-zinc-500">Mean RMSE</span>
                <span className="font-mono text-zinc-200">{s.meanRmse.toFixed(4)} K</span>
              </div>
            </div>
          )}

          {output && output.results.length > 0 && (
            <div className="rounded-lg border border-[#27272a] bg-[#09090b] overflow-hidden">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3 border-b border-[#27272a]">
                Per-config deltas (prediction − ground truth)
              </h3>
              <ul className="divide-y divide-[#27272a] max-h-[50vh] overflow-y-auto">
                {output.results.map((r) => (
                  <ConfigRow key={`${r.spacing}-${r.rowName}`} result={r} expanded={expandedRows.has(`${r.spacing}-${r.rowName}`)} onToggle={() => toggleRow(`${r.spacing}-${r.rowName}`)} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ConfigRow({
  result,
  expanded,
  onToggle,
}: {
  result: ConfigResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { spacing, rowName, params, deltas, maxAbs, meanAbs, rmse, error } = result;
  const label = `Spacing ${spacing} ft | ${rowName}`;

  return (
    <li className="bg-[#18181b]/50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#27272a]/50 transition-colors"
      >
        {expanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
        <span className="text-xs font-medium text-zinc-300 truncate flex-1">{label}</span>
        {error ? (
          <span className="text-[10px] text-amber-400">Error</span>
        ) : (
          <span className="text-[10px] text-zinc-500 font-mono">max Δ {maxAbs!.toFixed(2)} K</span>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-0 space-y-3 border-t border-[#27272a]/50">
          {error ? (
            <p className="text-xs text-amber-400">{error}</p>
          ) : (
            <>
              <p className="text-[10px] text-zinc-500">
                Windspeed={params.Windspeed} m/s, CFM={params.CFM}, Orientation={params.Orientation}°, Spacing={params.Spacing} ft
              </p>
              <p className="text-[10px] text-zinc-400">
                max|δ| = {maxAbs!.toFixed(4)} K · mean|δ| = {meanAbs!.toFixed(4)} K · RMSE = {rmse!.toFixed(4)} K
              </p>
              {result.predicted && result.truth && (
                <div className="rounded border border-[#27272a] overflow-hidden">
                  <div className="grid grid-cols-4 gap-px bg-[#27272a] text-[10px] font-medium">
                    <div className="bg-[#18181b] px-2 py-1.5 text-zinc-500">Chiller</div>
                    <div className="bg-[#18181b] px-2 py-1.5 text-violet-400/90">Predicted (K)</div>
                    <div className="bg-[#18181b] px-2 py-1.5 text-emerald-400/90">Ground truth (K)</div>
                    <div className="bg-[#18181b] px-2 py-1.5 text-zinc-500">Δ (K)</div>
                  </div>
                  {result.predicted.map((pred, i) => {
                    const truth = result.truth[i];
                    const d = deltas?.[i] ?? pred - truth;
                    return (
                      <div key={i} className="grid grid-cols-4 gap-px bg-[#27272a] text-[10px] font-mono">
                        <div className="bg-[#09090b]/80 px-2 py-1 text-zinc-400">{i + 1}</div>
                        <div className="bg-[#09090b]/80 px-2 py-1 text-violet-300/90">{pred.toFixed(2)}</div>
                        <div className="bg-[#09090b]/80 px-2 py-1 text-emerald-300/90">{truth.toFixed(2)}</div>
                        <div className={`bg-[#09090b]/80 px-2 py-1 ${d >= 0 ? 'text-violet-400' : 'text-amber-400'}`}>
                          {d >= 0 ? '+' : ''}{d.toFixed(3)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default GroundTruthTestPanel;
