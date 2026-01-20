// Portfolio Optimizer Frontend

// State
let assets = [];
let assetCharts = {};
let currentAbortController = null;
let optimizationStartTime = null;

// Fun sci-fi asset names from classic authors
const sciFiAssetNames = [
    // Hitchhiker's Guide to the Galaxy (Douglas Adams)
    "Sirius Cybernetics Corp",
    "Megadodo Publications",
    "Magrathea Planetary Engineering",
    "Infinite Improbability Ltd",
    "Nutri-Matic Beverages",
    "Milliways Restaurant Group",
    "Pan Galactic Gargle Co",
    "Ursa Minor Publishing",
    "Sqornshellous Mattresses",
    "Dentrassi Catering Ltd",
    // Heinlein
    "Lunar Authority",
    "Holmes Industries",
    "Harriman Enterprises",
    "Luna City Holdings",
    "Martian Terraforming Co",
    "Church of All Worlds",
    "Long Range Foundation",
    "Secundus Trading Corp",
    "TANSTAAFL Mining Ltd",
    "Starship Troopers Inc",
    // Asimov / Foundation
    "Trantor Imperial Bank",
    "Foundation Trading Co",
    "Terminus Exports Ltd",
    "Encyclopedia Galactica",
    "Spacer Robotics Inc",
    "Aurora Dynamics",
    "Solaria Estates",
    "Seldon Industries",
    "Mule Enterprises",
    "Second Foundation Trust",
    // Philip K. Dick
    "Rosen Association",
    "Tyrell Corporation",
    "Penfield Mood Organs",
    "Yoyodyne Propulsion",
    "Ubik Incorporated",
    "Perky Pat Layouts",
    // Vonnegut
    "Ilium Works Inc",
    "Ice-Nine Holdings",
    "Tralfamadore Tours",
    "Kilgore Trout Publishing",
    // Dune (Frank Herbert)
    "CHOAM",
    "Spacing Guild",
    "House Atreides Ltd",
    "Arrakis Spice Export",
    "Bene Gesserit Holdings",
    "Ixian Technologies",
    // Other classics
    "Weyland-Yutani",
    "Soylent Industries",
    "Rekall Incorporated",
    "Omni Consumer Products",
    "Cyberdyne Systems",
    "Tycho Manufacturing",
    "Ceres Station Mining",
    "Belter Prospecting Co"
];
let usedAssetNames = [];

// DOM Elements
const assetsList = document.getElementById('assets-list');
const addAssetBtn = document.getElementById('add-asset-btn');
const correlationSection = document.getElementById('correlation-section');
const correlationGrid = document.getElementById('correlation-grid');
const correlationError = document.getElementById('correlation-error');
const paramsSection = document.getElementById('params-section');
const resultsSection = document.getElementById('results-section');
const optimizeBtn = document.getElementById('optimize-btn');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    addAssetBtn.addEventListener('click', () => addAsset());
    optimizeBtn.addEventListener('click', runOptimization);
    document.getElementById('cancel-btn').addEventListener('click', cancelOptimization);

    // Add two default assets
    addAsset('US Stocks', [
        { weight: 0.8, mean: 0.12, std: 0.15 },
        { weight: 0.2, mean: -0.25, std: 0.30 }
    ]);
    addAsset('Bonds', [
        { weight: 1.0, mean: 0.04, std: 0.05 }
    ]);
});

function getNextSciFiName() {
    // Find names not yet used
    const available = sciFiAssetNames.filter(n => !usedAssetNames.includes(n));
    if (available.length === 0) {
        // All used, reset and start over with a suffix
        const suffix = Math.floor(usedAssetNames.length / sciFiAssetNames.length) + 1;
        return sciFiAssetNames[Math.floor(Math.random() * sciFiAssetNames.length)] + ` ${suffix}`;
    }
    const name = available[Math.floor(Math.random() * available.length)];
    usedAssetNames.push(name);
    return name;
}

function addAsset(name = '', components = null) {
    const assetId = Date.now();
    const defaultName = name || getNextSciFiName();
    const defaultComponents = components || [
        { weight: 1.0, mean: 0.05, std: 0.10 }
    ];

    const asset = {
        id: assetId,
        name: defaultName,
        minWeight: 0.0,
        maxWeight: 1.0,
        components: defaultComponents
    };

    assets.push(asset);
    renderAsset(asset);
    updateSections();
}

function renderAsset(asset) {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.id = `asset-${asset.id}`;

    card.innerHTML = `
        <div class="asset-header">
            <input type="text" class="asset-name" value="${asset.name}"
                   onchange="updateAssetName(${asset.id}, this.value)">
            <button class="btn btn-danger" onclick="removeAsset(${asset.id})">Remove</button>
        </div>
        <div class="weight-bounds">
            <label>Min Weight:</label>
            <input type="number" value="${(asset.minWeight * 100).toFixed(0)}" step="5" min="0" max="100"
                   onchange="updateAssetBounds(${asset.id}, 'minWeight', this.value)">
            <span>%</span>
            <label>Max Weight:</label>
            <input type="number" value="${(asset.maxWeight * 100).toFixed(0)}" step="5" min="0" max="100"
                   onchange="updateAssetBounds(${asset.id}, 'maxWeight', this.value)">
            <span>%</span>
        </div>
        <div class="components" id="components-${asset.id}">
            ${asset.components.map((c, i) => renderComponent(asset.id, i, c)).join('')}
        </div>
        <button class="add-component-btn" onclick="addComponent(${asset.id})">+ Add Component</button>
        <div class="distribution-preview">
            <canvas id="chart-${asset.id}"></canvas>
        </div>
    `;

    assetsList.appendChild(card);
    updateAssetChart(asset.id);
}

function renderComponent(assetId, index, component) {
    return `
        <div class="component-row" id="component-${assetId}-${index}">
            <label>Weight:</label>
            <input type="number" value="${component.weight}" step="0.1" min="0" max="1"
                   onchange="updateComponent(${assetId}, ${index}, 'weight', this.value)">
            <label>Mean:</label>
            <input type="number" value="${component.mean}" step="0.01"
                   onchange="updateComponent(${assetId}, ${index}, 'mean', this.value)">
            <label>Std:</label>
            <input type="number" value="${component.std}" step="0.01" min="0.001"
                   onchange="updateComponent(${assetId}, ${index}, 'std', this.value)">
            ${index > 0 ? `<button class="btn btn-danger" onclick="removeComponent(${assetId}, ${index})">X</button>` : ''}
        </div>
    `;
}

function updateAssetName(assetId, name) {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
        asset.name = name;
        updateCorrelationGrid();
    }
}

function updateAssetBounds(assetId, field, value) {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
        // Convert from percentage to decimal
        const decimalValue = parseFloat(value) / 100;
        asset[field] = Math.max(0, Math.min(1, decimalValue));

        // Validate that min <= max
        if (asset.minWeight > asset.maxWeight) {
            if (field === 'minWeight') {
                asset.maxWeight = asset.minWeight;
            } else {
                asset.minWeight = asset.maxWeight;
            }
            // Re-render to update the inputs
            const card = document.getElementById(`asset-${assetId}`);
            const minInput = card.querySelector('input[onchange*="minWeight"]');
            const maxInput = card.querySelector('input[onchange*="maxWeight"]');
            minInput.value = (asset.minWeight * 100).toFixed(0);
            maxInput.value = (asset.maxWeight * 100).toFixed(0);
        }

        // Update estimate since bounds affect grid size
        updateEstimate();
    }
}

function updateComponent(assetId, index, field, value) {
    const asset = assets.find(a => a.id === assetId);
    if (asset && asset.components[index]) {
        asset.components[index][field] = parseFloat(value);
        normalizeWeights(asset);
        updateAssetChart(assetId);
    }
}

function normalizeWeights(asset) {
    const total = asset.components.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(total - 1.0) > 0.01) {
        // Show warning but don't auto-normalize
        console.warn(`Asset ${asset.name}: weights sum to ${total}, should be 1.0`);
    }
}

function addComponent(assetId) {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
        asset.components.push({ weight: 0.0, mean: 0.0, std: 0.10 });
        rerenderAssetComponents(asset);
    }
}

function removeComponent(assetId, index) {
    const asset = assets.find(a => a.id === assetId);
    if (asset && asset.components.length > 1) {
        asset.components.splice(index, 1);
        rerenderAssetComponents(asset);
    }
}

function rerenderAssetComponents(asset) {
    const container = document.getElementById(`components-${asset.id}`);
    container.innerHTML = asset.components.map((c, i) => renderComponent(asset.id, i, c)).join('');
    updateAssetChart(asset.id);
}

function removeAsset(assetId) {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
        // Free up the name for reuse
        usedAssetNames = usedAssetNames.filter(n => n !== asset.name);
    }
    assets = assets.filter(a => a.id !== assetId);
    const card = document.getElementById(`asset-${assetId}`);
    if (card) card.remove();
    if (assetCharts[assetId]) {
        assetCharts[assetId].destroy();
        delete assetCharts[assetId];
    }
    updateSections();
}

function updateAssetChart(assetId) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;

    const canvas = document.getElementById(`chart-${assetId}`);
    if (!canvas) return;

    // Generate samples for preview
    const samples = sampleMixture(asset.components, 5000);
    const histogram = createHistogram(samples, 50);

    if (assetCharts[assetId]) {
        assetCharts[assetId].destroy();
    }

    assetCharts[assetId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: histogram.labels,
            datasets: [{
                data: histogram.counts,
                backgroundColor: 'rgba(52, 152, 219, 0.6)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: `Return Distribution (E[r] = ${(expectedReturn(asset.components) * 100).toFixed(1)}%)`
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Return' },
                    ticks: {
                        callback: function(val, index) {
                            return index % 5 === 0 ? this.getLabelForValue(val) : '';
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'Frequency' }
                }
            }
        }
    });
}

function sampleMixture(components, n) {
    const samples = [];
    const weights = components.map(c => c.weight);
    const total = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / total);

    for (let i = 0; i < n; i++) {
        // Choose component
        let r = Math.random();
        let componentIndex = 0;
        for (let j = 0; j < normalizedWeights.length; j++) {
            r -= normalizedWeights[j];
            if (r <= 0) {
                componentIndex = j;
                break;
            }
        }

        // Sample from normal
        const component = components[componentIndex];
        const sample = normalRandom(component.mean, component.std);
        samples.push(sample);
    }

    return samples;
}

function normalRandom(mean, std) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
}

function expectedReturn(components) {
    const weights = components.map(c => c.weight);
    const total = weights.reduce((a, b) => a + b, 0);
    return components.reduce((sum, c) => sum + (c.weight / total) * c.mean, 0);
}

function createHistogram(samples, bins) {
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const binWidth = (max - min) / bins;

    const counts = new Array(bins).fill(0);
    const labels = [];

    for (let i = 0; i < bins; i++) {
        const binStart = min + i * binWidth;
        labels.push((binStart * 100).toFixed(0) + '%');
    }

    for (const sample of samples) {
        const binIndex = Math.min(Math.floor((sample - min) / binWidth), bins - 1);
        counts[binIndex]++;
    }

    return { labels, counts };
}

function updateSections() {
    // Show correlation section if we have at least 2 assets
    if (assets.length >= 2) {
        correlationSection.style.display = 'block';
        paramsSection.style.display = 'block';
        updateCorrelationGrid();
        updateEstimate();
    } else {
        correlationSection.style.display = 'none';
        paramsSection.style.display = 'none';
    }
}

function calculateGridSize(nAssets, step, assetBounds) {
    // Calculate number of valid weight combinations
    // This is an approximation - actual count depends on bounds
    const steps = Math.round(1 / step) + 1;

    // Without bounds, use stars and bars: C(n+k-1, k) where k = 1/step
    // With bounds, we estimate by calculating reduction factor
    if (!assetBounds || assetBounds.every(b => b[0] === 0 && b[1] === 1)) {
        // No bounds - use combinatorial formula for compositions
        // Number of ways to write 1 as sum of n non-negative multiples of step
        // This is approximately (1/step + n - 1) choose (n - 1)
        const k = Math.round(1 / step);
        return binomial(k + nAssets - 1, nAssets - 1);
    } else {
        // With bounds, estimate by simulation or rough calculation
        // For simplicity, count by iterating (only for small grids)
        let count = 0;
        const values = [];
        for (let i = 0; i <= Math.round(1 / step); i++) {
            values.push(i * step);
        }

        // For small grids, count exactly
        if (nAssets <= 4 && values.length <= 21) {
            const iterate = (depth, remaining) => {
                if (depth === nAssets - 1) {
                    const lastWeight = remaining;
                    if (lastWeight >= -1e-9 && lastWeight <= 1 + 1e-9) {
                        const bounds = assetBounds[depth];
                        if (lastWeight >= bounds[0] - 1e-9 && lastWeight <= bounds[1] + 1e-9) {
                            count++;
                        }
                    }
                    return;
                }
                const bounds = assetBounds[depth];
                for (const v of values) {
                    if (v >= bounds[0] - 1e-9 && v <= bounds[1] + 1e-9 && v <= remaining + 1e-9) {
                        iterate(depth + 1, remaining - v);
                    }
                }
            };
            iterate(0, 1.0);
            return count;
        } else {
            // For large grids, estimate based on bounds restriction
            const unboundedSize = binomial(Math.round(1/step) + nAssets - 1, nAssets - 1);
            let reductionFactor = 1;
            for (const bounds of assetBounds) {
                const range = bounds[1] - bounds[0];
                reductionFactor *= range;
            }
            return Math.max(1, Math.round(unboundedSize * reductionFactor));
        }
    }
}

function binomial(n, k) {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
    }
    return Math.round(result);
}

function formatDuration(seconds) {
    if (seconds < 1) return "< 1 second";
    if (seconds < 60) return `~${Math.round(seconds)} seconds`;
    if (seconds < 3600) return `~${Math.round(seconds / 60)} minutes`;
    return `~${(seconds / 3600).toFixed(1)} hours`;
}

function updateEstimate() {
    const estimateText = document.getElementById('estimate-text');
    const estimateBox = document.getElementById('estimate-box');
    if (!estimateText || assets.length < 2) return;

    const step = parseFloat(document.getElementById('grid-step').value);
    const nSamples = parseInt(document.getElementById('n-samples').value);
    const assetBounds = assets.map(a => [a.minWeight, a.maxWeight]);

    const gridSize = calculateGridSize(assets.length, step, assetBounds);

    // Time estimation calibrated from benchmarks:
    // - Sample generation: ~2s per asset at 5000 samples
    // - Correlation matrix overhead: scales with n^2 for n assets (Cholesky, matrix mult)
    // - Grid search is fast: ~0.0002s per portfolio
    const nAssets = assets.length;
    const sampleGenTime = (nSamples / 5000) * nAssets * 2.0;
    const correlationOverhead = (nAssets > 2) ? (nAssets * nAssets * 0.05) : 0;
    const timePerPortfolio = 0.0002 * (nSamples / 5000);
    const estimatedSeconds = sampleGenTime + correlationOverhead + (gridSize * timePerPortfolio);

    let message = `Grid size: ${gridSize.toLocaleString()} portfolios`;
    message += ` · Est. time: ${formatDuration(estimatedSeconds)}`;

    if (estimatedSeconds > 120) {
        estimateBox.className = 'estimate-box estimate-warning';
        message += ' (this will take a while)';
    } else if (estimatedSeconds > 30) {
        estimateBox.className = 'estimate-box estimate-caution';
    } else {
        estimateBox.className = 'estimate-box';
    }

    estimateText.textContent = message;
}

function cancelOptimization() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;

        document.getElementById('loading').style.display = 'none';
        document.getElementById('cancel-btn').style.display = 'none';
        document.getElementById('optimize-btn').disabled = false;

        document.getElementById('results-content').innerHTML = `
            <div class="error-message visible">Optimization cancelled.</div>
        `;
    }
}

function updateCorrelationGrid() {
    if (assets.length < 2) return;

    let html = '<table><tr><th></th>';

    // Header row
    for (const asset of assets) {
        html += `<th>${asset.name}</th>`;
    }
    html += '</tr>';

    // Data rows
    for (let i = 0; i < assets.length; i++) {
        html += `<tr><th>${assets[i].name}</th>`;
        for (let j = 0; j < assets.length; j++) {
            if (i === j) {
                html += '<td><input type="number" value="1.0" disabled></td>';
            } else if (i < j) {
                html += `<td><input type="number" id="corr-${i}-${j}" value="0.0" step="0.1" min="-1" max="1" onchange="validateCorrelation()"></td>`;
            } else {
                html += `<td><input type="number" id="corr-${i}-${j}" value="" disabled></td>`;
            }
        }
        html += '</tr>';
    }
    html += '</table>';

    correlationGrid.innerHTML = html;
}

function getCorrelationMatrix() {
    const n = assets.length;
    const matrix = [];

    for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                row.push(1.0);
            } else if (i < j) {
                const input = document.getElementById(`corr-${i}-${j}`);
                row.push(parseFloat(input.value) || 0);
            } else {
                // Mirror value
                const input = document.getElementById(`corr-${j}-${i}`);
                row.push(parseFloat(input.value) || 0);
            }
        }
        matrix.push(row);
    }

    return matrix;
}

async function validateCorrelation() {
    const matrix = getCorrelationMatrix();

    try {
        const response = await fetch('/api/validate-correlation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correlation_matrix: matrix })
        });

        const result = await response.json();

        if (result.valid) {
            correlationError.classList.remove('visible');
            correlationError.textContent = '';
        } else {
            correlationError.textContent = result.message;
            correlationError.classList.add('visible');
        }

        return result.valid;
    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
}

async function runOptimization() {
    // Validate correlation first
    const isValid = await validateCorrelation();
    if (!isValid) {
        alert('Please fix the correlation matrix before optimizing.');
        return;
    }

    // Validate asset weights
    for (const asset of assets) {
        const total = asset.components.reduce((sum, c) => sum + c.weight, 0);
        if (Math.abs(total - 1.0) > 0.01) {
            alert(`Asset "${asset.name}" has weights that sum to ${total.toFixed(2)}, not 1.0. Please fix.`);
            return;
        }
    }

    // Set up abort controller for cancellation
    currentAbortController = new AbortController();
    optimizationStartTime = Date.now();

    // Show loading and cancel button
    resultsSection.style.display = 'block';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('cancel-btn').style.display = 'inline-block';
    document.getElementById('optimize-btn').disabled = true;
    document.getElementById('results-content').innerHTML = '';

    // Prepare data
    const assetsData = assets.map(a => ({
        name: a.name,
        weights: a.components.map(c => c.weight),
        means: a.components.map(c => c.mean),
        stds: a.components.map(c => c.std)
    }));

    // Build asset bounds array
    const assetBounds = assets.map(a => [a.minWeight, a.maxWeight]);

    const correlationMatrix = getCorrelationMatrix();
    const cvarLimit = parseFloat(document.getElementById('cvar-limit').value);
    const nSamples = parseInt(document.getElementById('n-samples').value);
    const step = parseFloat(document.getElementById('grid-step').value);

    try {
        const response = await fetch('/api/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assets: assetsData,
                correlation_matrix: correlationMatrix,
                asset_bounds: assetBounds,
                cvar_limit: cvarLimit,
                n_samples: nSamples,
                step: step
            }),
            signal: currentAbortController.signal
        });

        const result = await response.json();

        document.getElementById('loading').style.display = 'none';
        document.getElementById('cancel-btn').style.display = 'none';
        document.getElementById('optimize-btn').disabled = false;
        currentAbortController = null;

        if (result.error) {
            document.getElementById('results-content').innerHTML = `
                <div class="error-message visible">${result.error}</div>
            `;
        } else {
            const elapsed = ((Date.now() - optimizationStartTime) / 1000).toFixed(1);
            displayResults(result, elapsed);
        }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('cancel-btn').style.display = 'none';
        document.getElementById('optimize-btn').disabled = false;
        currentAbortController = null;

        if (error.name === 'AbortError') {
            // Already handled by cancelOptimization
            return;
        }

        document.getElementById('results-content').innerHTML = `
            <div class="error-message visible">Error: ${error.message}</div>
        `;
    }
}

function displayResults(result, elapsedSeconds) {
    const content = document.getElementById('results-content');

    // Build weights display
    let weightsHtml = '';
    for (let i = 0; i < assets.length; i++) {
        const weight = result.optimal_weights[i];
        const percentage = (weight * 100).toFixed(1);
        weightsHtml += `
            <div class="weight-bar">
                <span class="weight-bar-label">${assets[i].name}</span>
                <div class="weight-bar-fill" style="width: ${Math.max(weight * 300, 40)}px;">
                    ${percentage}%
                </div>
            </div>
        `;
    }

    const timeInfo = elapsedSeconds ? `<span class="elapsed-time">Completed in ${elapsedSeconds}s</span>` : '';

    content.innerHTML = `
        <div class="results-grid">
            <div class="result-card">
                <h3>Optimal Weights ${timeInfo}</h3>
                ${weightsHtml}
            </div>

            <div class="result-card">
                <h3>Risk Metrics</h3>
                <div class="metric">
                    <span class="metric-label">Sharpe Ratio</span>
                    <span class="metric-value">${result.sharpe.toFixed(3)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">CVaR (5%)</span>
                    <span class="metric-value">${(result.cvar * 100).toFixed(2)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Expected Return</span>
                    <span class="metric-value">${(result.mean * 100).toFixed(2)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Volatility</span>
                    <span class="metric-value">${(result.std * 100).toFixed(2)}%</span>
                </div>
            </div>
        </div>

        <div class="result-card" style="margin-top: 20px;">
            <h3>Portfolio Return Distribution</h3>
            <canvas id="return-distribution-chart"></canvas>
        </div>
    `;

    // Draw return distribution chart
    const histogram = createHistogram(result.portfolio_returns, 50);

    new Chart(document.getElementById('return-distribution-chart'), {
        type: 'bar',
        data: {
            labels: histogram.labels,
            datasets: [{
                data: histogram.counts,
                backgroundColor: 'rgba(46, 204, 113, 0.6)',
                borderColor: 'rgba(46, 204, 113, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Simulated Portfolio Returns'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Return' }
                },
                y: {
                    title: { display: true, text: 'Frequency' }
                }
            }
        }
    });
}