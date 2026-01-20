# Macroscopic

A portfolio optimization tool for assets with non-standard return distributions. Runs locally with a web interface.

## Features

- **Mixture-of-Normals Distributions**: Model each asset's returns as a weighted combination of normal distributions
- **Correlation via Gaussian Copula**: Specify pairwise correlations between assets
- **CVaR-Constrained Optimization**: Maximize Sharpe ratio subject to Conditional Value at Risk limits
- **Sample Average Approximation**: Generate fixed return scenarios once, then optimize against that set, and validated against overfitting

## Quick Start

```bash
# Clone and setup
git clone https://github.com/tmychow/macroscopic.git
cd macroscopic
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

Open http://localhost:5001 in your browser.

## Project Structure

```
macroscopic/
├── backend/
│   ├── asset.py          # Asset class with mixture-of-normals
│   ├── correlation.py    # Correlation validation, copula sampling
│   ├── risk.py           # Sharpe, CVaR, VaR calculations
│   └── optimisation.py   # Grid search and continuous optimization
├── frontend/
│   ├── routes.py         # Flask API endpoints
│   ├── templates/        # HTML templates
│   └── static/           # CSS and JavaScript
├── tests/
│   └── test_backend.py   # pytest test suite
├── run.py                # Flask entry point
└── requirements.txt
```

## Running Tests

```bash
python -m pytest tests/ -v
```

## TODOs

### Bugs
- [ ] Fix `calculate_cvar` to handle edge case when `cutoff_index` is 0 (currently takes mean of empty array → `nan`)
- [ ] Fix `calculate_sharpe` to handle divide-by-zero / zero-variance returns (avoid `inf`/`nan`)
- [ ] Harden `validate_correlation_matrix` to reject empty / non-2D / non-numeric inputs (avoid crashes on malformed API requests)
- [ ] Correlation edge case: reject non-positive-definite correlation matrices (PSD-but-not-PD can pass validation but fail Cholesky)
- [ ] Frontend: handle `null`/non-finite metrics from backend (avoid `.toFixed()` crashing when Sharpe/CVaR is missing)
- [ ] Frontend: make asset mixture weight-sum validation stricter to match backend `Asset` validation (avoid “UI passes but backend rejects”)

### Features
- [ ] Allow configurable CVaR alpha (currently hardcoded to 5%), and many CVaRs
- [ ] Add overfitting detection to UI (cross-validation exists in old `portfolio.py` but not used or exposed)
- [ ] Let user describe distribution qualitatively and back out mixture-of-normals parameters
- [ ] Save/load asset configurations to JSON files
- [ ] Performance: speed up mixture sampling by caching a quantile grid for the mixture PPF and interpolating (avoid per-sample root-finding)
- [ ] Optimization UX: auto-switch from grid search to continuous optimization when grid size explodes (many assets / small step)
- [ ] Add a benchmark-style test to measure runtime vs #assets / grid step / #samples to guide sensible auto-switch thresholds
- [ ] Allow specifying granularity of grid size, and picking between grid search and continuous optimization