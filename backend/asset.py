import numpy as np
from .correlation import sample_mixture_of_normals


class Asset:
    """An asset with returns modeled as a mixture of normals."""

    def __init__(self, name, weights, means, stds):
        """
        Args:
            name: identifier for this asset
            weights: mixture component weights (must sum to 1)
            means: mixture component means (as decimals, e.g., 0.10 for 10%)
            stds: mixture component standard deviations
        """
        self.name = name
        self.weights = np.array(weights)
        self.means = np.array(means)
        self.stds = np.array(stds)

        # Validate weights sum to 1
        if not np.isclose(self.weights.sum(), 1.0):
            raise ValueError(f"Weights must sum to 1, got {self.weights.sum()}")

    def sample(self, n_samples):
        """Generate return samples for this asset."""
        return sample_mixture_of_normals(self.weights, self.means, self.stds, n_samples)

    def expected_return(self):
        """Analytical expected return."""
        return np.sum(self.weights * self.means)

    def __repr__(self):
        return f"Asset({self.name}, E[r]={self.expected_return():.2%})"

    def to_dict(self):
        """Convert to dictionary for JSON serialization."""
        return {
            'name': self.name,
            'weights': self.weights.tolist(),
            'means': self.means.tolist(),
            'stds': self.stds.tolist(),
            'expected_return': self.expected_return()
        }

    @classmethod
    def from_dict(cls, data):
        """Create Asset from dictionary."""
        return cls(
            name=data['name'],
            weights=data['weights'],
            means=data['means'],
            stds=data['stds']
        )