import numpy as np
import pytest


from backend import (
    Asset,
    validate_correlation_matrix,
    sample_mixture_of_normals,
    sample_correlated_assets,
    portfolio_returns,
    calculate_cvar,
    calculate_var,
    calculate_sharpe,
    optimize_portfolio_grid,
)


class TestValidation:
    def test_valid_correlation_matrix(self):
        corr = [[1.0, 0.5], [0.5, 1.0]]
        is_valid, msg = validate_correlation_matrix(corr)
        assert is_valid is True

    def test_invalid_not_psd(self):
        corr = [[1.0, 0.9, -0.9], [0.9, 1.0, 0.9], [-0.9, 0.9, 1.0]]
        is_valid, msg = validate_correlation_matrix(corr)
        assert is_valid is False
        assert "positive semi-definite" in msg

    def test_invalid_diagonal(self):
        corr = [[0.5, 0.3], [0.3, 1.0]]
        is_valid, msg = validate_correlation_matrix(corr)
        assert is_valid is False


class TestAsset:
    def test_create_asset(self):
        asset = Asset("Stock", [0.8, 0.2], [0.15, -0.20], [0.12, 0.25])
        assert asset.name == "Stock"
        assert np.isclose(asset.expected_return(), 0.08)

    def test_invalid_weights(self):
        with pytest.raises(ValueError):
            Asset("Bad", [0.5, 0.3], [0.1, 0.2], [0.1, 0.1])

    def test_to_dict_roundtrip(self):
        asset = Asset("Bond", [1.0], [0.04], [0.03])
        data = asset.to_dict()
        restored = Asset.from_dict(data)
        assert restored.name == asset.name
        assert np.allclose(restored.weights, asset.weights)


class TestSampling:
    def test_mixture_sampling_mean(self):
        np.random.seed(42)
        samples = sample_mixture_of_normals([0.5, 0.5], [-0.1, 0.2], [0.05, 0.05], 10000)
        assert np.isclose(samples.mean(), 0.05, atol=0.01)

    def test_correlated_sampling_shape(self):
        np.random.seed(42)
        stock = Asset("Stock", [0.8, 0.2], [0.15, -0.20], [0.12, 0.25])
        bond = Asset("Bond", [1.0], [0.04], [0.03])
        corr = [[1.0, -0.3], [-0.3, 1.0]]
        samples = sample_correlated_assets([stock, bond], corr, 100)
        assert samples.shape == (100, 2)


class TestRisk:
    def test_cvar_worse_than_var(self):
        np.random.seed(42)
        returns = np.random.normal(0.05, 0.15, 1000)
        cvar = calculate_cvar(returns, 0.05)
        var = calculate_var(returns, 0.05)
        assert cvar < var  # CVaR is always worse (more negative)

    def test_sharpe_positive_for_positive_returns(self):
        returns = np.array([0.05, 0.10, 0.15, 0.08, 0.12])
        sharpe = calculate_sharpe(returns)
        assert sharpe > 0


class TestOptimization:
    def test_grid_search_finds_solution(self):
        np.random.seed(42)
        stock = Asset("Stock", [0.8, 0.2], [0.15, -0.20], [0.12, 0.25])
        bond = Asset("Bond", [1.0], [0.04], [0.03])
        corr = [[1.0, -0.3], [-0.3, 1.0]]

        result = optimize_portfolio_grid(
            [stock, bond], corr,
            n_samples=500, step=0.2, cvar_limit=-0.30,
        )

        assert result['optimal_weights'] is not None
        assert len(result['optimal_weights']) == 2
        assert np.isclose(sum(result['optimal_weights']), 1.0)

    def test_grid_search_with_asset_bounds(self):
        np.random.seed(42)
        stock = Asset("Stock", [0.8, 0.2], [0.15, -0.20], [0.12, 0.25])
        bond = Asset("Bond", [1.0], [0.04], [0.03])
        corr = [[1.0, -0.3], [-0.3, 1.0]]

        # Require at least 20% stocks and at most 50% bonds
        asset_bounds = [(0.2, 1.0), (0.0, 0.5)]

        result = optimize_portfolio_grid(
            [stock, bond], corr,
            n_samples=500, step=0.1, cvar_limit=-0.30,
            asset_bounds=asset_bounds
        )

        assert result['optimal_weights'] is not None
        weights = result['optimal_weights']
        # Verify bounds are respected
        assert weights[0] >= 0.2 - 1e-9, f"Stock weight {weights[0]} should be >= 0.2"
        assert weights[1] <= 0.5 + 1e-9, f"Bond weight {weights[1]} should be <= 0.5"
        assert np.isclose(sum(weights), 1.0)

    def test_grid_search_with_minimum_weight(self):
        np.random.seed(42)
        stock = Asset("Stock", [0.8, 0.2], [0.15, -0.20], [0.12, 0.25])
        bond = Asset("Bond", [1.0], [0.04], [0.03])
        corr = [[1.0, -0.3], [-0.3, 1.0]]

        # Require minimum 30% allocation to bonds
        asset_bounds = [(0.0, 1.0), (0.3, 1.0)]

        result = optimize_portfolio_grid(
            [stock, bond], corr,
            n_samples=500, step=0.1, cvar_limit=-0.30,
            asset_bounds=asset_bounds
        )

        assert result['optimal_weights'] is not None
        weights = result['optimal_weights']
        assert weights[1] >= 0.3 - 1e-9, f"Bond weight {weights[1]} should be >= 0.3"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])