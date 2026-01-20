import numpy as np
from scipy import stats
from scipy.optimize import brentq
from tqdm import tqdm


def validate_correlation_matrix(corr_matrix):
    """
    Check if a correlation matrix is valid (positive semi-definite).

    Returns:
        (is_valid, message)
    """
    corr = np.array(corr_matrix)

    # Check square
    if corr.shape[0] != corr.shape[1]:
        return False, "Matrix must be square"

    # Check diagonal is 1s
    if not np.allclose(np.diag(corr), 1.0):
        return False, "Diagonal elements must be 1"

    # Check symmetric
    if not np.allclose(corr, corr.T):
        return False, "Matrix must be symmetric"

    # Check all values in [-1, 1]
    if np.any(np.abs(corr) > 1):
        return False, "Correlations must be in [-1, 1]"

    # Check positive semi-definite (all eigenvalues >= 0)
    eigenvalues = np.linalg.eigvalsh(corr)
    if np.any(eigenvalues < -1e-10):  # Small tolerance for numerical issues
        return False, f"Matrix is not positive semi-definite. Min eigenvalue: {eigenvalues.min():.6f}"

    return True, "Valid correlation matrix"


def sample_mixture_of_normals(weights, means, stds, n_samples):
    """
    Sample from a mixture of normal distributions.

    Args:
        weights: array of component weights (must sum to 1)
        means: array of component means
        stds: array of component standard deviations
        n_samples: number of samples to draw

    Returns:
        array of samples
    """
    weights = np.array(weights)
    means = np.array(means)
    stds = np.array(stds)

    # Choose which component each sample comes from
    components = np.random.choice(len(weights), size=n_samples, p=weights)

    # Sample from the chosen component
    samples = np.random.normal(means[components], stds[components])

    return samples


def mixture_cdf(x, weights, means, stds):
    """CDF of a mixture of normals."""
    cdf = 0.0
    for w, mu, sigma in zip(weights, means, stds):
        cdf += w * stats.norm.cdf(x, mu, sigma)
    return cdf


def mixture_ppf_vectorized(q_array, weights, means, stds, desc=None):
    """Vectorized inverse CDF for an array of quantiles."""

    overall_mean = np.sum(weights * means)
    overall_std = np.sqrt(np.sum(weights * (stds**2 + means**2)) - overall_mean**2)
    low = overall_mean - 10 * overall_std
    high = overall_mean + 10 * overall_std

    results = np.zeros_like(q_array)
    for i, q in tqdm(enumerate(q_array), total=len(q_array), desc=desc, leave=False):
        # Handle edge cases
        q = np.clip(q, 1e-10, 1 - 1e-10)
        def objective(x):
            return mixture_cdf(x, weights, means, stds) - q
        results[i] = brentq(objective, low, high)

    return results


def sample_correlated_assets(assets, corr_matrix, n_samples):
    """
    Generate correlated return samples from multiple assets.
    """
    n_assets = len(assets)
    corr = np.array(corr_matrix)

    is_valid, msg = validate_correlation_matrix(corr)
    if not is_valid:
        print(f"WARNING: {msg}")

    # Generate correlated standard normals
    L = np.linalg.cholesky(corr)
    uncorrelated_normals = np.random.standard_normal((n_samples, n_assets))
    correlated_normals = uncorrelated_normals @ L.T

    # Transform to uniform
    uniforms = stats.norm.cdf(correlated_normals)

    # Transform each column to asset's distribution
    samples = np.zeros((n_samples, n_assets))
    for i, asset in enumerate(assets):
        samples[:, i] = mixture_ppf_vectorized(
            uniforms[:, i],
            asset.weights,
            asset.means,
            asset.stds,
            desc=f"Sampling {asset.name}"
        )

    return samples