// Land Use Page JavaScript

// Page initialization
function initializeCurrentPage(solarData, sustainabilityData) {
  console.log('Initializing Land Use page with', solarData?.length, 'records');
  
  // Store data globally for access by filter functions
  window.currentSolarData = solarData;
  window.currentSustainabilityData = sustainabilityData;
  
  // Initialize county filter options with error handling
  const countyFilter = document.getElementById('countyFilter');
  if (!countyFilter) {
    console.error('County filter element not found');
    return;
  }

  if (!solarData || !Array.isArray(solarData)) {
    console.error('Solar data is not available or not an array:', solarData);
    return;
  }

  try {
    // Get unique counties and remove any undefined/null values
    const counties = [...new Set(solarData.map(d => d.County).filter(Boolean))].sort();
    console.log('Found counties:', counties);
    
    if (counties.length === 0) {
      console.error('No counties found in solar data');
      return;
    }

    countyFilter.innerHTML = `
      <option value="">All Counties (${counties.length})</option>
      ${counties.map(county => `<option value="${county}">${county}</option>`).join('')}
    `;
    console.log('County filter populated with', counties.length, 'counties');

    // Add event listeners to all filters
    const installationTypeFilter = document.getElementById('installationTypeFilter');
    const sizeFilter = document.getElementById('sizeFilter');

    // Function to handle filter changes
    const handleFilterChange = () => {
      const selectedCounty = countyFilter.value;
      const selectedInstallType = installationTypeFilter.value;
      const selectedSize = sizeFilter.value;
      
      console.log('Filter changed:', {
        county: selectedCounty,
        installType: selectedInstallType,
        size: selectedSize
      });
      
      updateLandUseWithFilters(selectedCounty, selectedInstallType, selectedSize);
    };

    // Add change event listeners to all filters
    countyFilter.addEventListener('change', handleFilterChange);
    installationTypeFilter.addEventListener('change', handleFilterChange);
    sizeFilter.addEventListener('change', handleFilterChange);
    
    console.log('Filter event listeners added');

  } catch (error) {
    console.error('Error setting up filters:', error);
  }

  // Initial visualization update - wait a bit for DOM to be ready
  setTimeout(() => {
    console.log('Triggering initial land use visualization');
    updateLandUseWithFilters('', 'all', 'all');
  }, 100);

  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const county = countyFilter ? countyFilter.value : '';
      const installType = document.getElementById('installationTypeFilter')?.value || 'all';
      const sizeCategory = document.getElementById('sizeFilter')?.value || 'all';
      updateLandUseWithFilters(county, installType, sizeCategory);
    }, 250);
  });
}

// Update all visualizations for the land use page
function updateCurrentVisualizations(solarData, sustainabilityData, county) {
  const installType = document.getElementById('installationTypeFilter')?.value || 'all';
  const sizeCategory = document.getElementById('sizeFilter')?.value || 'all';
  updateLandUseVisualizations(solarData, county, installType, sizeCategory);
}

// Land Use Page Functions
function updateLandUseVisualizations(data, county, installType = 'all', sizeCategory = 'all') {
  console.log('Initializing land use visualizations...', { county, installType, sizeCategory });
  
  // Check if we're on the land use page
  if (document.getElementById('landuse-chart')) {
    console.log('Found landuse-chart container');
    
    // Update metrics first and get filtered data
    const filteredData = updateKeyMetrics(data, county, installType, sizeCategory);
    
    try {
      // Draw each chart with error handling
      console.log('Drawing land use distribution chart...');
      drawLandUseChart(filteredData, county);
      
      console.log('Drawing sustainability matrix...');
      drawSustainabilityMatrix(filteredData, county);
      
      console.log('Drawing size optimization chart...');
      drawSizeOptimizationChart(filteredData, county);
      
      console.log('Drawing urban/rural efficiency chart...');
      drawUrbanRuralEfficiency(filteredData, county);
      
      // Generate insights last
      generateInsights(filteredData, county);
      
      console.log('All visualizations completed successfully');
    } catch (error) {
      console.error('Error updating visualizations:', error);
    }
  } else {
    console.log('Not on land use page - landuse-chart container not found');
  }
}

// Global function to handle filter updates from HTML
function updateLandUseWithFilters(county, installType, sizeCategory) {
  console.log('updateLandUseWithFilters called with:', { county, installType, sizeCategory });
  
  // Get the current data - we need to access it from the global scope
  if (window.currentSolarData && window.currentSolarData.length > 0) {
    console.log('Data available, updating visualizations with', window.currentSolarData.length, 'records');
    updateLandUseVisualizations(window.currentSolarData, county, installType, sizeCategory);
  } else {
    console.warn('Solar data not available for filtering. Available data:', window.currentSolarData?.length || 'none');
    
    // Try to wait for data to be loaded
    setTimeout(() => {
      if (window.currentSolarData && window.currentSolarData.length > 0) {
        console.log('Data became available, retrying visualization');
        updateLandUseVisualizations(window.currentSolarData, county, installType, sizeCategory);
      } else {
        console.error('Data still not available after waiting');
      }
    }, 500);
  }
}

// Update key metrics for the land use page
function updateKeyMetrics(data, county, installType = 'all', sizeCategory = 'all') {
  console.log('Filtering data with:', { county, installType, sizeCategory });
  console.log('Initial data count:', data.length);
  
  // Filter data based on selected filters
  let filteredData = [...data];
  
  if (county) {
    filteredData = filteredData.filter(d => d.County === county);
    console.log('After county filter:', filteredData.length, 'records');
  }
  
  if (installType !== 'all') {
    filteredData = filteredData.filter(d => {
      const matches = d['Install Type'] === installType;
      if (!matches) {
        console.log('Non-matching install type:', d['Install Type'], 'expected:', installType);
      }
      return matches;
    });
    console.log('After installation type filter:', filteredData.length, 'records');
  }
  
  if (sizeCategory !== 'all') {
    filteredData = filteredData.filter(d => {
      const acres = parseFloat(d.Acres || 0);
      if (isNaN(acres)) {
        console.log('Invalid acres value:', d.Acres);
        return false;
      }
      
      let matches = false;
      switch(sizeCategory) {
        case 'Small(<1)':
          matches = acres < 1;
          break;
        case 'Medium(1-5)':
          matches = acres >= 1 && acres < 5;
          break;
        case 'Large(5-10)':
          matches = acres >= 5 && acres < 10;
          break;
        case 'X-Large(10+)':
          matches = acres >= 10;
          break;
        default:
          matches = true;
      }
      
      if (!matches) {
        console.log('Non-matching size:', acres, 'acres for category:', sizeCategory);
      }
      return matches;
    });
    console.log('After size category filter:', filteredData.length, 'records');
  }
  
  // Calculate metrics
  const totalInstallations = filteredData.length;
  const totalAcres = d3.sum(filteredData, d => {
    const acres = +(d.Acres || 0);
    if (isNaN(acres)) {
      console.warn('Invalid acres value found:', d.Acres);
      return 0;
    }
    return acres;
  });
  
  const avgSize = d3.mean(filteredData, d => {
    const acres = +(d.Acres || 0);
    if (isNaN(acres)) {
      console.warn('Invalid acres value found for mean:', d.Acres);
      return 0;
    }
    return acres;
  }) || 0;
  
  const avgDistance = d3.mean(filteredData, d => {
    const dist = +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0);
    if (isNaN(dist)) {
      console.warn('Invalid distance value found:', d.Avg_Distance_Substation, d['Distance to Substation (Miles) CAISO']);
      return 0;
    }
    return dist;
  }) || 0;
  
  const avgInfrastructureScore = d3.mean(filteredData, d => {
    const score = +(d.Infrastructure_Score || 0);
    if (isNaN(score)) {
      console.warn('Invalid infrastructure score found:', d.Infrastructure_Score);
      return 0;
    }
    return score;
  }) || 0;
  
  // Type distribution
  const typeDistribution = d3.rollup(filteredData, v => v.length, d => d['Install Type']);
  const rooftopCount = typeDistribution.get('Rooftop') || 0;
  const groundCount = typeDistribution.get('Ground') || 0;
  const parkingCount = typeDistribution.get('Parking') || 0;
  
  console.log('Installation type distribution:', {
    Rooftop: rooftopCount,
    Ground: groundCount,
    Parking: parkingCount
  });
  
  // Urban/Rural distribution
  const locationDistribution = d3.rollup(filteredData, v => v.length, d => d['Urban or Rural']);
  const urbanCount = locationDistribution.get('Urban') || 0;
  const ruralCount = locationDistribution.get('Rural') || 0;
  
  console.log('Location distribution:', {
    Urban: urbanCount,
    Rural: ruralCount
  });
  
  // Size distribution
  const sizeDistribution = new Map();
  filteredData.forEach(d => {
    const acres = parseFloat(d.Acres || 0);
    let category;
    if (acres < 1) category = 'Small(<1)';
    else if (acres < 5) category = 'Medium(1-5)';
    else if (acres < 10) category = 'Large(5-10)';
    else category = 'X-Large(10+)';
    
    sizeDistribution.set(category, (sizeDistribution.get(category) || 0) + 1);
  });
  
  const smallCount = sizeDistribution.get('Small(<1)') || 0;
  const mediumCount = sizeDistribution.get('Medium(1-5)') || 0;
  const largeCount = sizeDistribution.get('Large(5-10)') || 0;
  const xlargeCount = sizeDistribution.get('X-Large(10+)') || 0;
  
  console.log('Size distribution:', {
    'Small(<1)': smallCount,
    'Medium(1-5)': mediumCount,
    'Large(5-10)': largeCount,
    'X-Large(10+)': xlargeCount
  });
  
  // Update DOM elements
  const updateElement = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
      console.log('Updated', id, 'to:', value);
    } else {
      console.warn('Element not found:', id);
    }
  };
  
  updateElement('total-installations', formatNumber(totalInstallations));
  updateElement('total-acres', formatNumber(totalAcres) + ' acres');
  updateElement('avg-efficiency', avgInfrastructureScore.toFixed(1) + '%');
  updateElement('carbon-offset', formatNumber(totalAcres * 0.5) + ' tons CO₂/year');
  
  console.log('Final metrics:', {
    totalInstallations,
    totalAcres,
    avgInfrastructureScore,
    avgSize,
    avgDistance
  });
  
  return filteredData;
}

// Draw sustainability matrix
function drawSustainabilityMatrix(data, county) {
  console.log('drawSustainabilityMatrix called with', data?.length, 'records');
  
  const container = document.getElementById('sustainability-matrix');
  if (!container) {
    console.error('sustainability-matrix container not found');
    return;
  }
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const { width, height, margin } = getChartDimensions('sustainability-matrix');
  
  container.innerHTML = '';
  
  // Hide loading overlay
  const loadingOverlay = document.getElementById('loading-sustainability');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Calculate scales with proper padding
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(filteredData, d => d.Infrastructure_Score) * 1.1])
    .range([0, chartWidth]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(filteredData, d => d.Acres) * 1.1])
    .range([chartHeight, 0]);

  // Add circles with enhanced tooltip
  chart.selectAll('circle')
    .data(filteredData)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.Infrastructure_Score))
    .attr('cy', d => yScale(d.Acres))
    .attr('r', 5)
    .attr('fill', d => colorScales.counties(d.County))
    .attr('opacity', 0.7)
    .on('mouseover', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 1)
        .attr('r', 7);
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        const tooltipContent = `
          <div class="tooltip-content">
            <h6 class="mb-2">${d.County}</h6>
            <div class="tooltip-details">
              <p class="mb-1"><strong>Installations:</strong> ${formatNumber(d.count || 1)}</p>
              <p class="mb-1"><strong>Average Size:</strong> ${formatNumber(d.Acres)} acres</p>
              <p class="mb-0"><strong>Infrastructure Score:</strong> ${formatNumber(d.Infrastructure_Score)}</p>
            </div>
          </div>
        `;
        
        tooltip
          .style('display', 'block')
          .html(tooltipContent)
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mousemove', function(event) {
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mouseout', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 0.7)
        .attr('r', 5);
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('opacity', 0)
          .style('display', 'none');
      }
    });

  // Add axes with better formatting
  chart.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .style('font-size', '10px');

  chart.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .style('font-size', '10px');

  // Add axis labels
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 8)
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '500')
    .style('fill', '#4B5563')
    .text('Infrastructure Score');

  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 20)
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '500')
    .style('fill', '#4B5563')
    .text('Average Installation Size (acres)');

  // Add title
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', -margin.top / 2)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .style('fill', '#333')
    .text('Sustainability Impact Matrix');
}

// Draw size optimization chart
function drawSizeOptimizationChart(data, county) {
  console.log('drawSizeOptimizationChart called with', data?.length, 'records');
  
  const container = document.getElementById('size-optimization-chart');
  if (!container) {
    console.error('size-optimization-chart container not found');
    return;
  }
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const { width, height, margin } = getChartDimensions('size-optimization-chart');
  
  container.innerHTML = '';
  
  // Hide loading overlay
  const loadingOverlay = document.getElementById('loading-size');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Calculate the radius based on the smaller dimension to ensure the chart fits
  const radius = Math.min(width, height) * 0.45; // Larger pie chart since container unchanged
  
  const chart = svg.append('g')
    .attr('transform', `translate(${width/2},${height/2})`);
  
  // Group by size category
  const sizeGroups = new Map();
  filteredData.forEach(d => {
    const acres = parseFloat(d.Acres || 0);
    let category;
    if (acres < 1) category = 'Small(<1)';
    else if (acres < 5) category = 'Medium(1-5)';
    else if (acres < 10) category = 'Large(5-10)';
    else category = 'X-Large(10+)';
    
    if (!sizeGroups.has(category)) sizeGroups.set(category, []);
    sizeGroups.get(category).push(d);
  });
  
  const sizeData = Array.from(sizeGroups, ([category, items]) => ({
    category,
    count: items.length,
    totalAcres: d3.sum(items, d => +(d.Acres || 0)),
    avgDistance: d3.mean(items, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0))
  }));

  const categories = ['Small(<1)', 'Medium(1-5)', 'Large(5-10)', 'X-Large(10+)'];
  const orderedData = categories.map(cat => 
    sizeData.find(d => d.category === cat) || { category: cat, count: 0, totalAcres: 0, avgDistance: 0 }
  );

  // Enhanced color scheme for better distinction
  const colorScale = d3.scaleOrdinal()
    .domain(categories)
    .range(['#2563EB', '#059669', '#DC2626', '#7C3AED', '#EA580C', '#0891B2']); // Vibrant, distinct colors

  // Create pie layout
  const pie = d3.pie()
    .value(d => d.totalAcres)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.45) // Slightly smaller inner radius for better visibility
    .outerRadius(radius)
    .cornerRadius(3); // Rounded corners for modern look

  const outerArc = d3.arc()
    .innerRadius(radius * 1.2)
    .outerRadius(radius * 1.2);

  // Add arcs
  const arcs = chart.selectAll('.arc')
    .data(pie(orderedData))
    .enter()
    .append('g')
    .attr('class', 'arc');

  // Add paths with enhanced tooltip and animations
  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => colorScale(d.data.category))
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 3)
    .attr('opacity', 0.9)
    .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
    .on('mouseover', function(event, d) {
      // Enhanced highlight with scale and glow
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1.05)')
        .attr('opacity', 1)
        .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
      
      // Show tooltip
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        const percentage = ((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1);
        const tooltipContent = `
          <div class="tooltip-content" style="color: white; border-radius: 12px; padding: 12px;">
            <h6 class="mb-2" style="color: #FFD700; font-weight: 700;">📊 ${d.data.category}</h6>
            <div class="tooltip-details">
              <p class="mb-1"><strong>🔢 Installations:</strong> ${formatNumber(d.data.count)}</p>
              <p class="mb-1"><strong>🏞️ Total Area:</strong> ${formatNumber(d.data.totalAcres)} acres</p>
              <p class="mb-1"><strong>⚡ Avg Distance:</strong> ${formatNumber(d.data.avgDistance)} miles</p>
              <p class="mb-0"><strong>📈 Share:</strong> ${percentage}% of total</p>
            </div>
          </div>
        `;
        
        tooltip
          .style('display', 'block')
          .html(tooltipContent)
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mousemove', function(event) {
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mouseout', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1)')
        .attr('opacity', 0.9)
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('opacity', 0)
          .style('display', 'none');
      }
    });

  // Add title with improved positioning
  chart.append('text')
    .attr('y', -radius - 20)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .style('fill', '#333')
    .text('Project Size Distribution');

  // Add center text with improved styling
  chart.append('text')
    .attr('dy', '-0.5em')
    .style('text-anchor', 'middle')
    .style('font-size', '14px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text('Total Area');

  chart.append('text')
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#666')
    .text(formatNumber(d3.sum(orderedData, d => d.totalAcres)) + ' acres');

  // Add legend for better understanding
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 150}, 30)`);

  const legendItems = legend.selectAll('.legend-item')
    .data(orderedData)
    .enter()
    .append('g')
    .attr('class', 'legend-item')
    .attr('transform', (d, i) => `translate(0, ${i * 20})`);

  legendItems.append('rect')
    .attr('width', 12)
    .attr('height', 12)
    .attr('rx', 2)
    .attr('fill', d => colorScale(d.category))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1);

  legendItems.append('text')
    .attr('x', 18)
    .attr('y', 6)
    .attr('dy', '0.35em')
    .style('font-size', '10px')
    .style('font-weight', '500')
    .style('fill', '#4B5563')
    .text(d => {
      const percentage = ((d.totalAcres / d3.sum(orderedData, item => item.totalAcres)) * 100).toFixed(1);
      return `${d.category} (${percentage}%)`;
    });
}

// Draw urban/rural efficiency chart
function drawUrbanRuralEfficiency(data, county) {
  console.log('drawUrbanRuralEfficiency called with', data?.length, 'records');
  
  const container = document.getElementById('urban-rural-efficiency');
  if (!container) {
    console.error('urban-rural-efficiency container not found');
    return;
  }
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const { width, height, margin } = getChartDimensions('urban-rural-efficiency');
  
  container.innerHTML = '';
  
  // Hide loading overlay
  const loadingOverlay = document.getElementById('loading-urban');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Group by location and type
  const barData = Array.from(d3.rollup(filteredData,
    v => ({
      count: v.length,
      totalAcres: d3.sum(v, d => +(d.Acres || 0)),
      avgSize: d3.mean(v, d => +(d.Acres || 0))
    }),
    d => d["Urban or Rural"],
    d => d["Install Type"]
  ), ([location, types]) => 
    Array.from(types, ([type, data]) => ({
      location,
      type,
      ...data
    }))
  ).flat();

  const xScale = d3.scaleBand()
    .domain(barData.map(d => `${d.location} - ${d.type}`))
    .range([0, chartWidth])
    .padding(0.2); // Increased padding for better separation

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(barData, d => d.count) * 1.1])
    .range([chartHeight, 0]);

  // Enhanced gradient definitions for bars
  const defs = svg.append('defs');
  
  // Urban gradient
  const urbanGradient = defs.append('linearGradient')
    .attr('id', 'urbanGradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  urbanGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#3B82F6');
  urbanGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#1E40AF');

  // Rural gradient  
  const ruralGradient = defs.append('linearGradient')
    .attr('id', 'ruralGradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%');
  ruralGradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#10B981');
  ruralGradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#047857');

  // Draw bars with enhanced styling
  chart.selectAll('.bar')
    .data(barData)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(`${d.location} - ${d.type}`))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', d => d.location === 'Urban' ? 'url(#urbanGradient)' : 'url(#ruralGradient)')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 1)
    .attr('rx', 4)
    .attr('ry', 4)
    .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
    .on('mouseover', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 1)
        .attr('stroke-width', 2)
        .attr('stroke', '#FFD700')
        .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))');
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        const tooltipContent = `
          <div class="tooltip-content">
            <h6 class="mb-2" style="color: #FFD700;">🏙️ ${d.location} - ${d.type}</h6>
            <div class="tooltip-details">
              <p class="mb-1"><strong>📊 Installations:</strong> ${formatNumber(d.count)}</p>
              <p class="mb-1"><strong>🏞️ Total Area:</strong> ${formatNumber(d.totalAcres)} acres</p>
              <p class="mb-0"><strong>📏 Avg Size:</strong> ${formatNumber(d.avgSize)} acres</p>
            </div>
          </div>
        `;
        
        tooltip
          .style('display', 'block')
          .html(tooltipContent)
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mousemove', function(event) {
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mouseout', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 0.9)
        .attr('stroke-width', 1)
        .attr('stroke', '#ffffff')
        .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('opacity', 0)
          .style('display', 'none');
      }
    })
    .transition()
    .duration(600)
    .attr('y', d => yScale(d.count))
    .attr('height', d => chartHeight - yScale(d.count));

  // Add axes with better formatting
  const xAxis = chart.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale));

  // Rotate x-axis labels to prevent overlap with better spacing
  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-1.2em')
    .attr('dy', '0.5em')
    .attr('transform', 'rotate(-45)')
    .style('font-size', '8px')
    .style('font-weight', '500');

  // Add y-axis with better formatting
  chart.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .style('font-size', '9px');

  // Add axis labels with better positioning
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 15)
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .style('fill', '#4B5563')
    .text('Location and Installation Type');

  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 25)
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .style('fill', '#4B5563')
    .text('Number of Installations');

  // Add title
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', -margin.top / 2)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .style('fill', '#333')
    .text('Urban vs Rural Installation Distribution');
}

// Draw land use chart
function drawLandUseChart(data, county) {
  console.log('drawLandUseChart called with', data?.length, 'records, county:', county);
  
  const container = document.getElementById('landuse-chart');
  if (!container) {
    console.error('landuse-chart container not found');
    return;
  }
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  console.log('Filtered data for land use chart:', filteredData.length, 'records');
  
  const { width, height, margin } = getChartDimensions('landuse-chart');
  
  container.innerHTML = '';
  
  // Hide loading overlay
  const loadingOverlay = document.getElementById('loading-landuse');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Group by installation type
  const typeData = Array.from(d3.rollup(filteredData,
    v => ({
      count: v.length,
      totalAcres: d3.sum(v, d => +(d.Acres || 0)),
      avgSize: d3.mean(v, d => +(d.Acres || 0)),
      avgDistance: d3.mean(v, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0))
    }),
    d => d["Install Type"]
  ), ([type, data]) => ({ type, ...data }));

  const xScale = d3.scaleBand()
    .domain(typeData.map(d => d.type))
    .range([0, chartWidth])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(typeData, d => d.totalAcres) * 1.1])
    .range([chartHeight, 0]);

  // Draw bars with enhanced tooltip
  chart.selectAll('.bar')
    .data(typeData)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.type))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', d => colorScales.installationType(d.type))
    .on('mouseover', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 0.8);
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        const tooltipContent = `
          <div class="tooltip-content">
            <h6 class="mb-2">${d.type}</h6>
            <div class="tooltip-details">
              <p class="mb-1"><strong>Total Area:</strong> ${formatNumber(d.totalAcres)} acres</p>
              <p class="mb-1"><strong>Number of Installations:</strong> ${formatNumber(d.count)}</p>
              <p class="mb-1"><strong>Average Size:</strong> ${formatNumber(d.avgSize)} acres</p>
              <p class="mb-0"><strong>Average Grid Distance:</strong> ${formatNumber(d.avgDistance)} miles</p>
            </div>
          </div>
        `;
        
        tooltip
          .style('display', 'block')
          .html(tooltipContent)
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mousemove', function(event) {
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      }
    })
    .on('mouseout', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('opacity', 1);
      
      const tooltip = d3.select('#tooltip');
      if (!tooltip.empty()) {
        tooltip
          .style('opacity', 0)
          .style('display', 'none');
      }
    })
    .transition()
    .duration(600)
    .attr('y', d => yScale(d.totalAcres))
    .attr('height', d => chartHeight - yScale(d.totalAcres));

  // Add axes with better formatting
  const xAxis = chart.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale));

  // Rotate x-axis labels to prevent overlap with better spacing
  xAxis.selectAll('text')
    .style('text-anchor', 'end')
    .attr('dx', '-1.2em')
    .attr('dy', '0.5em')
    .attr('transform', 'rotate(-45)')
    .style('font-size', '9px')
    .style('font-weight', '500');

  // Add y-axis with better formatting
  chart.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .style('font-size', '9px');

  // Add axis labels with better positioning
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 15)
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .style('fill', '#4B5563')
    .text('Installation Type');

  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 25)
    .style('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', '600')
    .style('fill', '#4B5563')
    .text('Total Area (acres)');

  // Add title
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', -margin.top / 2)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', '500')
    .style('fill', '#333')
    .text('Land Use Distribution');
}

// Helper function for installation type descriptions
function getInstallationTypeDescription(type) {
  const descriptions = {
    'Rooftop': 'Solar panels mounted on building rooftops, maximizing unused space and providing direct power to buildings.',
    'Ground': 'Ground-mounted solar arrays, typically larger installations in open areas.',
    'Parking': 'Solar canopies installed over parking lots, providing both power generation and shade.'
  };
  return descriptions[type] || 'Solar installation type';
}

// Generate insights
function generateInsights(data, county) {
  const filteredData = county ? data.filter(d => d.County === county) : data;
  
  const insights = [];
  
  // Installation type distribution
  const typeDistribution = d3.rollups(
    filteredData,
    v => v.length,
    d => d["Install Type"]
  );
  const dominantType = typeDistribution.sort((a, b) => b[1] - a[1])[0];
  insights.push(`${dominantType[0]} installations are most common (${((dominantType[1]/filteredData.length)*100).toFixed(1)}% of total).`);
  
  // Size analysis
  const avgSize = d3.mean(filteredData, d => d.Acres);
  const medianSize = d3.median(filteredData, d => d.Acres);
  insights.push(`Average installation size is ${avgSize.toFixed(2)} acres (median: ${medianSize.toFixed(2)} acres).`);
  
  // Urban/Rural split
  const urbanCount = filteredData.filter(d => d["Urban or Rural"] === "Urban").length;
  const urbanPct = (urbanCount/filteredData.length*100).toFixed(1);
  insights.push(`${urbanPct}% of installations are in urban areas.`);
  
  // Grid proximity
  const avgDistance = d3.mean(filteredData, d => +(d.Avg_Distance_Substation || d["Distance to Substation (Miles) CAISO"] || 0));
  insights.push(`Average distance to nearest substation is ${avgDistance.toFixed(2)} miles.`);
  
  // Update DOM
  const insightsElement = document.getElementById('insights-content');
  if (insightsElement) {
    insightsElement.innerHTML = insights.map(insight => 
      `<div class="insight-item">${insight}</div>`
    ).join('');
  }
}

// Land use page will be initialized by common.js loadData() function

// Update getChartDimensions function to ensure proper spacing
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
    top: Math.max(Math.round(height * 0.15), 30),     // 15% of height, min 30px
    right: Math.max(Math.round(width * 0.15), 60),    // 15% of width, min 60px
    bottom: Math.max(Math.round(height * 0.25), 80),  // 25% of height, min 80px for rotated labels
    left: Math.max(Math.round(width * 0.2), 80)       // 20% of width, min 80px for y-axis labels
  };

  // Special adjustments for specific charts
  if (containerId === 'landuse-chart') {
    margin.bottom = Math.max(margin.bottom, 100); // Extra space for rotated labels
  } else if (containerId === 'sustainability-matrix') {
    margin.right = Math.max(margin.right, 80); // Extra space for y-axis label
    margin.bottom = Math.max(margin.bottom, 60); // Extra space for x-axis label
  }
  
  console.log('Chart dimensions for', containerId, ':', { width, height, margin });
  
  return { width, height, margin };
} 