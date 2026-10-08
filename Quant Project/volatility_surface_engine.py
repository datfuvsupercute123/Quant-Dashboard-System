import numpy as np
import scipy.optimize as sco

class VolatilitySurfaceEngine:

    @staticmethod
    def svi_implied_variance(k: np.ndarray, a: float, b: float, rho: float, m: float, sigma: float) -> np.ndarray:
        return a + b * (rho * (k - m) + np.sqrt((k - m)**2 + sigma**2))

    @classmethod
    def calibrate_svi_surface(cls, log_moneyness: np.ndarray, total_variance: np.ndarray) -> dict:
        init_params = [0.04, 0.1, -0.2, 0.0, 0.1]
        bounds = [(-0.5, 0.5), (1e-5, 2.0), (-0.99, 0.99), (-1.0, 1.0), (1e-5, 1.0)]

        def loss_func(params):
            pred_w = cls.svi_implied_variance(log_moneyness, *params)
            return np.sum((pred_w - total_variance) ** 2)

        res = sco.minimize(loss_func, init_params, bounds=bounds, method='L-BFGS-B')
        a, b, rho, m, sigma = res.x

        return {
            "params": {"a": float(a), "b": float(b), "rho": float(rho), "m": float(m), "sigma": float(sigma)},
            "rmse": float(np.sqrt(res.fun / len(log_moneyness)))
        }

    @staticmethod
    def validate_no_arbitrage(k_grid: np.ndarray, svi_w: np.ndarray) -> dict:
        dk = k_grid[1] - k_grid[0]
        dw_dk = np.gradient(svi_w, dk)
        d2w_dk2 = np.gradient(dw_dk, dk)

        g_k = (1.0 - k_grid * dw_dk / (2.0 * svi_w))**2 - (dw_dk**2) / 4.0 * (1.0 / svi_w + 0.25) + 0.5 * d2w_dk2
        has_butterfly_arbitrage = np.any(g_k < 0.0)

        return {
            "is_arbitrage_free": bool(not has_butterfly_arbitrage),
            "butterfly_violations_count": int(np.sum(g_k < 0.0)),
            "density_g_k": g_k.tolist()
        }