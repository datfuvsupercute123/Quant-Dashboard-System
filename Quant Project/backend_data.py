import numpy as np
import pandas as pd
import yfinance as yf
import logging
from sklearn.covariance import LedoitWolf

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

class MarketDataEngine:
    def __init__(self, ticker: str = "NVDA"):
        self.ticker_name = ticker.upper()
        self.ticker = yf.Ticker(self.ticker_name)

    def get_spot_and_volatility(self, period: str = "1y") -> dict:
        hist = self.ticker.history(period=period)
        if hist.empty:
            raise ValueError(f"Unable to fetch historical data for {self.ticker_name}")

        S0 = float(hist['Close'].iloc[-1])
        log_returns = np.log(hist['Close'] / hist['Close'].shift(1)).dropna()
        annual_vol = float(log_returns.std() * np.sqrt(252))
        v0 = float(annual_vol ** 2)

        return {
            "ticker": self.ticker_name,
            "S0": S0,
            "sigma": annual_vol,
            "v0": v0,
            "returns_series": log_returns
        }

    @staticmethod
    def get_large_basket_data(tickers: list, period: str = "1y") -> tuple:
        logging.info(f"Downloading bulk data for {len(tickers)} tickers...")
        raw_data = yf.download(tickers, period=period, progress=False, auto_adjust=True)
        
        df = raw_data['Close'] if 'Close' in raw_data else raw_data
        df = df.dropna(thresh=int(len(df) * 0.9), axis=1).ffill().bfill()
        
        returns = np.log(df / df.shift(1)).dropna()
        S0_basket = df.iloc[-1].to_dict()
        
        sample_cov = returns.cov().values * 252
        lw = LedoitWolf()
        shrunk_cov = lw.fit(returns.values).covariance_ * 252
        corr_matrix = returns.corr().values

        return S0_basket, returns, sample_cov, shrunk_cov, corr_matrix