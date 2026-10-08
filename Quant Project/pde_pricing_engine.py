import numpy as np
import time

class PDEPricingEngine:

    @staticmethod
    def crank_nicolson_pde(S0: float, K: float, T: float, r: float, sigma: float,
                           option_style: str = "European", exotic_type: str = "Vanilla",
                           barrier_level: float = None, M: int = 100, N: int = 1000) -> dict:
        t_start = time.perf_counter()

        S_max = 3.0 * S0
        dS = S_max / M
        dt = T / N

        S_grid = np.linspace(0, S_max, M + 1)
        i_grid = np.arange(M + 1)

        if exotic_type == "Digital":
            V = np.where(S_grid >= K, 1.0, 0.0)
        else:
            V = np.maximum(S_grid - K, 0.0)

        alpha = 0.25 * dt * (sigma**2 * (i_grid**2) - r * i_grid)
        beta  = -0.50 * dt * (sigma**2 * (i_grid**2) + r)
        gamma = 0.25 * dt * (sigma**2 * (i_grid**2) + r * i_grid)

        A = np.zeros((M + 1, M + 1))
        B = np.zeros((M + 1, M + 1))

        for i in range(1, M):
            A[i, i-1], A[i, i], A[i, i+1] = -alpha[i], 1.0 - beta[i], -gamma[i]
            B[i, i-1], B[i, i], B[i, i+1] = alpha[i], 1.0 + beta[i], gamma[i]

        A[0, 0], A[M, M] = 1.0, 1.0
        B[0, 0], B[M, M] = 1.0, 1.0

        A_inv = np.linalg.inv(A)

        for n in range(N, 0, -1):
            V = A_inv @ (B @ V)

            if exotic_type == "Knock-Out Barrier" and barrier_level is not None:
                V[S_grid >= barrier_level] = 0.0

            if option_style == "American":
                V = np.maximum(V, np.maximum(S_grid - K, 0.0))

        idx = int(S0 / dS)
        price = V[idx] + (V[idx+1] - V[idx]) * (S0 - S_grid[idx]) / dS
        latency_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "model_name": f"Crank-Nicolson PDE ({option_style} {exotic_type})",
            "price": float(price),
            "latency_ms": round(latency_ms, 4)
        }