// Chatbot state
let chatHistory = [];
let isMinimized = true;
let currentContext = null;
let solarData = null;
let currentVisualization = null;

// LM Studio API configuration
const LM_STUDIO_API = {
    url: 'http://localhost:1234/v1/chat/completions',
    models: 'http://localhost:1234/v1/models',
    headers: {
        'Content-Type': 'application/json'
    },
    maxRetries: 2,
    retryDelay: 1000,
    currentModel: 'mistral-7b-instruct-v0.3' // Explicitly set the model
};

// Chatbot State
let chatbotState = {
  isOpen: false,
  unreadCount: 0,
  isConnected: false,
  context: {
    currentPage: window.location.pathname.split('/').pop().replace('.html', ''),
    selectedCounty: '',
    currentView: '',
    recentData: null
  }
};

// Global variables for visualization state
let visualizationState = {
    currentView: null,
    activeCharts: [],
    selectedFilters: {},
    lastInteraction: null
};

// DOM Elements
const chatbot = document.getElementById('chatbot');
const toggleChat = document.getElementById('toggleChat');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessage = document.getElementById('sendMessage');
const unreadBadge = document.getElementById('unreadCount');

// Global variable to store data statistics
let dataStatistics = null;

// Add California counties validation
const CALIFORNIA_COUNTIES = [
    'Alameda', 'Amador', 'Butte', 'Calaveras', 'Colusa', 'Contra Costa',
    'El Dorado', 'Fresno', 'Glenn', 'Humboldt', 'Imperial', 'Inyo', 'Kern', 'Kings',
    'Lake', 'Lassen', 'Los Angeles', 'Madera', 'Marin', 'Mendocino', 'Merced',
    'Mono', 'Monterey', 'Napa', 'Nevada', 'Orange', 'Placer', 'Plumas', 'Riverside',
    'Sacramento', 'San Benito', 'San Bernardino', 'San Diego', 'San Francisco',
    'San Joaquin', 'San Luis Obispo', 'San Mateo', 'Santa Barbara', 'Santa Clara',
    'Santa Cruz', 'Shasta', 'Solano', 'Sonoma', 'Stanislaus', 'Sutter', 'Tehama',
    'Tulare', 'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
];

// Add available data fields and metrics validation
const AVAILABLE_METRICS = {
    installTypes: ['Rooftop', 'Ground'],
    sizeCategories: ['Small(<1)', 'Medium(1-5)', 'Large(5-10)', 'X-Large(10+)'],
    urbanRural: ['Urban', 'Rural'],
    dataFields: [
        'County',
        'Acres',
        'Install Type',
        'Urban or Rural',
        'Grid_Zone',
        'Infrastructure_Score',
        'Avg_Distance_Substation',
        'Size_Category'
    ]
};

// Add data ranges for validation
const DATA_RANGES = {
    acres: {
        min: 0,
        max: 100,  // Set based on your actual max
        avg: 25.82 // Average from the data
    },
    infrastructureScore: {
        min: 0,
        max: 100,
        avg: 34.6  // Average from top counties
    },
    gridDistance: {
        min: 0,
        max: 15,   // Based on observed distances
        avg: 5.76  // Average from top counties
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initializing chatbot...');
    
    // Add status indicator to UI
    const header = document.querySelector('.chatbot-title');
    const statusIndicator = document.createElement('span');
    statusIndicator.className = 'chatbot-status disconnected';
    statusIndicator.title = 'Not connected to LM Studio';
    header.appendChild(statusIndicator);

    // Set up event listeners first
    setupEventListeners();
    
    // Load data first - this should always work
    try {
        console.log('Loading solar data...');
        await loadSolarData();
        console.log('✅ Solar data loading completed successfully');
    } catch (dataError) {
        console.error('❌ Failed to load solar data:', dataError);
        addMessage('assistant', `Error loading data: ${dataError.message}`);
    }
    
    // Then try LM Studio connection - this can fail without affecting data
    try {
        console.log('Checking LM Studio connection...');
        await checkLMStudioConnection();
        updateConnectionStatus(true);
        console.log('✅ LM Studio connection successful');
    } catch (lmError) {
        console.warn('⚠️ LM Studio connection failed:', lmError);
        updateConnectionStatus(false);
        
        // Show detailed error message
        let errorMessage = 'Unable to connect to LM Studio. Please ensure:\n';
        if (lmError.message.includes('Failed to fetch') || lmError.message.includes('Cannot reach')) {
            errorMessage += '1. LM Studio application is running\n';
            errorMessage += '2. Local Server is enabled in Settings\n';
            errorMessage += '3. Server is running on port 1234\n';
            errorMessage += '4. CORS is enabled in Settings\n';
            errorMessage += '5. A model is loaded\n\n';
            errorMessage += `Error details: ${lmError.message}`;
        } else {
            errorMessage += lmError.message;
        }
        
        addMessage('assistant', errorMessage);
        addMessage('assistant', 'Note: Data visualization still works, but AI chat is limited.');
    }
});

// Set up event listeners
function setupEventListeners() {
    // Set up toggle chat button
    toggleChat.addEventListener('click', toggleChatbot);
    sendMessage.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Listen for minimize/close buttons
    document.querySelector('.minimize-chat').addEventListener('click', minimizeChatbot);
    document.querySelector('.close-chat').addEventListener('click', closeChatbot);

    // Listen for county selection changes
    const countyFilter = document.getElementById('countyFilter');
    if (countyFilter) {
        countyFilter.addEventListener('change', (e) => {
            chatbotState.context.selectedCounty = e.target.value;
            updateContextMessage();
        });
    }

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });

    // Listen for chart interactions
    document.querySelectorAll('.chart-container').forEach(chart => {
        chart.addEventListener('click', () => {
            visualizationState.lastInteraction = {
                type: 'chart_click',
                chartId: chart.id,
                timestamp: new Date().toISOString()
            };
        });
    });
    
    // Listen for filter changes
    ['countyFilter', 'yearFilter', 'nodeTypeFilter'].forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter) {
            filter.addEventListener('change', () => {
                updateVisualizationState();
            });
        }
    });
}

// Load solar installation data
async function loadSolarData() {
    try {
        console.log('🔄 Fetching CSV file...');
        
        // Use D3's robust CSV parser instead of manual parsing
        solarData = await d3.csv('Cleaned_Solar_Data.csv');
        
        console.log('📊 Raw D3 data loaded:', solarData.length, 'records');
        
        // Process and clean the data
        solarData = solarData.map(d => ({
            OBJECTID: d.OBJECTID,
            County: d.County,
            Acres: parseFloat(d.Acres) || 0,
            "Install Type": d["Install Type"] || d["Install_Type"] || "Unknown",
            "Urban or Rural": d["Urban or Rural"] || d["Urban_or_Rural"] || "Unknown",
            Combined_Class: d.Combined_Class,
            "Distance to Substation (Miles) CAISO": parseFloat(d["Distance to Substation (Miles) CAISO"]) || 0,
            Grid_Zone: d.Grid_Zone,
            Size_Category: d.Size_Category,
            Infrastructure_Score: parseFloat(d.Infrastructure_Score) || 0,
            Avg_Distance_Substation: parseFloat(d.Avg_Distance_Substation) || parseFloat(d["Distance to Substation (Miles) CAISO"]) || 0,
            Carbon_Offset_tons: parseFloat(d.Carbon_Offset_tons) || 0
        }));
        
        // Make data globally accessible for other pages
        window.currentSolarData = solarData;
        window.solarDataLoaded = true;
        
        console.log('✅ Solar data processed:', solarData.length, 'records');
        console.log('🌐 Data made globally available as window.currentSolarData');
        
        // Log sample record for verification
        if (solarData.length > 0) {
            console.log('📋 Sample record:', solarData[0]);
        }
        
        // Calculate initial statistics
        updateDataStatistics();
        
        // Trigger custom event to notify other components
        window.dispatchEvent(new CustomEvent('solarDataLoaded', { 
            detail: { data: solarData, count: solarData.length } 
        }));
        
        console.log('📢 solarDataLoaded event dispatched');
        
        return solarData;
    } catch (error) {
        console.error('❌ Failed to load solar data:', error);
        throw error;
    }
}

// Parse CSV data
function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim();
        });
        data.push(row);
    }

    return data;
}

// Update data statistics
function updateDataStatistics() {
    if (!solarData) return;
    
    // Group data by county and calculate metrics
    const countyStats = {};
    solarData.forEach(row => {
        const county = row['County'];
        if (!countyStats[county]) {
            countyStats[county] = {
                installations: 0,
                totalAcres: 0,
                rooftopCount: 0,
                groundCount: 0,
                gridDistances: [],
                urbanCount: 0,
                ruralCount: 0
            };
        }
        
        countyStats[county].installations++;
        countyStats[county].totalAcres += parseFloat(row['Acres']) || 0;
        countyStats[county].rooftopCount += (row['Install Type'] === 'Rooftop') ? 1 : 0;
        countyStats[county].groundCount += (row['Install Type'] === 'Ground') ? 1 : 0;
        countyStats[county].gridDistances.push(parseFloat(row['Distance to Substation (Miles) CAISO']) || 0);
        countyStats[county].urbanCount += (row['Urban or Rural'] === 'Urban') ? 1 : 0;
        countyStats[county].ruralCount += (row['Urban or Rural'] === 'Rural') ? 1 : 0;
    });

    // Calculate overall statistics
    const totalInstallations = solarData.length;
    const allAcres = solarData.map(row => parseFloat(row['Acres']) || 0);
    const allGridDistances = solarData.map(row => parseFloat(row['Distance to Substation (Miles) CAISO']) || 0);
    
    // Find county with most installations
    const sortedCounties = Object.entries(countyStats)
        .sort((a, b) => b[1].installations - a[1].installations);
    
    // Calculate size categories
    const sizeCategories = solarData.reduce((acc, row) => {
        const acres = parseFloat(row['Acres']) || 0;
        if (acres < 1) acc['Small(<1)']++;
        else if (acres < 5) acc['Medium(1-5)']++;
        else if (acres < 10) acc['Large(5-10)']++;
        else acc['X-Large(10+)']++;
        return acc;
    }, {'Small(<1)': 0, 'Medium(1-5)': 0, 'Large(5-10)': 0, 'X-Large(10+)': 0});

    dataStatistics = {
        totalInstallations,
        counties: Object.fromEntries(sortedCounties.map(([county, stats]) => [county, stats.installations])),
        topCounties: sortedCounties.slice(0, 5).map(([county, stats]) => ({
            name: county,
            installations: stats.installations,
            avgAcres: stats.totalAcres / stats.installations,
            rooftopPct: (stats.rooftopCount / stats.installations * 100).toFixed(1),
            groundPct: (stats.groundCount / stats.installations * 100).toFixed(1),
            avgGridDistance: (stats.gridDistances.reduce((a, b) => a + b, 0) / stats.gridDistances.length).toFixed(1)
        })),
        averageSize: allAcres.reduce((a, b) => a + b, 0) / totalInstallations,
        maxSize: Math.max(...allAcres),
        averageGridDistance: allAcres.reduce((a, b) => a + b, 0) / totalInstallations,
        maxGridDistance: Math.max(...allGridDistances),
        installationTypes: {
            Rooftop: solarData.filter(row => row['Install Type'] === 'Rooftop').length,
            Ground: solarData.filter(row => row['Install Type'] === 'Ground').length
        },
        urbanRural: {
            Urban: solarData.filter(row => row['Urban or Rural'] === 'Urban').length,
            Rural: solarData.filter(row => row['Urban or Rural'] === 'Rural').length
        },
        sizeCategories
    };
    
    console.log('Data statistics updated:', dataStatistics);
}

// Check LM Studio connection
async function checkLMStudioConnection() {
    try {
        console.log('Performing full LM Studio connection check...');
        
        // First, get available models
        console.log('Fetching available models...');
        const modelsResponse = await fetch(LM_STUDIO_API.models, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!modelsResponse.ok) {
            const errorText = await modelsResponse.text();
            console.error('Models endpoint error:', errorText);
            throw new Error(`Failed to fetch models: ${modelsResponse.status} - ${errorText}`);
        }
        
        const modelsData = await modelsResponse.json();
        console.log('Available models:', modelsData);
        
        if (!modelsData.data || modelsData.data.length === 0) {
            throw new Error('No models loaded in LM Studio. Please load a model first.');
        }
        
        // Get the first available model
        const availableModel = modelsData.data[0].id;
        console.log('Using model:', availableModel);
        
        // Store the model for later use
        LM_STUDIO_API.currentModel = availableModel;
        
        // Try a direct POST request to test chat completions
        console.log('Testing chat completion...');
        const testRequest = {
            messages: [
                {
                    role: 'user',
                    content: 'Hi, can you help me analyze some data?'
                }
            ],
            model: availableModel,
            max_tokens: 50,
            temperature: 0.7,
            stream: false
        };
        
        console.log('Sending test request:', JSON.stringify(testRequest, null, 2));
        
        const response = await fetch(LM_STUDIO_API.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testRequest)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Chat completion test failed:', errorText);
            throw new Error(`Chat completion test failed: ${response.status} - ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('Test response:', responseData);
        
        if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
            throw new Error('Invalid response format from LM Studio');
        }
        
        // Add success message
        addMessage('assistant', `Successfully connected to LM Studio! Using model: ${availableModel}`);
        addMessage('assistant', 'You can now ask questions about the solar installation data.');
        updateConnectionStatus(true);
        
        return true;
    } catch (error) {
        console.error('LM Studio connection error:', error);
        let errorMessage = 'Unable to connect to LM Studio. Please ensure:\n';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage += '1. LM Studio application is running\n';
            errorMessage += '2. Local Server is enabled in Settings\n';
            errorMessage += '3. Server is running on port 1234\n';
            errorMessage += '4. CORS is enabled in Settings\n';
            errorMessage += '5. A model is loaded';
        } else if (error.message.includes('No models')) {
            errorMessage += 'No models are currently loaded in LM Studio.\n';
            errorMessage += 'Please load a model in LM Studio and try again.';
        } else {
            errorMessage += error.message;
        }
        
        addMessage('assistant', errorMessage);
        updateConnectionStatus(false);
        throw error;
    }
}

// Update current context with visualization and data
function updateContext() {
    const visualizationState = getCurrentVisualizationState();
    const selectedData = getSelectedData();
    
    currentContext = {
        visualization: {
            type: visualizationState.type,
            filters: visualizationState.filters,
            metrics: visualizationState.metrics
        },
        data: {
            selected: selectedData,
            summary: generateDataSummary(selectedData)
        },
        userSelection: {
            county: document.getElementById('countyFilter')?.value,
            view: document.querySelector('.active')?.dataset?.view
        }
    };
}

// Get current visualization state
function getCurrentVisualizationState() {
    const activeViz = document.querySelector('.visualization-area');
    if (!activeViz) return { type: 'none', filters: {}, metrics: {} };

    return {
        type: activeViz.dataset.vizType || 'unknown',
        filters: {
            county: document.getElementById('countyFilter')?.value,
            installationType: document.getElementById('nodeTypeFilter')?.value,
        },
        metrics: {
            totalInstallations: getTotalInstallations(),
            averageSize: getAverageInstallationSize()
        }
    };
}

// Get selected data based on current filters
function getSelectedData() {
    if (!solarData) return [];
    
    const county = document.getElementById('countyFilter')?.value;
    const installationType = document.getElementById('nodeTypeFilter')?.value;
    
    return solarData.filter(record => {
        if (county && county !== 'all' && record.County !== county) return false;
        if (installationType && installationType !== 'all' && record['Install Type'] !== installationType) return false;
        return true;
    });
}

// Generate data summary
function generateDataSummary(data) {
    if (!data || data.length === 0) return {};
    
    return {
        count: data.length,
        installationTypes: countBy(data, 'Install Type'),
        averageSize: average(data, 'Acres'),
        urbanRural: countBy(data, 'Urban or Rural'),
        counties: countBy(data, 'County')
    };
}

// Helper functions
function countBy(data, field) {
    return data.reduce((acc, record) => {
        const value = record[field];
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

function average(data, field) {
    const values = data.map(record => parseFloat(record[field])).filter(val => !isNaN(val));
    return values.reduce((a, b) => a + b, 0) / values.length;
}

// Update visualization state
function updateVisualizationState() {
    visualizationState = {
        currentView: document.querySelector('.active-view')?.id || window.location.pathname.split('/').pop().replace('.html', ''),
        activeCharts: Array.from(document.querySelectorAll('.chart-container')).map(chart => ({
            id: chart.id,
            type: chart.dataset.chartType,
            visible: chart.offsetParent !== null
        })),
        selectedFilters: {
            county: document.getElementById('countyFilter')?.value,
            year: document.getElementById('yearFilter')?.value,
            installationType: document.getElementById('nodeTypeFilter')?.value
        },
        lastInteraction: new Date().toISOString()
    };
}

// Helper function to highlight a chart
function highlightChart(chartId) {
    // Remove any existing highlights
    document.querySelectorAll('.chart-container').forEach(chart => {
        chart.classList.remove('highlighted');
    });
    
    // Add highlight to specified chart
    const chart = document.getElementById(chartId);
    if (chart) {
        chart.classList.add('highlighted');
        chart.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Update validateAIResponse function
async function validateAIResponse(response, context) {
    let validatedResponse = response;

    // Enhanced county validation - catch more patterns
    const countyPatterns = [
        /(\w+(?:\s+\w+)*)\s+County\s+has\s+(?:the\s+highest\s+number\s+of\s+)?(\d+)\s+installations/i,
        /(\w+(?:\s+\w+)*)\s+County\s+(?:has|with)\s+(?:the\s+most|the\s+highest|most|highest|\d+)\s+installations/i,
        /(\w+(?:\s+\w+)*)\s+(?:has|with)\s+(?:the\s+most|the\s+highest|most|highest|\d+)\s+installations/i,
        /(?:the\s+most|highest\s+number\s+of)\s+installations\s+(?:is|in|at)\s+(\w+(?:\s+\w+)*)\s+(?:County)?/i
    ];

    const topCounty = dataStatistics.topCounties[0];
    const correctStatement = `${topCounty.name} County has the highest number of installations (${topCounty.installations}) in California`;

    // Check each pattern
    for (const pattern of countyPatterns) {
        const match = response.match(pattern);
        if (match) {
            let county = match[1];
            county = county.replace(/\s+County$/i, '');
            
            if (!dataStatistics.counties[county]) {
                validatedResponse = validatedResponse.replace(match[0], correctStatement);
            } else {
                const actualCount = dataStatistics.counties[county];
                const currentStatement = match[0];
                const correctedStatement = `${county} County has ${actualCount} installations`;
                validatedResponse = validatedResponse.replace(currentStatement, correctedStatement);
            }
        }
    }

    // Catch any remaining mentions of non-California counties
    const allCountyMentions = response.match(/(\w+(?:\s+\w+)*)\s+County/g);
    if (allCountyMentions) {
        for (const mention of allCountyMentions) {
            const county = mention.replace(/\s+County$/, '');
            if (!dataStatistics.counties[county]) {
                validatedResponse = validatedResponse.replace(mention, `${topCounty.name} County`);
            }
        }
    }

    // Validate installation numbers
    const installationNumbers = response.match(/(\d+)\s+installations/g);
    if (installationNumbers) {
        for (const number of installationNumbers) {
            const count = parseInt(number);
            if (count > topCounty.installations) {
                validatedResponse = validatedResponse.replace(
                    number, 
                    `${topCounty.installations} installations`
                );
            }
        }
    }

    // Validate other metrics using actual data ranges
    const metrics = {
        acres: {
            max: dataStatistics.maxSize,
            avg: dataStatistics.averageSize
        },
        gridDistance: {
            max: dataStatistics.maxGridDistance,
            avg: dataStatistics.averageGridDistance
        }
    };

    // Validate acreage claims
    const acreageMatch = response.match(/(\d+(?:\.\d+)?)\s+acres/i);
    if (acreageMatch) {
        const claimed = parseFloat(acreageMatch[1]);
        if (claimed > metrics.acres.max) {
            validatedResponse = validatedResponse.replace(
                `${claimed} acres`,
                `${metrics.acres.avg.toFixed(1)} acres (corrected to average)`
            );
        }
    }

    // Validate grid distances
    const distanceMatch = response.match(/(\d+(?:\.\d+)?)\s+miles\s+from\s+(?:the\s+)?(?:nearest\s+)?substation/i);
    if (distanceMatch) {
        const claimed = parseFloat(distanceMatch[1]);
        if (claimed > metrics.gridDistance.max) {
            validatedResponse = validatedResponse.replace(
                `${claimed} miles`,
                `${metrics.gridDistance.avg.toFixed(1)} miles (corrected to average)`
            );
        }
    }

    return validatedResponse;
}

// Helper function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to format the system message
function formatSystemMessage(context) {
    // Simplified prompt for Mistral-7B
    return `You are a helpful assistant analyzing solar installation data. Here is the current data:
- County: ${context.userSelection.county === 'all' ? 'All Counties' : context.userSelection.county}
- Total Installations: ${context.metrics.totalInstallations}
- Average Size: ${context.metrics.avgSize.toFixed(1)} acres
- Urban/Rural: ${JSON.stringify(Object.fromEntries(context.metrics.urbanRural))}
Provide a brief analysis.`;
}

// Initialize LM Studio connection
async function initializeLMStudio() {
    try {
        const response = await fetch(LM_STUDIO_API.models);
        if (!response.ok) {
            throw new Error(`Failed to get models: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Available models:', data);
        
        // Verify our model is available
        const modelExists = data.data.some(model => model.id === LM_STUDIO_API.currentModel);
        if (!modelExists) {
            throw new Error(`Model ${LM_STUDIO_API.currentModel} not found. Available models: ${data.data.map(m => m.id).join(', ')}`);
        }
        
        console.log(`Successfully connected to LM Studio with model: ${LM_STUDIO_API.currentModel}`);
        return true;
    } catch (error) {
        console.error('Failed to initialize LM Studio:', error);
        return false;
    }
}

// Query LM Studio
async function queryLMStudio(message, context, retryCount = 0) {
    try {
        // Ensure we're initialized
        if (!await initializeLMStudio()) {
            throw new Error('LM Studio not properly initialized');
        }

        // Validate context
        if (!context || !context.metrics) {
            console.error('Invalid context:', context);
            throw new Error('Invalid context for LM Studio query');
        }

        // Calculate additional metrics
        const metrics = context.metrics;
        const installationTypes = Object.fromEntries(metrics.installationTypes || []);
        const urbanRural = Object.fromEntries(metrics.urbanRural || []);
        const gridDistances = Array.from(metrics.gridDistances || []);
        
        // Format the metrics for better readability
        const formattedTypes = Object.entries(installationTypes)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ');
        
        const formattedUrbanRural = Object.entries(urbanRural)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ');

        // Combine system message and context into a single user message
        const contextMessage = `You are an AI assistant analyzing California solar installation data. IMPORTANT: Keep responses under 75 words and focus on the specific data provided.

Current Analysis Context:
County: ${context.userSelection.county === 'all' ? 'All Counties' : context.userSelection.county}
Total Installations: ${metrics.totalInstallations}
Average Installation Size: ${metrics.avgSize.toFixed(1)} acres
Average Grid Distance: ${metrics.avgGridDistance.toFixed(1)} miles

Installation Types: ${formattedTypes}
Urban/Rural Distribution: ${formattedUrbanRural}

Active Visualizations:
- Installation size distribution chart
- Grid distance analysis
- Urban vs Rural installation comparison
- Installation types breakdown

Question: ${message}

Provide a focused analysis based on these metrics and visualizations.`;

        const requestBody = {
            model: LM_STUDIO_API.currentModel,
            messages: [
                { role: 'user', content: contextMessage }
            ],
            temperature: 0.1,
            max_tokens: 300,    // Increased to allow for longer responses
            top_p: 0.9,
            presence_penalty: 0.6,
            frequency_penalty: 0.3,
            stream: false
        };

        console.log('Sending request to LM Studio:', {
            model: requestBody.model,
            messageCount: requestBody.messages.length,
            contextMessage: contextMessage
        });

        const response = await fetch(LM_STUDIO_API.url, {
            method: 'POST',
            headers: LM_STUDIO_API.headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LM Studio API error response:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });

            if (errorText.includes('prediction-error') && retryCount < LM_STUDIO_API.maxRetries) {
                console.log(`Retrying request (attempt ${retryCount + 1} of ${LM_STUDIO_API.maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, LM_STUDIO_API.retryDelay * (retryCount + 1)));
                return queryLMStudio(message, context, retryCount + 1);
            }

            throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('LM Studio response:', data);

        if (!data?.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from LM Studio');
        }

        // Clean up the response
        let response_text = data.choices[0].message.content.trim();
        
        return {
            text: response_text,
            metrics: {
                ...metrics,
                installationTypes: Object.entries(installationTypes),
                urbanRural: Object.entries(urbanRural),
                gridDistances
            },
            recommendations: []
        };
    } catch (error) {
        console.error('Error in queryLMStudio:', error);
        if (error.message.includes('prediction-error') && retryCount < LM_STUDIO_API.maxRetries) {
            console.log(`Retrying after error (attempt ${retryCount + 1} of ${LM_STUDIO_API.maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, LM_STUDIO_API.retryDelay * (retryCount + 1)));
            return queryLMStudio(message, context, retryCount + 1);
        }
        throw error;
    }
}

// Toggle chatbot visibility
function toggleChatbot() {
    chatbotState.isOpen = !chatbotState.isOpen;
    if (chatbotState.isOpen) {
        chatbot.classList.remove('minimized');
        chatInput.focus();
        resetUnreadCount();
    } else {
        chatbot.classList.add('minimized');
    }
}

function minimizeChatbot() {
    chatbotState.isOpen = false;
    chatbot.classList.add('minimized');
}

function closeChatbot() {
    chatbotState.isOpen = false;
    chatbot.classList.add('minimized');
    resetUnreadCount();
}

// Message Handling
async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message
    addMessage('user', message);
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show typing indicator
    addMessage('system', 'Thinking...', 'typing-indicator');

    try {
        // Get current context
        const context = getCurrentContext();
        
        // Initialize metrics if not present
        if (!context.metrics) {
            context.metrics = {
                totalInstallations: solarData ? solarData.length : 0,
                avgSize: solarData ? d3.mean(solarData, d => +d.Acres) : 0,
                installationTypes: solarData ? d3.rollup(solarData, v => v.length, d => d["Install Type"]) : new Map(),
                urbanRural: solarData ? d3.rollup(solarData, v => v.length, d => d["Urban or Rural"]) : new Map(),
                avgGridDistance: solarData ? d3.mean(solarData, d => +d["Distance to Substation (Miles) CAISO"]) : 0
            };
        }

        let response;
        try {
            // Try to get response from LM Studio with retries
            response = await queryLMStudio(message, context);
        } catch (error) {
            console.warn('Failed to get LM Studio response:', error);
            
            // Provide a more specific error message
            let errorMessage = "I apologize, but I'm currently unable to process your request. ";
            if (error.message.includes('prediction-error')) {
                errorMessage += "The model encountered a processing error. Please try rephrasing your question or asking something simpler.";
            } else {
                errorMessage += "Please make sure LM Studio is running on port 1234 and refresh the page.";
            }
            
            response = {
                text: errorMessage,
                metrics: [],
                recommendations: []
            };
        }
        
        // Remove typing indicator
        removeTypingIndicator();
        
        // Add AI response
        addMessage('assistant', response.text);
    } catch (error) {
        console.error('Error processing message:', error);
        removeTypingIndicator();
        addMessage('system', 'Sorry, I encountered an error processing your message. Please try again with a simpler query.');
    }
}

function addMessage(type, content, className = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} ${className}`;
    messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!chatbotState.isOpen) {
        incrementUnreadCount();
    }
}

function removeTypingIndicator() {
    const indicator = chatMessages.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Context Management
function getCurrentContext() {
    const visualizationState = getCurrentVisualizationState();
    const selectedData = getSelectedData();
    
    // Initialize metrics
    const metrics = {
        totalInstallations: solarData ? solarData.length : 0,
        avgSize: solarData ? d3.mean(solarData, d => +d.Acres) : 0,
        installationTypes: solarData ? d3.rollup(solarData, v => v.length, d => d["Install Type"]) : new Map(),
        urbanRural: solarData ? d3.rollup(solarData, v => v.length, d => d["Urban or Rural"]) : new Map(),
        avgGridDistance: solarData ? d3.mean(solarData, d => +d["Distance to Substation (Miles) CAISO"]) : 0
    };
    
    return {
        visualization: visualizationState ? {
            type: visualizationState.type,
            filters: visualizationState.filters,
            metrics: visualizationState.metrics
        } : null,
        data: {
            selected: selectedData,
            summary: selectedData ? generateDataSummary(selectedData) : null
        },
        userSelection: {
            county: document.getElementById('countyFilter')?.value || 'all',
            view: document.querySelector('.active')?.dataset?.view || 'default'
        },
        metrics: metrics
    };
}

function getVisibleCharts() {
    // Get all visible chart containers
    const charts = Array.from(document.querySelectorAll('.chart-container')).map(container => {
        const title = container.closest('.chart-card')?.querySelector('.chart-title')?.textContent;
        const isVisible = container.offsetParent !== null;
        return { title, isVisible };
    });

    return charts.filter(chart => chart.isVisible);
}

function getChartData() {
    // Get current chart data based on page
    const data = {};
    
    switch (chatbotState.context.currentPage) {
        case 'land-use':
            // Get land use data
            const landUseChart = document.getElementById('landuse-chart');
            if (landUseChart && landUseChart.__chartData) {
                data.landUse = landUseChart.__chartData;
            }
            break;
        // Add cases for other pages
    }

    return data;
}

function updateContextMessage() {
    const county = chatbotState.context.selectedCounty;
    if (county) {
        addMessage('system', `I notice you're looking at data for ${county} County. How can I help you analyze this area?`);
    }
}

// Utility Functions
function incrementUnreadCount() {
    chatbotState.unreadCount++;
    updateUnreadBadge();
}

function resetUnreadCount() {
    chatbotState.unreadCount = 0;
    updateUnreadBadge();
}

function updateUnreadBadge() {
    if (chatbotState.unreadCount > 0) {
        unreadBadge.textContent = chatbotState.unreadCount;
        unreadBadge.style.display = 'block';
    } else {
        unreadBadge.style.display = 'none';
    }
}

// Update connection status
function updateConnectionStatus(isConnected) {
    chatbotState.isConnected = isConnected;
    const statusIndicator = document.querySelector('.chatbot-status');
    if (statusIndicator) {
        statusIndicator.className = `chatbot-status ${isConnected ? 'connected' : 'disconnected'}`;
        statusIndicator.title = isConnected ? 'Connected to LM Studio' : 'Not connected to LM Studio';
    }
}

// Export for potential use in other scripts
window.chatbotState = chatbotState;

// Test function that can be called from browser console
window.testLMStudio = async function() {
    console.log('=== Testing LM Studio Connection ===');
    
    try {
        // Test 1: Basic server check
        console.log('\n1. Testing if server is reachable...');
        try {
            const serverResponse = await fetch('http://localhost:1234/v1/models');
            console.log('Server response status:', serverResponse.status);
            if (serverResponse.ok) {
                const data = await serverResponse.json();
                console.log('Server is reachable! Available models:', data);
            } else {
                console.error('Server returned error:', serverResponse.status);
                return;
            }
        } catch (e) {
            console.error('Cannot reach server. Make sure LM Studio is running and server is enabled.');
            console.error('Error:', e);
            return;
        }
        
        // Test 2: Simple chat completion
        console.log('\n2. Testing chat completion...');
        const model = LM_STUDIO_API.currentModel || 'mistral-7b-instruct-v0.3';
        
        const testRequest = {
            messages: [
                {
                    role: 'user',
                    content: 'Say hello'
                }
            ],
            model: model,
            max_tokens: 10
        };
        
        console.log('Sending request:', testRequest);
        
        try {
            const response = await fetch(LM_STUDIO_API.url, {
                method: 'POST',
                headers: LM_STUDIO_API.headers,
                body: JSON.stringify(testRequest)
            });
            
            console.log('Response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Chat completion successful!');
                console.log('Response:', data);
            } else {
                const errorText = await response.text();
                console.error('Chat completion failed:', errorText);
            }
        } catch (e) {
            console.error('Chat completion error:', e);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
    
    console.log('\n=== Test Complete ===');
}; 