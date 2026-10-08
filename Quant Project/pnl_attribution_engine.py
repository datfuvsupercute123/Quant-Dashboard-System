class PnLAttributionEngine:

    @staticmethod
    def decompose_pnl(dS: float, dVol: float, dt: float, greeks: dict) -> dict:
        delta_pnl = greeks['delta'] * dS
        gamma_pnl = 0.5 * greeks['gamma'] * (dS ** 2)
        vega_pnl  = greeks['vega'] * (dVol * 100.0)
        theta_pnl = greeks['theta'] * (dt * 365.0)
        
        vanna_pnl = greeks.get('vanna', 0.0) * dS * dVol
        volga_pnl = 0.5 * greeks.get('volga', 0.0) * (dVol ** 2)

        explained_pnl = delta_pnl + gamma_pnl + vega_pnl + theta_pnl + vanna_pnl + volga_pnl

        return {
            "delta_pnl": round(float(delta_pnl), 4),
            "gamma_pnl": round(float(gamma_pnl), 4),
            "vega_pnl": round(float(vega_pnl), 4),
            "theta_pnl": round(float(theta_pnl), 4),
            "vanna_pnl": round(float(vanna_pnl), 4),
            "volga_pnl": round(float(volga_pnl), 4),
            "total_explained_pnl": round(float(explained_pnl), 4)
        }