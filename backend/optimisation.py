import numpy as np
from tqdm import tqdm
from itertools import product
from .asset import Asset
from .correlation import sample_correlated_assets
from .risk import portfolio_returns, calculate_cvar, calculate_sharpe


def generate_weight_grid(n_assets, step=0.1, asset_bounds=None):
    """
    Generate all possible weight combinations that sum to 1.

    Args:
        n_assets: number of assets
        step: grid step size (e.g., 0.1 = 10% increments)
        asset_bounds: list of (min, max) tuples, one per asset

    Yields:
        tuples of weights
    """
    steps = int(1 / step) + 1
    values = [i * step for i in range(steps)]

    for combo in product(values, repeat=n_assets):
        if abs(sum(combo) - 1.0) < 1e-9:
            if asset_bounds is None or all(
                asset_bounds[i][0] <= combo[i] <= asset_bounds[i][1]
                for i in range(n_assets)
            ):
                yield combo


def optimize_portfolio_grid(assets, corr_matrix, n_samples=10000,
                           cvar_limit=-0.20, cvar_alpha=0.05, step=0.05,
                           asset_bounds=None):
    """
    Find optimal portfolio via grid search.

    Args:
        assets: list of Asset objects
        corr_matrix: correlation matrix
        n_samples: number of scenarios to generate
        cvar_limit: maximum allowed CVaR (e.g., -0.20 = can't lose more than 20% on average in worst 5%)
        cvar_alpha: CVaR confidence level
        step: grid step size for weights
        asset_bounds: list of (min, max) tuples for each asset's weight bounds

    Returns:
        dict with optimal weights, sharpe, cvar, and all results
    """
    # Generate scenarios once (SAA)
    samples = sample_correlated_assets(assets, corr_matrix, n_samples)

    n_assets = len(assets)
    best_sharpe = -np.inf
    best_weights = None
    best_cvar = None
    all_results = []

    # Pre-compute grid for tqdm total
    weight_grid = list(generate_weight_grid(n_assets, step, asset_bounds))

    for weights in tqdm(weight_grid, desc="Optimizing weights"):
        weights = np.array(weights)
        port_ret = portfolio_returns(weights, samples)

        cvar = calculate_cvar(port_ret, cvar_alpha)
        sharpe = calculate_sharpe(port_ret)

        result = {
            'weights': weights,
            'sharpe': sharpe,
            'cvar': cvar,
            'mean': port_ret.mean(),
            'std': port_ret.std(),
            'feasible': cvar >= cvar_limit
        }
        all_results.append(result)

        # Check constraint and update best
        if cvar >= cvar_limit and sharpe > best_sharpe:
            best_sharpe = sharpe
            best_weights = weights
            best_cvar = cvar

    return {
        'optimal_weights': best_weights,
        'optimal_sharpe': best_sharpe,
        'optimal_cvar': best_cvar,
        'all_results': all_results,
        'scenarios': samples
    }



from scipy.optimize import minimize

def optimize_portfolio_continuous(assets, corr_matrix, n_samples=10000,
                                  cvar_limit=-0.20, cvar_alpha=0.05,
                                  asset_bounds=None):
    """
    Find optimal portfolio via continuous optimization.

    Args:
        assets: list of Asset objects
        corr_matrix: correlation matrix
        n_samples: number of scenarios to generate
        cvar_limit: maximum allowed CVaR
        cvar_alpha: CVaR confidence level
        asset_bounds: list of (min, max) tuples for each asset's weight bounds
    """
    samples = sample_correlated_assets(assets, corr_matrix, n_samples)
    n_assets = len(assets)

    def negative_sharpe(weights):
        port_ret = portfolio_returns(weights, samples)
        return -calculate_sharpe(port_ret)

    def cvar_constraint(weights):
        port_ret = portfolio_returns(weights, samples)
        cvar = calculate_cvar(port_ret, cvar_alpha)
        return cvar - cvar_limit  # Must be >= 0

    # Constraints: weights sum to 1, CVaR >= limit
    constraints = [
        {'type': 'eq', 'fun': lambda w: np.sum(w) - 1},
        {'type': 'ineq', 'fun': cvar_constraint}
    ]

    # Bounds: each weight in [0, 1], or per-asset bounds if provided
    bounds = asset_bounds if asset_bounds else [(0, 1) for _ in range(n_assets)]

    # Initial guess: equal weight
    x0 = np.ones(n_assets) / n_assets

    result = minimize(
        negative_sharpe,
        x0,
        method='SLSQP',
        bounds=bounds,
        constraints=constraints,
        options={'ftol': 1e-8}
    )

    optimal_weights = result.x
    port_ret = portfolio_returns(optimal_weights, samples)

    return {
        'optimal_weights': optimal_weights,
        'optimal_sharpe': calculate_sharpe(port_ret),
        'optimal_cvar': calculate_cvar(port_ret, cvar_alpha),
        'scenarios': samples,
        'optimization_result': result
    }