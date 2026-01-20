import numpy as np


def portfolio_returns(weights, asset_returns):
    """
    Calculate portfolio returns for each scenario.

    Args:
        weights: array of portfolio weights (must sum to 1)
        asset_returns: 2D array of shape (n_samples, n_assets)

    Returns:
        1D array of portfolio returns (n_samples,)
    """
    weights = np.array(weights)
    return asset_returns @ weights


def calculate_cvar(returns, alpha=0.05):
    """
    Calculate CVaR (Conditional Value at Risk) at level alpha.

    CVaR is the average return in the worst alpha fraction of scenarios.

    Args:
        returns: array of return scenarios
        alpha: tail probability (default 0.05 = worst 5%)

    Returns:
        CVaR value (will be negative for losses)
    """
    cutoff_index = int(len(returns) * alpha)
    sorted_returns = np.sort(returns)
    tail_returns = sorted_returns[:cutoff_index]
    return tail_returns.mean()


def calculate_var(returns, alpha=0.05):
    """
    Calculate VaR (Value at Risk) at level alpha.
    VaR is the return at the alpha percentile.
    """
    return np.percentile(returns, alpha * 100)


def calculate_sharpe(returns, risk_free_rate=0.0):
    """
    Calculate Sharpe ratio.

    Args:
        returns: array of return scenarios
        risk_free_rate: risk-free rate (default 0)

    Returns:
        Sharpe ratio
    """
    excess_returns = returns - risk_free_rate
    return excess_returns.mean() / excess_returns.std()