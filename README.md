# Quantitative Option Pricing & Risk Analytics Dashboard

A comprehensive quantitative finance platform designed for advanced option pricing, risk analysis (Greeks), and volatility surface simulation. The system leverages a modern decoupled architecture, combining a high-performance mathematical computation backend with an interactive frontend interface.

---

## Key Features

* **Multi-Model Pricing Engines**: Implements standard and advanced financial models, including Black-Scholes, Merton Jump-Diffusion, Heston, and Bates models (`backend_pricing_engine.py`).
* **PDE-Based Valuation**: Integrates numerical methods and finite difference schemes to solve partial differential equations for derivative pricing (`pde_pricing_engine.py`).
* **Volatility Surface Modeling**: Computes and constructs 3D implied volatility surfaces using spatial interpolation techniques (`volatility_surface_engine.py`).
* **PnL Attribution & Risk Analytics**: Isolates and attributes Profit & Loss to specific market risk factors, alongside comprehensive calculations of financial Greeks (`pnl_attribution_engine.py`).
* **Interactive Dashboard**: Provides a real-time, responsive UI for parameter configuration, 3D data visualization, and instantaneous pricing feedback.

---

## Tech Stack

### Backend
* **Language**: Python
* **Framework**: FastAPI 
* **Core Libraries**: NumPy, SciPy

### Frontend
* **Framework**: Next.js (React)
* **Environment**: Node.js
* **Styling**: Tailwind CSS

---

## Project Structure

```text
Quant-Dashboard-System/
├── backend/                        # Quantitative logic and API server
│   ├── main_api.py                 # API entry point and routing
│   ├── schemas.py                  # Pydantic data validation models
│   ├── backend_pricing_engine.py   # Core stochastic pricing models
│   ├── pde_pricing_engine.py       # Numerical PDE solvers
│   ├── pnl_attribution_engine.py   # PnL breakdown and Greeks calculation
│   ├── volatility_surface_engine.py# Volatility surface generation
│   └── requirements.txt            # Python dependencies
├── frontend/                       # Next.js web application
│   ├── app/                        # Application routing and UI components
│   ├── public/                     # Static assets
│   ├── package.json                # Node dependencies
│   └── next.config.js              # Next.js configuration
└── .gitignore                      # Git exclusion rules
```

---

## Getting Started

### 1. Initializing the Backend
Open a terminal in the `backend` directory, set up the virtual environment, and launch the API server:

```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment (Windows)
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main_api:app --reload
```

### 2. Initializing the Frontend
Open a separate terminal in the `frontend` directory and start the development server:

```bash
# Navigate to the frontend directory
cd frontend

# Install Node dependencies
npm install

# Start the Next.js development server
npm run dev
```

Navigate to `http://localhost:3000` in your browser to access the dashboard.

---

## Author
**Nguyen Trong Dat**  
*Applied Mathematics*  
*Fulbright University Vietnam*
