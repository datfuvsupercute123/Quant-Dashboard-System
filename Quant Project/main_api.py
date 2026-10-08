from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas import DashboardSimulationRequest
from dashboard_quant_backend import QuantDashboardEngine
from pde_pricing_engine import PDEPricingEngine
from pnl_attribution_engine import PnLAttributionEngine

app = FastAPI(
    title="Institutional Quant Volatility Desk API",
    version="3.0.0",
    description="Backend Engine supporting Option Pricing, PDE Exotics, Vol Surface & PnL Attribution"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "Quant Volatility Desk Backend Online", "version": "3.0.0"}

@app.post("/api/v1/simulate-dashboard")
def simulate_dashboard(req: DashboardSimulationRequest):
    try:
        results = QuantDashboardEngine.run_full_simulation(req)
        return {"status": "success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/pde-exotic-pricing")
def price_exotic_pde(S0: float = 100.0, K: float = 100.0, T: float = 0.25, r: float = 0.02, sigma: float = 0.2,
                     style: str = "European", exotic: str = "Vanilla", barrier: float = 120.0):
    res = PDEPricingEngine.crank_nicolson_pde(
        S0, K, T, r, sigma, option_style=style, exotic_type=exotic, barrier_level=barrier
    )
    return {"status": "success", "data": res}

@app.post("/api/v1/pnl-attribution")
def calculate_pnl_attribution(dS: float, dVol: float, dt: float, delta: float, gamma: float, vega: float, theta: float, vanna: float = 0.0, volga: float = 0.0):
    greeks = {"delta": delta, "gamma": gamma, "vega": vega, "theta": theta, "vanna": vanna, "volga": volga}
    res = PnLAttributionEngine.decompose_pnl(dS, dVol, dt, greeks)
    return {"status": "success", "data": res}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)