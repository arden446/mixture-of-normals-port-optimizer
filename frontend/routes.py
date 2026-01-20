import numpy as np
from flask import Blueprint, render_template, jsonify, request

from backend import (
    Asset,
    validate_correlation_matrix,
    optimize_portfolio_grid,
    portfolio_returns,
    calculate_cvar,
    calculate_sharpe,
)

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/health')
def health():
    return jsonify({'status': 'ok'})


@bp.route('/api/validate-correlation', methods=['POST'])
def validate_correlation():
    """Validate a correlation matrix."""
    data = request.get_json()
    matrix = data.get('correlation_matrix', [])

    is_valid, message = validate_correlation_matrix(matrix)

    return jsonify({
        'valid': is_valid,
        'message': message
    })


@bp.route('/api/optimize', methods=['POST'])
def optimize():
    """Run portfolio optimization."""
    data = request.get_json()

    try:
        # Parse assets
        assets_data = data.get('assets', [])
        assets = []
        for a in assets_data:
            asset = Asset(
                name=a['name'],
                weights=a['weights'],
                means=a['means'],
                stds=a['stds']
            )
            assets.append(asset)

        correlation_matrix = data.get('correlation_matrix')
        cvar_limit = data.get('cvar_limit', -0.15)
        n_samples = min(data.get('n_samples', 5000), 20000)  # Cap at 20k

        # Parse asset bounds (list of [min, max] pairs)
        asset_bounds_raw = data.get('asset_bounds')
        asset_bounds = None
        if asset_bounds_raw:
            asset_bounds = [tuple(b) for b in asset_bounds_raw]

        # Parse step/granularity (default 0.05 = 5%)
        step = data.get('step', 0.05)
        step = max(0.005, min(0.2, step))  # Clamp to reasonable range

        # Validate correlation matrix
        is_valid, msg = validate_correlation_matrix(correlation_matrix)
        if not is_valid:
            return jsonify({'error': f'Invalid correlation matrix: {msg}'})

        # Run optimization
        np.random.seed(42)  # For reproducibility
        result = optimize_portfolio_grid(
            assets,
            correlation_matrix,
            n_samples=n_samples,
            cvar_limit=cvar_limit,
            step=step,
            asset_bounds=asset_bounds
        )

        if result['optimal_weights'] is None:
            return jsonify({
                'error': 'No feasible portfolio found. Try relaxing the CVaR limit.'
            })

        # Calculate portfolio returns for the optimal weights
        weights = np.array(result['optimal_weights'])
        port_returns = portfolio_returns(weights, result['scenarios'])

        # Convert numpy types to Python native types for JSON serialization
        optimal_weights = result['optimal_weights']
        optimal_sharpe = result['optimal_sharpe']
        optimal_cvar = result['optimal_cvar']
        
        return jsonify({
            'optimal_weights': optimal_weights.tolist() if optimal_weights is not None else None,
            'sharpe': float(optimal_sharpe) if optimal_sharpe is not None and np.isfinite(optimal_sharpe) else None,
            'cvar': float(optimal_cvar) if optimal_cvar is not None and np.isfinite(optimal_cvar) else None,
            'mean': float(port_returns.mean()),
            'std': float(port_returns.std()),
            'portfolio_returns': port_returns.tolist()
        })

    except Exception as e:
        return jsonify({'error': str(e)})