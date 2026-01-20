import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
from tqdm import tqdm 


# Set seed for reproducibility during development
np.random.seed(42)




from itertools import product


def detect_overfitting(assets, corr_matrix, n_samples=10000, n_folds=5,
                       cvar_limit=-0.20, step=0.10):
    """
    Detect overfitting via cross-validation.

    Splits scenarios into folds, optimizes on each training set,
    and evaluates on the held-out test set.

    Returns:
        dict with in-sample and out-of-sample performance
    """
    # Generate all scenarios
    all_samples = sample_correlated_assets(assets, corr_matrix, n_samples)
    n_assets = len(assets)

    fold_size = n_samples // n_folds
    results = []

    for fold in range(n_folds):
        # Split into train/test
        test_start = fold * fold_size
        test_end = test_start + fold_size

        test_mask = np.zeros(n_samples, dtype=bool)
        test_mask[test_start:test_end] = True

        train_samples = all_samples[~test_mask]
        test_samples = all_samples[test_mask]

        # Find best weights on training set
        best_sharpe = -np.inf
        best_weights = None

        for weights in generate_weight_grid(n_assets, step):
            weights = np.array(weights)
            port_ret = portfolio_returns(weights, train_samples)
            cvar = calculate_cvar(port_ret)

            if cvar >= cvar_limit:
                sharpe = calculate_sharpe(port_ret)
                if sharpe > best_sharpe:
                    best_sharpe = sharpe
                    best_weights = weights

        if best_weights is None:
            continue

        # Evaluate on test set
        train_ret = portfolio_returns(best_weights, train_samples)
        test_ret = portfolio_returns(best_weights, test_samples)

        results.append({
            'fold': fold,
            'weights': best_weights,
            'train_sharpe': calculate_sharpe(train_ret),
            'test_sharpe': calculate_sharpe(test_ret),
            'train_cvar': calculate_cvar(train_ret),
            'test_cvar': calculate_cvar(test_ret)
        })

    # Summarize
    train_sharpes = [r['train_sharpe'] for r in results]
    test_sharpes = [r['test_sharpe'] for r in results]

    return {
        'fold_results': results,
        'mean_train_sharpe': np.mean(train_sharpes),
        'mean_test_sharpe': np.mean(test_sharpes),
        'sharpe_degradation': np.mean(train_sharpes) - np.mean(test_sharpes),
        'weight_stability': np.std([r['weights'] for r in results], axis=0)
    }


def main():
    stock = Asset("Stock", weights=[0.8, 0.2], means=[0.15, -0.20], stds=[0.12, 0.25])
    bond = Asset("Bond", weights=[1.0], means=[0.04], stds=[0.03])
    assets = [stock, bond]
    corr_matrix = [[1.0, -0.3], [-0.3, 1.0]]

    print("=== Overfitting Detection ===")
    oof = detect_overfitting(assets, corr_matrix, n_samples=10000, n_folds=5, cvar_limit=-0.15)

    print(f"\nCross-validation results:")
    print(f"Mean train Sharpe: {oof['mean_train_sharpe']:.4f}")
    print(f"Mean test Sharpe:  {oof['mean_test_sharpe']:.4f}")
    print(f"Degradation:       {oof['sharpe_degradation']:.4f}")

    print(f"\nWeight stability (std across folds):")
    for asset, std in zip(assets, oof['weight_stability']):
        print(f"  {asset.name}: {std:.2%}")

    if oof['sharpe_degradation'] > 0.1:
        print("\n⚠️  WARNING: Significant overfitting detected!")
    else:
        print("\n✓ Overfitting appears minimal")

if __name__ == "__main__":
    main()