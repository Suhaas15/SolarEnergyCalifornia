// Common JavaScript utilities shared across all pages

// Utility Functions
function formatNumber(num) {
  // Handle undefined, null, or non-numeric values
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }
  
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function getChartDimensions(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found:', containerId);
    return { width: 0, height: 0, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
  }
  
  // Get the container's computed dimensions
  const containerRect = container.getBoundingClientRect();
  const width = Math.max(containerRect.width, 300); // Minimum width of 300px
  const height = Math.max(containerRect.height, 250); // Minimum height of 250px
  
  // Define margins based on container size with more space for labels
  const margin = {
    top: Math.max(Math.round(height * 0.12), 25),     // 12% of height, min 25px
    right: Math.max(Math.round(width * 0.12), 60),    // 12% of width, min 60px for legends
    bottom: Math.max(Math.round(height * 0.2), 50),   // 20% of height, min 50px for labels
    left: Math.max(Math.round(width * 0.18), 70)      // 18% of width, min 70px for y-axis labels
  };

  console.log('Chart dimensions for', containerId, ':', { width, height, margin });
  
  return { width, height, margin };
}

// Color Scales
const colorScales = {
  // Installation types - using subtle, modern colors
  installationType: d3.scaleOrdinal()
    .domain(["Rooftop", "Ground", "Parking"])
    .range(["#3B82F6", "#6366F1", "#14B8A6"]),
  
  // Urban/Rural distinction - using natural tones
  urbanRural: d3.scaleOrdinal()
    .domain(["Urban", "Rural"])
    .range(["#3B82F6", "#10B981"]),
  
  // Sequential scale for metrics
  metrics: d3.scaleSequential()
    .interpolator(d3.interpolateBlues),
  
  // Diverging scale for comparisons
  comparison: d3.scaleSequential()
    .interpolator(d3.interpolateCool),
  
  // Categorical scale for counties
  counties: d3.scaleOrdinal()
    .range([
      "#3B82F6", // Blue
      "#6366F1", // Indigo
      "#14B8A6", // Teal
      "#10B981", // Emerald
      "#0EA5E9", // Sky
      "#64748B", // Slate
      "#6B7280", // Neutral
      "#78716C", // Stone
      "#71717A", // Zinc
      "#4B5563"  // Gray
    ]),
  
  // Network specific colors
  network: {
    node: "#3B82F6",
    link: "#6366F1",
    highlight: "#14B8A6",
    background: "#ffffff"
  },
  
  // Infrastructure specific colors
  infrastructure: {
    installation: "#3B82F6",
    substation: "#6366F1",
    connection: "#14B981",
    background: "#ffffff"
  }
};

// Tooltip positioning function
function positionTooltip(event, tooltip) {
  const tooltipNode = tooltip.node();
  const tooltipRect = tooltipNode.getBoundingClientRect();
  const padding = 10;
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Calculate initial position
  let left = event.pageX + padding;
  let top = event.pageY + padding;
  
  // Adjust if tooltip would go off right edge
  if (left + tooltipRect.width > viewportWidth) {
    left = event.pageX - tooltipRect.width - padding;
  }
  
  // Adjust if tooltip would go off bottom edge
  if (top + tooltipRect.height > viewportHeight) {
    top = event.pageY - tooltipRect.height - padding;
  }
  
  // Apply position
  tooltip
    .style('left', `${left}px`)
    .style('top', `${top}px`);
}

// Calculate carbon offset based on installation size and type
function calculateCarbonOffset(acres, installType) {
  // Convert acres to square meters
  const areaM2 = acres * 4046.86;
  
  // Efficiency factors based on installation type
  const efficiencyFactors = {
    'Rooftop': 0.9,  // Better angle and maintenance
    'Ground': 0.85,  // Some shading and dust
    'Parking': 0.8   // Some obstruction and suboptimal angle
  };
  
  const efficiency = efficiencyFactors[installType] || 0.85;
  
  // Calculate annual production in kWh
  // Area * efficiency * (250W/m2) * 5.5 hours * 365 days * conversion to kWh
  const annualProduction = areaM2 * efficiency * 0.25 * 5.5 * 365 / 1000;
  
  // Convert to carbon offset (tons)
  // 0.5 kg CO2 per kWh, convert to tons (divide by 1000)
  return (annualProduction * 0.5 / 1000).toFixed(2);
}

// Store actual data ranges globally after loading
window.actualDataRanges = {
  acres: { min: 0, max: 100 }, // Default values, will be updated
  avgDistance: { min: 0, max: 50 } // Default values, will be updated
};

// Data Loading and Initialization
async function loadData() {
  try {
    document.querySelectorAll('.loading-overlay').forEach(el => el.style.display = 'flex');

    // Load Cleaned_Solar_Data.csv first for range calculation and primary data source
    console.log('Starting to load solar data...');
    const solarDataCSV = await d3.csv('Cleaned_Solar_Data.csv');
    console.log('Solar data loaded:', solarDataCSV?.length, 'records');

    if (!solarDataCSV || !Array.isArray(solarDataCSV)) {
      throw new Error('Failed to load solar data or data is not in expected format');
    }

    // Calculate actual min/max for Acres and Avg_Distance_Substation
    let minAcres = Infinity, maxAcres = 0;
    let minDistance = Infinity, maxDistance = 0;

    solarDataCSV.forEach(d => {
      const acres = +d.Acres;
      const distanceCAISO = +d['Distance to Substation (Miles) CAISO'];
      const avgDistance = +d.Avg_Distance_Substation;

      if (!isNaN(acres) && acres > 0) {
        if (acres < minAcres) minAcres = acres;
        if (acres > maxAcres) maxAcres = acres;
      }
      
      // Use CAISO distance as primary, fallback to avg distance
      const distance = !isNaN(distanceCAISO) ? distanceCAISO : avgDistance;
      if (!isNaN(distance) && distance > 0) {
        if (distance < minDistance) minDistance = distance;
        if (distance > maxDistance) maxDistance = distance;
      }
    });

    window.actualDataRanges = { 
      min: minAcres === Infinity ? 0 : Math.floor(minAcres), 
      max: maxAcres === 0 ? 100 : Math.ceil(maxAcres) 
    };
    window.actualDataRanges.avgDistance = { 
      min: minDistance === Infinity ? 0 : Math.floor(minDistance), 
      max: maxDistance === 0 ? 50 : Math.ceil(maxDistance) 
    };
    
    console.log('Actual Data Ranges Calculated:', window.actualDataRanges);

    // Process the solar data for the application
    window.currentSolarData = solarDataCSV.map(d => {
      // Validate required fields
      if (!d.County) {
        console.warn('Record missing County:', d);
      }
      
      return {
        County: d.County,
        Acres: +d.Acres || 0,
        "Install Type": d["Install Type"],
        "Urban or Rural": d["Urban or Rural"],
        Avg_Distance_Substation: +d.Avg_Distance_Substation || 0,
        Infrastructure_Score: +d.Infrastructure_Score || 0,
        "Distance to Substation (Miles) CAISO": +d["Distance to Substation (Miles) CAISO"] || 0,
        Size_Category: d.Size_Category,
        Grid_Zone: d.Grid_Zone,
        OBJECTID: d.OBJECTID,
        Combined_Class: d.Combined_Class,
        Carbon_Offset_tons: +d.Carbon_Offset_tons || 0
      };
    });

    console.log('Processed solar data:', window.currentSolarData?.length, 'records');

    // Load County_Sustainability_Metrics.csv if needed for other parts
    let sustainabilityData = [];
    try {
        console.log('Loading sustainability data...');
        sustainabilityData = await d3.csv('County_Sustainability_Metrics.csv');
        window.currentSustainabilityData = sustainabilityData;
        console.log('Sustainability data loaded:', sustainabilityData?.length, 'records');
    } catch (sustainabilityError) {
        console.warn('Could not load sustainability data:', sustainabilityError);
        window.currentSustainabilityData = [];
    }

    // Initialize the current page after data is loaded
    if (typeof initializeCurrentPage === 'function') {
      console.log('Calling initializeCurrentPage with data...');
      initializeCurrentPage(window.currentSolarData, window.currentSustainabilityData);
    } else {
      console.warn('initializeCurrentPage function not found');
    }

    document.querySelectorAll('.loading-overlay').forEach(el => el.style.display = 'none');

    return {
      solarData: window.currentSolarData,
      sustainabilityData: window.currentSustainabilityData
    };

  } catch (error) {
    console.error('Error loading data:', error);
    document.querySelectorAll('.loading-overlay').forEach(el => {
      el.innerHTML = `
        <div class="alert alert-danger">
          <strong>Error Loading Data:</strong> ${error.message}
        </div>
      `;
    });
    throw error;
  }
} 

// Standardized formatting functions to ensure consistency across dropdowns, tooltips, and metrics
function formatInstallationType(type) {
    const typeMap = {
        'Rooftop': '🏠 Rooftop Solar',
        'Ground': '🌾 Ground-Mount Solar', 
        'Parking': '🅿️ Parking Lot Solar'
    };
    return typeMap[type] || type;
}

function formatAreaType(area) {
    const areaMap = {
        'Urban': '🏙️ Urban Areas',
        'Rural': '🌲 Rural Areas'
    };
    return areaMap[area] || area;
}

function formatSizeCategory(acres) {
    const size = parseFloat(acres);
    if (isNaN(size)) return 'Unknown Size';
    
    if (size < 5) return 'Small (0-5 acres)';
    if (size < 10) return 'Medium (5-10 acres)';
    if (size < 15) return 'Large (10-15 acres)';
    if (size < 25) return 'Very Large (15-25 acres)';
    return 'Mega Projects (25+ acres)';
}

function formatDistanceCategory(miles) {
    const distance = parseFloat(miles);
    if (isNaN(distance)) return 'Unknown Distance';
    
    if (distance < 5) return 'Very Close (0-5 miles)';
    if (distance < 10) return 'Close (5-10 miles)';
    if (distance < 15) return 'Moderate (10-15 miles)';
    if (distance < 25) return 'Far (15-25 miles)';
    return 'Very Far (25+ miles)';
}

function formatMetricValue(value, type) {
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    
    switch (type) {
        case 'acres':
            return num.toFixed(2) + ' acres';
        case 'miles': 
            return num.toFixed(1) + ' miles';
        case 'count':
            return num.toLocaleString();
        case 'percentage':
            return num.toFixed(1) + '%';
        default:
            return num.toLocaleString();
    }
} 