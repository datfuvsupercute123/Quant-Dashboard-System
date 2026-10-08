'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function QuantDashboard() {
  const [contract, setContract] = useState({ S0: 100, K: 100, T: 0.25, option_type: 'Call' });
  const [dynamics, setDynamics] = useState({ mu: 0.05, sigma: 0.2, r: 0.02, jump_lambda: 1.0, jump_mean: -0.05, jump_std: 0.1 });
  
  const [simulation, setSimulation] = useState({ 
    horizon: 1.0, 
    ticks: 250, 
    hedge_rebalances: 30, 
    seed: '42',
    speed_ms: 20,
    enable_animation: false
  });

  const [selectedModel, setSelectedModel] = useState('Bates');
  const [activeTab, setActiveTab] = useState<'stochastic' | 'hedging'>('stochastic'); // TAB STATE
  const [loading, setLoading] = useState(false);
  const [fullResults, setFullResults] = useState<any>(null);

  const [currentTick, setCurrentTick] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animationTimer = useRef<any>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    setIsAnimating(false);
    try {
      const payload = {
        selected_model: selectedModel,
        contract,
        dynamics,
        market_making: { half_spread: 0.15, quote_size: 1, fill_intensity: 0.35, risk_aversion: 0.02 },
        simulation: {
          horizon: Number(simulation.horizon),
          ticks: Number(simulation.ticks),
          hedge_rebalances: Number(simulation.hedge_rebalances),
          seed: simulation.seed === '' ? null : Number(simulation.seed)
        }
      };

      const response = await axios.post('http://127.0.0.1:8000/api/v1/simulate-dashboard', payload);
      setFullResults(response.data.data);
      
      if (simulation.enable_animation) {
        setCurrentTick(1);
        setIsAnimating(true);
      } else {
        setCurrentTick(response.data.data.underlying_price_path.length);
      }
    } catch (error) {
      console.error("API Call Error:", error);
      alert("Backend API Error! Ensure main_api.py is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAnimating && fullResults) {
      animationTimer.current = setInterval(() => {
        setCurrentTick((prev) => {
          if (prev >= fullResults.underlying_price_path.length) {
            setIsAnimating(false);
            return prev;
          }
          return prev + 1;
        });
      }, Math.max(10, simulation.speed_ms));
    } else {
      clearInterval(animationTimer.current);
    }
    return () => clearInterval(animationTimer.current);
  }, [isAnimating, fullResults, simulation.speed_ms]);

  const replayAnimation = () => {
    if (!fullResults) return;
    setCurrentTick(1);
    setIsAnimating(true);
  };

  const animatedSpot = fullResults ? fullResults.underlying_price_path.slice(0, currentTick) : [];
  const animatedOption = fullResults ? fullResults.predicted_option_price_path.slice(0, currentTick) : [];
  const animatedDelta = fullResults ? fullResults.greeks_trajectory.delta.slice(0, currentTick) : [];
  const animatedGamma = fullResults ? fullResults.greeks_trajectory.gamma.slice(0, currentTick) : [];
  const animatedVega = fullResults ? fullResults.greeks_trajectory.vega.slice(0, currentTick) : [];
  const animatedPnL = fullResults ? fullResults.pnl_hedging_path.slice(0, currentTick) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 p-4 flex justify-between items-center px-8">
        <h1 className="text-xl font-bold tracking-wider text-emerald-400 flex items-center gap-2">
           QUANT VOLATILITY & EXOTICS DESK
        </h1>
        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
          Institutional Live Stream Desk
        </span>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR CONTROLS */}
        <aside className="w-80 border-r border-slate-800 bg-slate-900/30 p-5 overflow-y-auto space-y-6 text-sm">
          
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">CONTRACT CONFIG</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">S₀ (spot)</label>
                <input type="number" value={contract.S0} onChange={e => setContract({...contract, S0: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Strike K</label>
                <input type="number" value={contract.K} onChange={e => setContract({...contract, K: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Rolling T (yrs)</label>
                <input type="number" step="0.01" value={contract.T} onChange={e => setContract({...contract, T: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Type</label>
                <select value={contract.option_type} onChange={e => setContract({...contract, option_type: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white">
                  <option value="Call">Call</option>
                  <option value="Put">Put</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">TRUE DYNAMICS</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Drift μ</label>
                <input type="number" step="0.01" value={dynamics.mu} onChange={e => setDynamics({...dynamics, mu: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Vol σ</label>
                <input type="number" step="0.01" value={dynamics.sigma} onChange={e => setDynamics({...dynamics, sigma: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Rate r</label>
                <input type="number" step="0.01" value={dynamics.r} onChange={e => setDynamics({...dynamics, r: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Jump λ/yr</label>
                <input type="number" step="0.1" value={dynamics.jump_lambda} onChange={e => setDynamics({...dynamics, jump_lambda: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">SIMULATION</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Horizon (yrs)</label>
                <input type="number" step="0.1" value={simulation.horizon} onChange={e => setSimulation({...simulation, horizon: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Ticks</label>
                <input type="number" value={simulation.ticks} onChange={e => setSimulation({...simulation, ticks: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Hedge rebalances</label>
                <input type="number" value={simulation.hedge_rebalances} onChange={e => setSimulation({...simulation, hedge_rebalances: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Seed (blank=random)</label>
                <input type="text" value={simulation.seed} onChange={e => setSimulation({...simulation, seed: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Speed (ms/tick)</label>
                <input type="number" value={simulation.speed_ms} onChange={e => setSimulation({...simulation, speed_ms: +e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white"/>
              </div>
              
              <div className="flex items-center gap-2 mt-4 col-span-2">
                <input 
                  type="checkbox" 
                  id="anim_toggle"
                  checked={simulation.enable_animation} 
                  onChange={e => setSimulation({...simulation, enable_animation: e.target.checked})}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
                <label htmlFor="anim_toggle" className="text-xs text-emerald-400 font-semibold cursor-pointer">
                  Enable Animation Stream
                </label>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-1">ENGINE MODEL SELECTION</h2>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white mb-4">
              <option value="Bates">Bates (Stochastic Volatility + Jumps)</option>
              <option value="Merton">Merton (Poisson Jump Diffusion)</option>
              <option value="Crank-Nicolson PDE">Crank-Nicolson PDE (American / Exotics)</option>
              <option value="Black-Scholes">Black-Scholes-Merton Baseline</option>
            </select>

            <button 
              onClick={handleRunSimulation} 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded transition-all shadow-lg shadow-emerald-900/30"
            >
              {loading ? "Simulating..." : "RUN SIMULATION"}
            </button>
          </div>
        </aside>

        {/* MAIN VISUALIZATION AREA */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {fullResults ? (
            <>
              {/* REPLAY TOOLBAR & TAB SWITCHER */}
              <div className="bg-slate-900 border border-slate-800 rounded p-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('stochastic')}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${activeTab === 'stochastic' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                     Stochastic & Option Dynamics
                  </button>
                  <button 
                    onClick={() => setActiveTab('hedging')}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition-all ${activeTab === 'hedging' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                     Hedging, PnL & 3D Analytics
                  </button>
                </div>

                <button 
                  onClick={replayAnimation} 
                  className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-3 py-1.5 rounded text-xs border border-emerald-500/20"
                >
                  ↺ REPLAY ANIMATION
                </button>
              </div>

              {/* METRICS SUMMARY */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400">Final Spot Price</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">${animatedSpot[animatedSpot.length - 1]?.toFixed(2) || 0}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400">Final Option Price</div>
                  <div className="text-2xl font-bold text-sky-400 mt-1">${animatedOption[animatedOption.length - 1]?.toFixed(4) || 0}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400">Hedging Total PnL</div>
                  <div className={`text-2xl font-bold mt-1 ${(animatedPnL[animatedPnL.length - 1] || 0) >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                    ${animatedPnL[animatedPnL.length - 1]?.toFixed(4) || 0}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-4">
                  <div className="text-xs text-slate-400">Max Hedging Drawdown</div>
                  <div className="text-2xl font-bold text-rose-400 mt-1">${fullResults.analytics_summary.max_drawdown_pnl}</div>
                </div>
              </div>

              {/* TAB 1: STOCHASTIC & OPTION DYNAMICS */}
              {activeTab === 'stochastic' && (
                <div className="space-y-6">
                  {/* CHART 1: 50-PATH MONTE CARLO SAMPLE CONE */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">1. Monte Carlo Multi-Path Stochastic Cone (50 Paths - {selectedModel} Engine)</div>
                    <p className="text-xs text-slate-500 mb-3">Simulates 50 high-density parallel stochastic price trajectories under {selectedModel} dynamics.</p>
                    <Plot
                      data={fullResults.mc_sample_paths.map((path: number[], idx: number) => ({
                        y: path.slice(0, currentTick),
                        type: 'scatter',
                        mode: 'lines',
                        name: `Path ${idx + 1}`,
                        opacity: 0.30,
                        line: { width: 1 }
                      }))}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        showlegend: false,
                        yaxis: { title: 'Spot Price ($)', gridcolor: '#1e293b' },
                        margin: { t: 20, b: 40, l: 50, r: 50 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "280px" }}
                    />
                  </div>

                  {/* CHART 2: DISTRIBUTION OF TERMINAL RETURNS (SMOOTH 50 PATH HISTOGRAM) */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">2. Distribution of Terminal Returns ($\ln(S_T / S_0)$ at Horizon $T$)</div>
                    <p className="text-xs text-slate-500 mb-3">Empirical probability density distribution of log-returns generated across 50 Monte Carlo paths.</p>
                    <Plot
                      data={[
                        {
                          x: fullResults.terminal_returns,
                          type: 'histogram',
                          marker: { color: '#38bdf8', opacity: 0.75 },
                          nbinsx: 25
                        }
                      ]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        xaxis: { title: 'Terminal Log Return', gridcolor: '#1e293b' },
                        yaxis: { title: 'Path Count Frequency', gridcolor: '#1e293b' },
                        margin: { t: 20, b: 40, l: 50, r: 50 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "260px" }}
                    />
                  </div>

                  {/* CHART 3: SPOT VS OPTION PRICE STREAM */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">3. Underlying Spot Price vs Dynamic Option Trajectory</div>
                    <p className="text-xs text-slate-500 mb-3">Real-time co-movement between stock price ($S_t$) and option contract value ($V_t$).</p>
                    <Plot
                      data={[
                        { y: animatedSpot, type: 'scatter', mode: 'lines', name: 'Spot Price (S_t)', line: { color: '#10b981' } },
                        { y: animatedOption, type: 'scatter', mode: 'lines', name: 'Option Price (V_t)', yaxis: 'y2', line: { color: '#38bdf8' } }
                      ]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        yaxis: { title: 'Underlying ($)', gridcolor: '#1e293b' },
                        yaxis2: { title: 'Option Price ($)', overlaying: 'y', side: 'right', gridcolor: '#1e293b' },
                        margin: { t: 20, b: 40, l: 50, r: 50 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "280px" }}
                    />
                  </div>

                  {/* CHART 4: GREEKS TRAJECTORY STREAM */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">4. Dynamic Greeks Risk Trajectory</div>
                    <p className="text-xs text-slate-500 mb-3">Real-time risk sensitivity stream: Delta (Hedge ratio), Gamma x100, and Vega (Volatility exposure).</p>
                    <Plot
                      data={[
                        { y: animatedDelta, type: 'scatter', mode: 'lines', name: 'Delta (dV/dS)', line: { color: '#f59e0b' } },
                        { y: animatedGamma, type: 'scatter', mode: 'lines', name: 'Gamma x100 (% dΔ/dS)', line: { color: '#ec4899' } },
                        { y: animatedVega, type: 'scatter', mode: 'lines', name: 'Vega (dV/dσ)', line: { color: '#8b5cf6' } }
                      ]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        yaxis: { gridcolor: '#1e293b' }, margin: { t: 20, b: 40, l: 50, r: 50 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "260px" }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: HEDGING, PnL & 3D ANALYTICS */}
              {activeTab === 'hedging' && (
                <div className="space-y-6">
                  {/* CHART 5: 3D GAMMA RISK SURFACE */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">1. 3D Gamma Risk Surface Manifold ($S_0 \times T \rightarrow \Gamma$)</div>
                    <p className="text-xs text-slate-500 mb-3">3D interactive manifold rendering Option Gamma convexity across Spot prices and Time-to-Maturity.</p>
                    <Plot
                      data={[
                        {
                          x: fullResults.surface_3d.x_spot,
                          y: fullResults.surface_3d.y_time,
                          z: fullResults.surface_3d.z_surface,
                          type: 'surface',
                          colorscale: 'Viridis'
                        }
                      ]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        scene: {
                          xaxis: { title: 'Spot Price ($)', gridcolor: '#1e293b' },
                          yaxis: { title: 'Time T (yrs)', gridcolor: '#1e293b' },
                          zaxis: { title: 'Gamma Value', gridcolor: '#1e293b' }
                        },
                        margin: { t: 20, b: 20, l: 20, r: 20 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "400px" }}
                    />
                  </div>

                  {/* CHART 6: DELTA HEDGING PnL ACCUMULATION */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">2. Dynamic Delta-Hedging PnL Accumulation</div>
                    <p className="text-xs text-slate-500 mb-3">Cumulative Mark-to-Market PnL realized from dynamic stock rebalancing under market jump diffusions.</p>
                    <Plot
                      data={[
                        { y: animatedPnL, type: 'scatter', mode: 'lines', name: 'Hedging PnL ($)', line: { color: '#34d399' }, fill: 'tozeroy' }
                      ]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        yaxis: { title: 'PnL ($)', gridcolor: '#1e293b' }, margin: { t: 20, b: 40, l: 50, r: 50 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "250px" }}
                    />
                  </div>

                  {/* CHART 7: PnL ATTRIBUTION BREAKDOWN BAR CHART */}
                  <div className="bg-slate-900 border border-slate-800 rounded p-4">
                    <div className="text-sm font-semibold text-slate-300 mb-1">3. PnL Attribution Decomposition (Taylor Expansion)</div>
                    <p className="text-xs text-slate-500 mb-3">Decomposes overall portfolio PnL into Delta, Gamma, Theta, and Discrete Hedging Bleed.</p>
                    <Plot
                      data={[
                        {
                          x: Object.keys(fullResults.pnl_attribution),
                          y: Object.values(fullResults.pnl_attribution),
                          type: 'bar',
                          marker: { color: ['#10b981', '#ec4899', '#f59e0b', '#ef4444'] }
                        }
                      ]}
                      layout={{
                        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' },
                        yaxis: { title: 'PnL Contribution ($)', gridcolor: '#1e293b' }, margin: { t: 20, b: 40, l: 50, r: 50 }, autosize: true
                      }}
                      useResizeHandler={true} style={{ width: "100%", height: "250px" }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
              <p>Configure parameters on the left panel and click <strong className="text-emerald-400">RUN SIMULATION</strong> to render the Interactive Desk.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}