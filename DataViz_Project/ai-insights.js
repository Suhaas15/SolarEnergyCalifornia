// Global variables
let solarData = null;
let sustainabilityData = null;
let dataStatistics = null;

// LM Studio API Configuration
const LM_STUDIO_API = {
    url: 'http://localhost:1234/v1/chat/completions',
    models: 'http://localhost:1234/v1/models',
    headers: {
        'Content-Type': 'application/json'
    },
    currentModel: null
};

// Initialize the page
document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('Starting initialization...');
        
        // Load data
        console.log('Loading AI Insights data...');
        await loadAIInsightsData();
        console.log('Solar data loaded:', solarData ? `${solarData.length} records` : 'No data');
        
        // Check LM Studio connection
        console.log('Checking LM Studio connection...');
        await checkLMStudioConnection();
        console.log('LM Studio connection status:', LM_STUDIO_API.currentModel ? `Connected, using model: ${LM_STUDIO_API.currentModel}` : 'Not connected');
        
        // Set up event listeners
        setupEventListeners();
        
        // Populate county filter
        populateCountyFilter();
        
        console.log('AI Insights page initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize the application. Please make sure LM Studio is running.');
    }
});

// Load solar installation data for AI insights
async function loadAIInsightsData() {
    try {
        console.log('Starting data load...');
        
        // Load CSV files
        const [solar, sustainability] = await Promise.all([
            d3.csv('Cleaned_Solar_Data.csv'),
            d3.csv('County_Sustainability_Metrics.csv')
        ]);
        
        console.log('CSV files loaded:', {
            solarRecords: solar?.length || 0,
            sustainabilityRecords: sustainability?.length || 0
        });
        
        // Set global variables
        solarData = solar;
        sustainabilityData = sustainability;
        
        // Calculate data statistics
        dataStatistics = {
            counties: {},
            topCounties: [],
            averageSize: 0,
            averageGridDistance: 0,
            installationTypes: {},
            urbanRural: {},
            sizeCategories: {}
        };
        
        // Process county statistics
        const countyStats = d3.rollup(solarData,
            v => ({
                installations: v.length,
                avgSize: d3.mean(v, d => +d.Acres),
                avgGridDistance: d3.mean(v, d => +d["Distance to Substation (Miles) CAISO"])
            }),
            d => d.County
        );
        
        // Convert to array and sort by installations
        const countiesArray = Array.from(countyStats, ([name, stats]) => ({
            name,
            ...stats
        }));
        
        dataStatistics.topCounties = countiesArray
            .sort((a, b) => b.installations - a.installations)
            .slice(0, 10);
            
        // Calculate overall statistics
        dataStatistics.averageSize = d3.mean(solarData, d => +d.Acres);
        dataStatistics.averageGridDistance = d3.mean(solarData, d => +d["Distance to Substation (Miles) CAISO"]);
        
        // Calculate installation types
        dataStatistics.installationTypes = Object.fromEntries(
            d3.rollup(solarData, v => v.length, d => d["Install Type"])
        );
        
        // Calculate urban/rural split
        dataStatistics.urbanRural = Object.fromEntries(
            d3.rollup(solarData, v => v.length, d => d["Urban or Rural"])
        );
        
        // Store county data
        countiesArray.forEach(county => {
            dataStatistics.counties[county.name] = county;
        });
        
        console.log('Data statistics calculated:', dataStatistics);
        console.log('AI Insights data loaded successfully');
        
        return true;
    } catch (error) {
        console.error('Failed to load data:', error);
        throw new Error('Failed to load data: ' + error.message);
    }
}

// Check LM Studio connection
async function checkLMStudioConnection() {
    try {
        // First, get available models
        const modelsResponse = await fetch(LM_STUDIO_API.models);
        if (!modelsResponse.ok) {
            throw new Error(`Failed to fetch models: ${modelsResponse.status}`);
        }
        
        const modelsData = await modelsResponse.json();
        if (!modelsData.data || modelsData.data.length === 0) {
            throw new Error('No models loaded in LM Studio');
        }
        
        // Get the first available model
        const availableModel = modelsData.data[0].id;
        console.log('Connected to LM Studio, using model:', availableModel);
        
        // Store the model for later use
        LM_STUDIO_API.currentModel = availableModel;
        
        return true;
    } catch (error) {
        console.error('LM Studio connection error:', error);
        throw error;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Query button click
    document.getElementById('queryButton').addEventListener('click', handleQuery);
    
    // Enter key in query input
    document.getElementById('queryInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleQuery();
        }
    });
    
    // County filter change
    document.getElementById('countyFilter').addEventListener('change', function() {
        const query = document.getElementById('queryInput').value;
        if (query) {
            handleQuery();
        }
    });
}

// Handle user query
async function handleQuery() {
    const queryInput = document.getElementById('queryInput');
    const query = queryInput.value.trim();
    
    if (!query) {
        showError('Please enter a question about solar installations.');
        return;
    }
    
    try {
        console.log('Processing query:', query);
        
        // Check if data is loaded
        if (!solarData) {
            console.error('Solar data is not loaded');
            showError('Data is not loaded. Please refresh the page.');
            return;
        }
        
        // Show loading state
        showLoading();
        
        // Get selected county
        const county = document.getElementById('countyFilter').value;
        console.log('Selected county:', county);
        
        // Prepare context for the model
        const context = prepareContext(county);
        console.log('Prepared context:', context);
        
        // Check if context is valid
        if (!context || !context.metrics) {
            console.error('Invalid context:', context);
            showError('Failed to prepare context for the query.');
            return;
        }
        
        // Generate response using LM Studio
        console.log('Sending query to LM Studio...');
        const response = await queryLMStudio(query, context);
        console.log('LM Studio response:', response);
        
        // Update UI with response
        updateUI(response);
        
        // Add to history
        addToHistory(query, response);
        
    } catch (error) {
        console.error('Query error:', error);
        showError('Failed to process your query. Please make sure LM Studio is running.');
    } finally {
        hideLoading();
    }
}

// Prepare context for the model
function prepareContext(county) {
    let filteredData = solarData;
    if (county !== 'all') {
        filteredData = solarData.filter(d => d.County === county);
    }
    
    // Calculate key metrics
    const metrics = {
        totalInstallations: filteredData.length,
        avgSize: d3.mean(filteredData, d => +d.Acres),
        installationTypes: d3.rollup(filteredData, v => v.length, d => d["Install Type"]),
        urbanRural: d3.rollup(filteredData, v => v.length, d => d["Urban or Rural"]),
        avgGridDistance: d3.mean(filteredData, d => +d["Distance to Substation (Miles) CAISO"])
    };
    
    return {
        metrics,
        county,
        dataSize: filteredData.length
    };
}

// Query LM Studio
async function queryLMStudio(query, context) {
    try {
        // Check if LM Studio is connected
        if (!LM_STUDIO_API.currentModel) {
            console.error('LM Studio is not connected');
            throw new Error('LM Studio is not connected. Please ensure LM Studio is running and a model is loaded.');
        }
        
        // Use the model we discovered during connection check
        const model = LM_STUDIO_API.currentModel;
        console.log('Using model:', model);
        
        // Prepare the request
        const requestBody = {
            messages: [
                {
                    role: 'system',
                    content: `You are an AI assistant analyzing California solar installation data. CRITICAL INSTRUCTIONS:

1. ONLY use data from these California counties: ${Object.keys(dataStatistics.counties).join(', ')}
2. ONLY discuss these metrics: installations, acres, install types (${Object.keys(dataStatistics.installationTypes).join('/')}), urban/rural split, grid distance
3. Key statistics from the current dataset:
   - Top counties by installations: ${dataStatistics.topCounties.map(c => `${c.name} County has ${c.installations} installations`).join(', ')}
   - Average installation size: ${dataStatistics.averageSize.toFixed(1)} acres
   - Average grid distance: ${dataStatistics.averageGridDistance.toFixed(1)} miles
   - Installation types: ${JSON.stringify(dataStatistics.installationTypes)}
   - Urban/Rural split: ${JSON.stringify(dataStatistics.urbanRural)}
   - Size categories: ${JSON.stringify(dataStatistics.sizeCategories)}

CRITICAL RULES:
- ONLY use statistics from the current dataset
- NEVER mention counties not in our data
- NEVER report numbers higher than actual maximums
- ALWAYS specify "California" when discussing counties
- If unsure about any data, say "I don't have that information in the current dataset"

Current context:
County: ${context.county === 'all' ? 'All Counties' : context.county}
Total Installations: ${context.metrics.totalInstallations}
Average Size: ${context.metrics.avgSize.toFixed(2)} acres
Installation Types: ${JSON.stringify(Object.fromEntries(context.metrics.installationTypes))}
Urban/Rural Split: ${JSON.stringify(Object.fromEntries(context.metrics.urbanRural))}
Average Grid Distance: ${context.metrics.avgGridDistance.toFixed(2)} miles`
                },
                {
                    role: 'user',
                    content: query
                }
            ],
            model: model,
            temperature: 0.7,
            max_tokens: 1000
        };
        
        console.log('Sending request to LM Studio:', requestBody);
        
        const response = await fetch(LM_STUDIO_API.url, {
            method: 'POST',
            headers: LM_STUDIO_API.headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LM Studio API error:', errorText);
            throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('LM Studio response:', data);
        
        if (!data || !data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
            console.error('Invalid response format from LM Studio:', data);
            throw new Error('Invalid response format from LM Studio');
        }
        
        let aiResponse = data.choices[0].message.content;
        
        // Validate and correct numerical claims
        aiResponse = await validateAIResponse(aiResponse, context);
        
        // Check if the response mentions any chart IDs and highlight them
        const chartIds = visualizationState.activeCharts.map(c => c.id);
        chartIds.forEach(id => {
            if (aiResponse.toLowerCase().includes(id.toLowerCase())) {
                highlightChart(id);
            }
        });
        
        return {
            text: aiResponse,
            metrics: extractMetrics(context),
            recommendations: generateRecommendations(context)
        };
    } catch (error) {
        console.error('LM Studio API error:', error);
        throw error;
    }
}

// Extract metrics for display
function extractMetrics(context) {
    return [
        {
            label: 'Total Installations',
            value: context.metrics.totalInstallations.toLocaleString()
        },
        {
            label: 'Average Size',
            value: `${context.metrics.avgSize.toFixed(2)} acres`
        },
        {
            label: 'Grid Distance',
            value: `${context.metrics.avgGridDistance.toFixed(2)} miles`
        }
    ];
}

// Generate recommendations based on context
function generateRecommendations(context) {
    const recommendations = [];
    
    // Add recommendations based on metrics
    if (context.metrics.avgGridDistance > 5) {
        recommendations.push('Consider locations closer to electrical infrastructure to reduce connection costs.');
    }
    
    if (context.metrics.avgSize < 10) {
        recommendations.push('Explore opportunities for larger installations to improve efficiency.');
    }
    
    const urbanCount = context.metrics.urbanRural.get('Urban') || 0;
    const ruralCount = context.metrics.urbanRural.get('Rural') || 0;
    if (urbanCount > ruralCount) {
        recommendations.push('Consider expanding into rural areas for larger installation opportunities.');
    }
    
    return recommendations;
}

// Update UI with response
function updateUI(response) {
    // Update AI response with markdown formatting
    document.getElementById('aiResponse').innerHTML = marked.parse(response.text);
    
    // Update metrics
    updateMetrics(response.metrics);
    
    // Update recommendations
    updateRecommendations(response.recommendations);
}

// Update metrics display
function updateMetrics(metrics) {
    const metricsContainer = document.getElementById('keyMetrics');
    metricsContainer.innerHTML = metrics.map(metric => `
        <div class="metric-item">
            <label>${metric.label}</label>
            <span class="metric-value">${metric.value}</span>
        </div>
    `).join('');
}

// Update recommendations
function updateRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('recommendations');
    recommendationsContainer.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <i class="bi bi-lightbulb"></i>
            <div>${rec}</div>
        </div>
    `).join('');
}

// Add query to history
function addToHistory(query, response) {
    const historyContainer = document.getElementById('analysisHistory');
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
        <div class="history-query">${query}</div>
        <div class="history-time">${new Date().toLocaleTimeString()}</div>
    `;
    historyItem.addEventListener('click', () => {
        document.getElementById('queryInput').value = query;
        handleQuery();
    });
    historyContainer.insertBefore(historyItem, historyContainer.firstChild);
}

// Populate county filter
function populateCountyFilter() {
    const counties = [...new Set(solarData.map(d => d.County))].sort();
    const select = document.getElementById('countyFilter');
    
    counties.forEach(county => {
        const option = document.createElement('option');
        option.value = county;
        option.textContent = county;
        select.appendChild(option);
    });
}

// Quick query functions
function runQuery(queryType) {
    const queryInput = document.getElementById('queryInput');
    switch (queryType) {
        case 'optimal-locations':
            queryInput.value = 'What are the best locations for new solar installations based on the current data?';
            break;
        case 'efficiency-patterns':
            queryInput.value = 'What patterns do you see in installation efficiency across different regions?';
            break;
        case 'recommendations':
            queryInput.value = 'What are your top recommendations for improving solar deployment in this area?';
            break;
    }
    handleQuery();
}

// UI Helper functions
function showLoading() {
    const aiResponse = document.getElementById('aiResponse');
    aiResponse.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3 text-muted">Analyzing data...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading is hidden when updateUI is called
}

function showError(message) {
    const aiResponse = document.getElementById('aiResponse');
    aiResponse.innerHTML = `
        <div class="alert alert-danger" role="alert">
            <i class="bi bi-exclamation-triangle me-2"></i>
            ${message}
        </div>
    `;
} 