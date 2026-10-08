import numpy as np
from schemas import DashboardSimulationRequest
from backend_pricing_engine import MultiModelPricingEngine
from pde_pricing_engine import PDEPricingEngine

class QuantDashboardEngine:

    @staticmethod
    def run_full_simulation(req: DashboardSimulationRequest) -> dict:
        c, d, s, mm = req.contract, req.dynamics, req.simulation, req.market_making

        if s.seed is not None and s.seed > 0:
            np.random.seed(s.seed)
        else:
            np.random.seed(None)

        dt = s.horizon / s.ticks
        time_grid = np.linspace(0, s.horizon, s.ticks + 1)

        # 1. PRIMARY PHYSICAL SPOT PATH
        S_path = np.zeros(s.ticks + 1)
        S_path[0] = c.S0
        
        Z = np.random.normal(size=s.ticks)
        jumps = np.random.poisson(d.jump_lambda * dt, size=s.ticks)
        jump_factors = np.random.normal(d.jump_mean, d.jump_std, size=s.ticks) * jumps

        for t in range(s.ticks):
            drift = (d.mu - 0.5 * d.sigma**2) * dt
            diffusion = d.sigma * np.sqrt(dt) * Z[t]
            S_path[t+1] = S_path[t] * np.exp(drift + diffusion + jump_factors[t])

        # 2. MONTE CARLO SAMPLE PATHS (50 HIGH-DENSITY PATHS FOR SMOOTH HISTOGRAM)
        num_sample_paths = 50
        mc_sample_paths = np.zeros((num_sample_paths, s.ticks + 1))
        mc_sample_paths[:, 0] = c.S0

        for p in range(num_sample_paths):
            Z_p = np.random.normal(size=s.ticks)
            
            if req.selected_model == "Bates":
                v_p = np.zeros(s.ticks + 1)
                v_p[0] = d.sigma ** 2
                kappa, theta, xi = 2.5, d.sigma ** 2, 0.35
                Z_v = np.random.normal(size=s.ticks)
                
                jumps_p = np.random.poisson(d.jump_lambda * dt, size=s.ticks)
                jump_factors_p = np.random.normal(d.jump_mean, d.jump_std, size=s.ticks) * jumps_p

                for t in range(s.ticks):
                    v_curr = max(v_p[t], 1e-5)
                    v_p[t+1] = max(v_curr + kappa * (theta - v_curr) * dt + xi * np.sqrt(v_curr * dt) * Z_v[t], 1e-5)
                    drift_p = (d.mu - 0.5 * v_curr) * dt
                    diff_p = np.sqrt(v_curr * dt) * Z_p[t]
                    mc_sample_paths[p, t+1] = mc_sample_paths[p, t] * np.exp(drift_p + diff_p + jump_factors_p[t])

            elif req.selected_model == "Merton":
                jumps_p = np.random.poisson(d.jump_lambda * dt, size=s.ticks)
                jump_factors_p = np.random.normal(d.jump_mean, d.jump_std, size=s.ticks) * jumps_p

                for t in range(s.ticks):
                    drift_p = (d.mu - 0.5 * d.sigma**2) * dt
                    diff_p = d.sigma * np.sqrt(dt) * Z_p[t]
                    mc_sample_paths[p, t+1] = mc_sample_paths[p, t] * np.exp(drift_p + diff_p + jump_factors_p[t])

            else:
                for t in range(s.ticks):
                    drift_p = (d.mu - 0.5 * d.sigma**2) * dt
                    diff_p = d.sigma * np.sqrt(dt) * Z_p[t]
                    mc_sample_paths[p, t+1] = mc_sample_paths[p, t] * np.exp(drift_p + diff_p)

        # Calculate Terminal Log Returns at Horizon T
        terminal_spots = mc_sample_paths[:, -1]
        terminal_returns = np.log(terminal_spots / c.S0).tolist()

        # 3. MULTI-MODEL PRICING DISPATCHER
        predicted_prices, deltas, gammas, vegas, thetas = [], [], [], [], []
        vol_used = mm.mm_vol if (mm.mm_vol is not None and mm.mm_vol > 0) else d.sigma

        for t, S_t in enumerate(S_path):
            remaining_T = max(c.T, 1e-4)

            if req.selected_model == "Bates":
                local_v0 = (vol_used * (1.0 + 0.15 * np.sin(t / 8.0))) ** 2
                res = MultiModelPricingEngine.bates_model(
                    S0=S_t, K=c.K, T=remaining_T, r=d.r, v0=local_v0,
                    kappa=2.5, theta=local_v0, xi=0.35, rho=-0.75,
                    jump_lambda=d.jump_lambda, jump_mean=d.jump_mean, jump_std=d.jump_std,
                    num_paths=500, opt_type=c.option_type
                )
                bs_greeks = MultiModelPricingEngine.black_scholes_all_greeks(S_t, c.K, remaining_T, d.r, np.sqrt(local_v0), c.option_type)
                price_val = res["price"]
                delta_val, gamma_val, vega_val, theta_val = bs_greeks["delta"] * 1.05, bs_greeks["gamma"], bs_greeks["vega"], bs_greeks["theta"]

            elif req.selected_model == "Merton":
                res = MultiModelPricingEngine.merton_jump_diffusion(
                    S0=S_t, K=c.K, T=remaining_T, r=d.r, sigma=vol_used,
                    jump_lambda=d.jump_lambda, jump_mean=d.jump_mean, jump_std=d.jump_std,
                    num_paths=500, opt_type=c.option_type
                )
                bs_greeks = MultiModelPricingEngine.black_scholes_all_greeks(S_t, c.K, remaining_T, d.r, vol_used, c.option_type)
                price_val = res["price"]
                delta_val, gamma_val, vega_val, theta_val = bs_greeks["delta"], bs_greeks["gamma"], bs_greeks["vega"], bs_greeks["theta"]

            elif req.selected_model == "Crank-Nicolson PDE":
                pde_res = PDEPricingEngine.crank_nicolson_pde(
                    S0=S_t, K=c.K, T=remaining_T, r=d.r, sigma=vol_used,
                    option_style="American", exotic_type="Vanilla", M=40, N=80
                )
                bs_greeks = MultiModelPricingEngine.black_scholes_all_greeks(S_t, c.K, remaining_T, d.r, vol_used, c.option_type)
                price_val = pde_res["price"]
                delta_val = min(1.0, bs_greeks["delta"] * 1.10)
                gamma_val, vega_val, theta_val = bs_greeks["gamma"], bs_greeks["vega"], bs_greeks["theta"]

            else: # Black-Scholes Baseline
                bs_res = MultiModelPricingEngine.black_scholes_all_greeks(S_t, c.K, remaining_T, d.r, vol_used, c.option_type)
                price_val = bs_res["price"]
                delta_val, gamma_val, vega_val, theta_val = bs_res["delta"], bs_res["gamma"], bs_res["vega"], bs_res["theta"]

            predicted_prices.append(float(price_val))
            deltas.append(float(delta_val))
            gammas.append(float(gamma_val))
            vegas.append(float(vega_val))
            thetas.append(float(theta_val))

        # 4. DELTA-HEDGING PnL ACCUMULATION
        hedge_step = max(1, s.ticks // s.hedge_rebalances)
        portfolio_pnl = np.zeros(s.ticks + 1)
        
        v0 = predicted_prices[0]
        delta0 = deltas[0]
        cash = v0 - delta0 * S_path[0]
        shares = delta0

        for t in range(1, s.ticks + 1):
            cash *= np.exp(d.r * dt)
            if t % hedge_step == 0 or t == s.ticks:
                current_delta = deltas[min(t, s.ticks - 1)]
                cash -= (current_delta - shares) * S_path[t]
                shares = current_delta

            vt = predicted_prices[min(t, s.ticks - 1)]
            portfolio_pnl[t] = (cash + shares * S_path[t]) - vt

        gammas_scaled = [g * 100.0 for g in gammas]

        surface_3d = MultiModelPricingEngine.generate_3d_greek_surface(
            S0=c.S0, K=c.K, r=d.r, sigma=vol_used, selected_model=req.selected_model, greek_name="gamma", resolution=25
        )

        dS_total = S_path[-1] - S_path[0]
        pnl_delta = deltas[0] * dS_total
        pnl_gamma = 0.5 * gammas[0] * (dS_total ** 2)
        pnl_theta = thetas[0] * (s.horizon * 365.0)

        return {
            "time_grid": time_grid.tolist(),
            "underlying_price_path": S_path.tolist(),
            "mc_sample_paths": mc_sample_paths.tolist(),
            "terminal_returns": terminal_returns,
            "predicted_option_price_path": predicted_prices,
            "greeks_trajectory": {"delta": deltas, "gamma": gammas_scaled, "vega": vegas, "theta": thetas},
            "pnl_hedging_path": portfolio_pnl.tolist(),
            "market_maker_quotes": {
                "bid": (np.array(predicted_prices) - mm.half_spread).tolist(),
                "ask": (np.array(predicted_prices) + mm.half_spread).tolist()
            },
            "pnl_attribution": {
                "Delta PnL": round(pnl_delta, 2),
                "Gamma PnL": round(pnl_gamma, 2),
                "Theta PnL": round(pnl_theta, 2),
                "Hedging Bleed": round(portfolio_pnl[-1] - (pnl_delta + pnl_gamma + pnl_theta), 2)
            },
            "surface_3d": surface_3d,
            "analytics_summary": {
                "final_underlying_price": round(S_path[-1], 2),
                "final_option_price": round(predicted_prices[-1], 4),
                "total_hedging_pnl": round(portfolio_pnl[-1], 4),
                "max_drawdown_pnl": round(float(np.min(portfolio_pnl)), 4)
            }
        }