from pydantic import BaseModel, Field
from typing import Optional

class ContractConfig(BaseModel):
    S0: float = Field(100.0, description="Spot price S0")
    K: float = Field(100.0, description="Strike price K")
    T: float = Field(0.25, description="Rolling maturity T in years")
    option_type: str = Field("Call", description="Call or Put")

class TrueDynamicsConfig(BaseModel):
    mu: float = Field(0.05, description="Drift mu")
    sigma: float = Field(0.2, description="Vol sigma")
    r: float = Field(0.02, description="Risk-free rate r")
    jump_lambda: float = Field(1.0, description="Jump lambda/yr")
    jump_mean: float = Field(-0.05, description="Jump mean return")
    jump_std: float = Field(0.1, description="Jump std deviation")

class MarketMakingConfig(BaseModel):
    half_spread: float = Field(0.15, description="Half-spread")
    quote_size: int = Field(1, description="Quote size")
    fill_intensity: float = Field(0.35, description="Fill intensity")
    risk_aversion: float = Field(0.02, description="Risk aversion")
    mm_vol: Optional[float] = Field(None, description="Custom MM vol")

class SimulationConfig(BaseModel):
    horizon: float = Field(1.0, description="Horizon in years")
    ticks: int = Field(250, description="Ticks count")
    hedge_rebalances: int = Field(30, description="Hedge rebalances")
    seed: Optional[int] = Field(42, description="Random seed")

class DashboardSimulationRequest(BaseModel):
    selected_model: str = Field("Bates", description="Black-Scholes, Merton, Bates, Crank-Nicolson PDE")
    contract: ContractConfig
    dynamics: TrueDynamicsConfig
    market_making: MarketMakingConfig
    simulation: SimulationConfig