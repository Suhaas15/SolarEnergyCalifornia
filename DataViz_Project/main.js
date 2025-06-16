// Main JavaScript file combining all visualizations
// Note: Common utilities are in common.js to avoid duplication

// Page Initialization
function initializeCurrentPage(solarData, sustainabilityData) {
    // Get current page name from URL, handling both http and file protocols
    const fullPath = window.location.pathname;
    const pageName = fullPath.split('/').pop().replace('.html', '');
    
    console.log('Current page:', pageName); // Debug log
    
    // For infrastructure page, delegate to specific initialization
    if (pageName === 'infra-map' && typeof initializeInfraPage === 'function') {
        initializeInfraPage(solarData, sustainabilityData);
        return;
    }
    
    // Initialize county filter if it exists
    const countyFilter = document.getElementById('countyFilter');
    if (countyFilter) {
        // For grid-network page, only show Alameda
        if (pageName === 'grid-network') {
            countyFilter.innerHTML = `<option value="Alameda">Alameda County</option>`;
            countyFilter.value = 'Alameda';
        } else {
            // For other pages, show all counties
            const counties = [...new Set(solarData.map(d => d.County))].sort();
            countyFilter.innerHTML = `
                <option value="">All Counties (${counties.length})</option>
                ${counties.map(county => `<option value="${county}">${county}</option>`).join('')}
            `;
        }
        
        countyFilter.addEventListener('change', function() {
            console.log('County selected:', this.value); // Debug log
            
            // For land-use page, use the new filter system
            if (pageName === 'land-use') {
                const installType = document.getElementById('installationTypeFilter')?.value || 'all';
                const sizeCategory = document.getElementById('sizeFilter')?.value || 'all';
                updateLandUseWithFilters(this.value, installType, sizeCategory);
            } else {
                // For other pages, use the old system
                updateCurrentVisualizations(solarData, sustainabilityData, this.value);
            }
        });
    }

    // Initial visualization update with Alameda for grid-network page
    if (pageName === 'grid-network') {
        updateCurrentVisualizations(solarData, sustainabilityData, 'Alameda');
    } else {
        updateCurrentVisualizations(solarData, sustainabilityData, '');
    }

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (pageName === 'land-use') {
                const county = countyFilter ? countyFilter.value : '';
                const installType = document.getElementById('installationTypeFilter')?.value || 'all';
                const sizeCategory = document.getElementById('sizeFilter')?.value || 'all';
                updateLandUseWithFilters(county, installType, sizeCategory);
            } else {
                const selectedCounty = countyFilter ? countyFilter.value : '';
                updateCurrentVisualizations(solarData, sustainabilityData, selectedCounty);
            }
        }, 250);
    });
}

// Update Visualizations Based on Current Page
function updateCurrentVisualizations(solarData, sustainabilityData, county) {
  const fullPath = window.location.pathname;
  const pageName = fullPath.split('/').pop().replace('.html', '');
  
  console.log('Updating visualizations for page:', pageName); // Debug log
  
  switch(pageName) {
    case 'land-use':
      updateLandUseVisualizations(solarData, county);
      break;

    case 'infra-map':
      // Use the specific infra visualization function if available
      if (typeof updateInfraVisualizations === 'function') {
        updateInfraVisualizations(solarData, sustainabilityData, county);
      } else if (typeof updateInfraMapVisualizations === 'function') {
        updateInfraMapVisualizations(solarData, sustainabilityData, county);
      }
      break;
    case 'urban-chord':
      updateUrbanChordVisualizations(solarData, county);
      break;
    case 'grid-network':
      updateGridNetworkVisualizations(solarData, county);
      break;
    case 'streamgraph':
      updateStreamgraphVisualizations(solarData, county);
      break;
    case 'chord':
      updateChordVisualizations(solarData, county);
      break;
    case 'index':
    case '':
      updateDashboardVisualizations(solarData, sustainabilityData);
      break;
    default:
      console.log('Unknown page:', pageName);
      // Try to handle the page anyway
      if (document.getElementById('landuse-chart')) {
        updateLandUseVisualizations(solarData, county);
      
      } else if (document.getElementById('map')) {
        // Use the specific infra visualization function if available
        if (typeof updateInfraVisualizations === 'function') {
          updateInfraVisualizations(solarData, sustainabilityData, county);
        } else if (typeof updateInfraMapVisualizations === 'function') {
          updateInfraMapVisualizations(solarData, sustainabilityData, county);
        }
      } else if (document.getElementById('chordDiagram')) {
        updateUrbanChordVisualizations(solarData, county);
      }
  }
}

// Land Use Page Functions
function updateLandUseVisualizations(data, county, installType = 'all', sizeCategory = 'all') {
  console.log('Initializing land use visualizations...'); // Debug log
  
  // Check if we're on the land use page
  if (document.getElementById('landuse-chart')) {
    console.log('Found landuse-chart container'); // Debug log
    
    // Update metrics first and get filtered data
    const filteredData = updateKeyMetrics(data, county, installType, sizeCategory);
    
    try {
      // Draw each chart with error handling
      console.log('Drawing land use distribution chart...'); // Debug log
      drawLandUseChart(filteredData, county);
      
      console.log('Drawing sustainability matrix...'); // Debug log
      drawSustainabilityMatrix(filteredData, county);
      
      console.log('Drawing size optimization chart...'); // Debug log
      drawSizeOptimizationChart(filteredData, county);
      
      console.log('Drawing urban/rural efficiency chart...'); // Debug log
      drawUrbanRuralEfficiencyChart(filteredData, county);
      
      // Generate insights last
      generateInsights(filteredData, county);
      
      console.log('All visualizations completed successfully'); // Debug log
    } catch (error) {
      console.error('Error updating visualizations:', error);
    }
  } else {
    console.log('Not on land use page - landuse-chart container not found');
  }
}

// Global function to handle filter updates from HTML
function updateLandUseWithFilters(county, installType, sizeCategory) {
  // Get the current data - we need to access it from the global scope
  if (window.currentSolarData) {
    updateLandUseVisualizations(window.currentSolarData, county, installType, sizeCategory);
  } else {
    console.warn('Solar data not available for filtering');
  }
}

// Add missing chart functions for land use page
function drawSustainabilityMatrix(data, county) {
  const container = document.getElementById('sustainability-matrix');
  if (!container) return;
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const { width, height, margin } = getChartDimensions('sustainability-matrix');
  
  // Clear previous chart
  container.innerHTML = '';
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Prepare data for matrix (efficiency vs carbon offset)
  const matrixData = Array.from(d3.rollup(filteredData,
    v => ({
      count: v.length,
      avgEfficiency: d3.mean(v, d => d.Acres > 0 ? 1/d.Acres : 0), // Installations per acre
      totalCarbonOffset: d3.sum(v, d => +d.Carbon_Offset_tons || 0),
      county: v[0].County
    }),
    d => d.County
  ), ([county, data]) => ({ county, ...data }));
  
  // Create scales
  const xScale = d3.scaleLinear()
    .domain(d3.extent(matrixData, d => d.avgEfficiency))
    .range([0, chartWidth]);
  
  const yScale = d3.scaleLinear()
    .domain(d3.extent(matrixData, d => d.totalCarbonOffset))
    .range([chartHeight, 0]);
  
  const sizeScale = d3.scaleSqrt()
    .domain(d3.extent(matrixData, d => d.count))
    .range([5, 20]);
  
  // Add circles
  chart.selectAll('circle')
    .data(matrixData)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.avgEfficiency))
    .attr('cy', d => yScale(d.totalCarbonOffset))
    .attr('r', d => sizeScale(d.count))
    .attr('fill', '#3B82F6')
    .attr('opacity', 0.7)
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 1);
      d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <strong>${d.county}</strong><br>
          Efficiency: ${d.avgEfficiency.toFixed(2)}<br>
          Carbon Offset: ${d.totalCarbonOffset.toFixed(1)} tons<br>
          Installations: ${d.count}
        `);
      positionTooltip(event, d3.select('#tooltip'));
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.7);
      d3.select('#tooltip').style('display', 'none');
    });
  
  // Add axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale);
  
  chart.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(xAxis);
  
  chart.append('g')
    .call(yAxis);
  
  // Add labels
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Land Efficiency (installations/acre)');
  
  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Carbon Offset (tons/year)');
}

function drawSizeOptimizationChart(data, county) {
  const container = document.getElementById('size-optimization-chart');
  if (!container) return;
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const { width, height, margin } = getChartDimensions('size-optimization-chart');
  
  // Clear previous chart
  container.innerHTML = '';
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Categorize by size
  const sizeCategories = ['Small(<1)', 'Medium(1-5)', 'Large(5-10)', 'X-Large(10+)'];
  const categorizedData = sizeCategories.map(category => {
    let categoryData;
    switch(category) {
      case 'Small(<1)':
        categoryData = filteredData.filter(d => d.Acres < 1);
        break;
      case 'Medium(1-5)':
        categoryData = filteredData.filter(d => d.Acres >= 1 && d.Acres < 5);
        break;
      case 'Large(5-10)':
        categoryData = filteredData.filter(d => d.Acres >= 5 && d.Acres < 10);
        break;
      case 'X-Large(10+)':
        categoryData = filteredData.filter(d => d.Acres >= 10);
        break;
      default:
        categoryData = [];
    }
    
    return {
      category,
      count: categoryData.length,
      avgEfficiency: categoryData.length > 0 ? d3.mean(categoryData, d => +d.Carbon_Offset_tons / Math.max(d.Acres, 0.1)) : 0,
      totalCarbonOffset: d3.sum(categoryData, d => +d.Carbon_Offset_tons || 0)
    };
  });
  
  // Create scales
  const xScale = d3.scaleBand()
    .domain(sizeCategories)
    .range([0, chartWidth])
    .padding(0.2);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(categorizedData, d => d.avgEfficiency)])
    .range([chartHeight, 0]);
  
  // Add bars
  chart.selectAll('rect')
    .data(categorizedData)
    .enter()
    .append('rect')
    .attr('x', d => xScale(d.category))
    .attr('y', chartHeight)
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .attr('fill', '#10B981')
    .on('mouseover', function(event, d) {
      d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <strong>${d.category} Projects</strong><br>
          Count: ${d.count}<br>
          Avg Efficiency: ${d.avgEfficiency.toFixed(2)} tons/acre<br>
          Total Offset: ${d.totalCarbonOffset.toFixed(1)} tons
        `);
      positionTooltip(event, d3.select('#tooltip'));
    })
    .on('mouseout', function() {
      d3.select('#tooltip').style('display', 'none');
    })
    .transition()
    .duration(800)
    .attr('y', d => yScale(d.avgEfficiency))
    .attr('height', d => chartHeight - yScale(d.avgEfficiency));
  
  // Add axes
  chart.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale));
  
  chart.append('g')
    .call(d3.axisLeft(yScale));
  
  // Add labels
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Project Size Category');
  
  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Efficiency (tons CO2/acre/year)');
}

function drawUrbanRuralEfficiencyChart(data, county) {
  const container = document.getElementById('urban-rural-efficiency');
  if (!container) return;
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const { width, height, margin } = getChartDimensions('urban-rural-efficiency');
  
  // Clear previous chart
  container.innerHTML = '';
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Group by urban/rural
  const urbanRuralData = Array.from(d3.rollup(filteredData,
    v => ({
      count: v.length,
      avgSize: d3.mean(v, d => d.Acres),
      avgEfficiency: d3.mean(v, d => +d.Carbon_Offset_tons / Math.max(d.Acres, 0.1)),
      totalOffset: d3.sum(v, d => +d.Carbon_Offset_tons || 0)
    }),
    d => d["Urban or Rural"]
  ), ([type, data]) => ({ type, ...data }));
  
  // Create scales
  const xScale = d3.scaleBand()
    .domain(urbanRuralData.map(d => d.type))
    .range([0, chartWidth])
    .padding(0.3);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(urbanRuralData, d => d.avgEfficiency)])
    .range([chartHeight, 0]);
  
  // Add bars
  chart.selectAll('rect')
    .data(urbanRuralData)
    .enter()
    .append('rect')
    .attr('x', d => xScale(d.type))
    .attr('y', chartHeight)
    .attr('width', xScale.bandwidth())
    .attr('height', 0)
    .attr('fill', d => colorScales.urbanRural(d.type))
    .on('mouseover', function(event, d) {
      d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <strong>${d.type} Areas</strong><br>
          Installations: ${d.count}<br>
          Avg Size: ${d.avgSize.toFixed(2)} acres<br>
          Efficiency: ${d.avgEfficiency.toFixed(2)} tons/acre<br>
          Total Offset: ${d.totalOffset.toFixed(1)} tons
        `);
      positionTooltip(event, d3.select('#tooltip'));
    })
    .on('mouseout', function() {
      d3.select('#tooltip').style('display', 'none');
    })
    .transition()
    .duration(800)
    .attr('y', d => yScale(d.avgEfficiency))
    .attr('height', d => chartHeight - yScale(d.avgEfficiency));
  
  // Add axes
  chart.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale));
  
  chart.append('g')
    .call(d3.axisLeft(yScale));
  
  // Add labels
  chart.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + margin.bottom - 5)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Area Type');
  
  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Efficiency (tons CO2/acre/year)');
}

// Grid Network Page Functions
function updateGridNetworkVisualizations(data, county) {
  if (document.getElementById('3d-graph')) {
    updateNetworkMetrics(data, county);
    draw3DNetwork(data, county);
    drawDistanceHistogram(data, county);
    drawConnectivityMatrix(data, county);
  }
}

function updateNetworkMetrics(data, county) {
  const filteredData = county ? data.filter(d => d.County === county) : data;
  
  // Calculate network metrics with null checks
  const totalNodes = filteredData.length || 0;
  const connections = calculateGridConnections(filteredData);
  const avgDistance = connections.length > 0 ? d3.mean(connections, d => d.distance) || 0 : 0;
  const density = totalNodes > 1 ? (2 * connections.length) / (totalNodes * (totalNodes - 1)) : 0;
  
  // Update DOM with formatted numbers and handle undefined values
  const elements = {
    totalNodes: document.getElementById('totalNodes'),
    totalConnections: document.getElementById('totalConnections'),
    avgDistance: document.getElementById('avgDistance'),
    networkDensity: document.getElementById('networkDensity')
  };

  // Only update elements that exist
  if (elements.totalNodes) elements.totalNodes.textContent = formatNumber(totalNodes);
  if (elements.totalConnections) elements.totalConnections.textContent = formatNumber(connections.length);
  if (elements.avgDistance) elements.avgDistance.textContent = `${formatNumber(avgDistance)} mi`;
  if (elements.networkDensity) elements.networkDensity.textContent = formatNumber(density * 100) + '%';
}

function calculateGridConnections(data) {
  const connections = [];
  const distanceThreshold = parseFloat(document.getElementById('distanceThreshold')?.value || 5);
  
  // Calculate connections between installations within threshold distance
  data.forEach((source, i) => {
    // Ensure required properties exist
    if (!source.Latitude || !source.Longitude) return;
    
    data.forEach((target, j) => {
      if (i < j && target.Latitude && target.Longitude) {
        const distance = calculateDistance(source, target);
        if (distance <= distanceThreshold) {
          connections.push({
            source: i,
            target: j,
            distance: distance,
            sourceType: source["Install Type"] || 'Unknown',
            targetType: target["Install Type"] || 'Unknown'
          });
        }
      }
    });
  });
  
  return connections;
}

function calculateDistance(point1, point2) {
  // Haversine formula for calculating distance between two points
  const R = 3959; // Earth's radius in miles
  const lat1 = point1.Latitude * Math.PI / 180;
  const lat2 = point2.Latitude * Math.PI / 180;
  const dLat = (point2.Latitude - point1.Latitude) * Math.PI / 180;
  const dLon = (point2.Longitude - point1.Longitude) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1) * Math.cos(lat2) *
           Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function draw3DNetwork(data, county) {
    const container = document.getElementById('3d-graph');
    if (!container) return;
    
    let filteredData = county ? data.filter(d => d.County === county) : data;
    let graph = null;
    
    function updateVisualization() {
        // Show loading state
        document.getElementById('loading').style.display = 'flex';
        
        // Get selected node type filter
        const nodeTypeFilter = document.getElementById('nodeTypeFilter').value;
        const distanceThreshold = parseFloat(document.getElementById('distanceThreshold').value);
        
        // Filter nodes based on type
        let filteredNodes = filteredData;
        if (nodeTypeFilter !== 'all') {
            filteredNodes = filteredData.filter(d => 
                d["Install Type"]?.toLowerCase() === nodeTypeFilter.toLowerCase()
            );
        }
        
        // Update visible count
        document.getElementById('visibleCount').textContent = filteredNodes.length;
        
        // Calculate node sizes based on installation size (acres)
        const sizeScale = d3.scaleLinear()
            .domain([0, d3.max(filteredNodes, d => d.Acres || 0)])
            .range([8, 20]); // Increased size range for better visibility
        
        // Calculate connections based on current distance threshold and capacity
        const connections = [];
        filteredNodes.forEach((source, i) => {
            filteredNodes.forEach((target, j) => {
                if (i < j) {
                    const distance = calculateDistance(source, target);
                    if (distance <= distanceThreshold) {
                        // Calculate connection strength based on installation sizes and distance
                        const strength = Math.sqrt((source.Acres || 1) * (target.Acres || 1)) / (distance + 1);
                        connections.push({
                            source: i,
                            target: j,
                            distance: distance,
                            strength: strength,
                            sourceType: source["Install Type"],
                            targetType: target["Install Type"]
                        });
                    }
                }
            });
        });
        
        // More vibrant and distinguishable colors for installation types
        const typeColors = {
            'Rooftop': '#FF4D4D',    // Bright red
            'Ground': '#4DFF4D',      // Bright green
            'Parking': '#4D4DFF',     // Bright blue
            'Unknown': '#808080'      // Gray
        };
        
        // Prepare data for 3D force graph with enhanced information
        const graphData = {
            nodes: filteredNodes.map((d, i) => ({
                id: i,
                name: d.Name || `Installation ${i}`,
                type: d["Install Type"] || 'Unknown',
                size: d.Acres || 1,
                county: d.County || 'Unknown',
                distance: d["Distance to Substation (Miles) CAISO"] || 0,
                coordinates: [d.Longitude, d.Latitude],
                urban_rural: d["Urban or Rural"] || 'Unknown',
                data: d
            })),
            links: connections
        };

        if (!graph) {
            // Initialize 3D force graph with enhanced visuals
            graph = ForceGraph3D()(container)
                .backgroundColor('#ffffff')
                .nodeRelSize(8)
                .nodeVal(d => sizeScale(d.size))
                .nodeColor(d => typeColors[d.type] || typeColors.Unknown)
                .linkColor(link => {
                    // Color links based on connection strength
                    const strength = link.strength;
                    return strength > 2 ? '#FF9933' :  // Strong connections
                           strength > 1 ? '#FFCC33' :  // Medium connections
                           '#CCCCCC';                  // Weak connections
                })
                .linkWidth(link => Math.min(5, link.strength))
                .linkOpacity(0.6)
                .linkDirectionalParticles(link => Math.ceil(link.strength))
                .linkDirectionalParticleSpeed(d => d.strength * 0.005)
                .nodeLabel(d => `
                    <div class="graph-tooltip">
                        <div class="graph-tooltip-title">${formatInstallationType(d.type)}</div>
                        <div class="graph-tooltip-row">
                            <span class="graph-tooltip-label">Installation Size:</span>
                            <span class="graph-tooltip-value">${formatSizeCategory(d.size)}</span>
                        </div>
                        <div class="graph-tooltip-row">
                            <span class="graph-tooltip-label">Location:</span>
                            <span class="graph-tooltip-value">${d.county} County</span>
                        </div>
                        <div class="graph-tooltip-row">
                            <span class="graph-tooltip-label">Area Development:</span>
                            <span class="graph-tooltip-value">${formatAreaType(d.urban_rural)}</span>
                        </div>
                        <div class="graph-tooltip-row">
                            <span class="graph-tooltip-label">Distance to Power Grid:</span>
                            <span class="graph-tooltip-value">${formatDistanceCategory(d.distance)}</span>
                        </div>
                        <div class="graph-tooltip-row">
                            <span class="graph-tooltip-label">Grid Connections:</span>
                            <span class="graph-tooltip-value">${
                                graphData.links.filter(link => 
                                    link.source === d.id || link.target === d.id
                                ).length
                            }</span>
                        </div>
                    </div>
                `)
                .onNodeClick(handleNodeClick)
                .onLinkClick(handleLinkClick)
                .onBackgroundClick(handleBackgroundClick);

            // Adjust force simulation parameters for better layout
            graph.d3Force('charge').strength(-150);
            graph.d3Force('link').distance(d => Math.min(100, d.distance * 10)).strength(0.2);
            graph.d3Force('center').strength(1);
            graph.d3Force('collide', d3.forceCollide().radius(d => sizeScale(d.size) * 1.2));

            // Add reset view button handler
            document.getElementById('resetView').addEventListener('click', () => {
                handleBackgroundClick();
                graph.cameraPosition(
                    { x: 0, y: 0, z: 200 }, // new position
                    { x: 0, y: 0, z: 0 },    // lookAt
                    3000                      // ms transition duration
                );
            });

            // Add fit view button handler
            document.getElementById('fitView').addEventListener('click', () => {
                // Get the current graph data
                const { nodes } = graph.graphData();
                if (!nodes.length) return;

                // Calculate bounding box
                const bbox = {
                    min: { x: Infinity, y: Infinity, z: Infinity },
                    max: { x: -Infinity, y: -Infinity, z: -Infinity }
                };

                nodes.forEach(node => {
                    ['x', 'y', 'z'].forEach(coord => {
                        if (node[coord] < bbox.min[coord]) bbox.min[coord] = node[coord];
                        if (node[coord] > bbox.max[coord]) bbox.max[coord] = node[coord];
                    });
                });

                // Calculate center and size
                const center = {
                    x: (bbox.min.x + bbox.max.x) / 2,
                    y: (bbox.min.y + bbox.max.y) / 2,
                    z: (bbox.min.z + bbox.max.z) / 2
                };

                const dist = Math.max(
                    bbox.max.x - bbox.min.x,
                    bbox.max.y - bbox.min.y,
                    bbox.max.z - bbox.min.z
                );

                // Position camera to fit all nodes
                graph.cameraPosition(
                    { 
                        x: center.x,
                        y: center.y,
                        z: center.z + dist * 1.5
                    },
                    center,
                    2000
                );
            });
        }

        // Update graph data
        graph.graphData(graphData);
        
        // Update distance threshold display
        document.getElementById('distanceValue').textContent = `${distanceThreshold} miles`;
        
        // Hide loading state after a short delay to ensure smooth transition
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 500);
    }

    function handleNodeClick(node) {
        // Center view on clicked node
        const distance = 40;
        const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node,
            3000
        );
        
        // Highlight connected nodes and their links
        const connectedNodes = new Set();
        const connectedLinks = new Set();
        graph.graphData().links.forEach(link => {
            if (link.source.id === node.id || link.target.id === node.id) {
                connectedNodes.add(link.source.id === node.id ? link.target : link.source);
                connectedLinks.add(link);
            }
        });
        
        graph.nodeColor(n => 
            n === node ? '#FFFF00' :                // Yellow for selected node
            connectedNodes.has(n) ? '#FFA500' :     // Orange for connected nodes
            typeColors[n.type] || typeColors.Unknown // Original color for others
        ).linkColor(link => 
            connectedLinks.has(link) ? '#FFA500' :  // Orange for connected links
            link.strength > 2 ? '#FF9933' :         // Strong connections
            link.strength > 1 ? '#FFCC33' :         // Medium connections
            '#CCCCCC'                               // Weak connections
        ).linkWidth(link => 
            connectedLinks.has(link) ? 3 : Math.min(5, link.strength)
        );
    }

    function handleLinkClick(link) {
        // Show connection details
        const distance = link.distance;
        const strength = link.strength;
        
        d3.select('#tooltip')
            .style('display', 'block')
            .html(`
                <div class="tooltip-content">
                    <h4 class="tooltip-title">Connection Details</h4>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Distance:</span>
                        <span class="tooltip-value">${formatNumber(distance)} miles</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Strength:</span>
                        <span class="tooltip-value">${formatNumber(strength)}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">From:</span>
                        <span class="tooltip-value">${link.sourceType}</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">To:</span>
                        <span class="tooltip-value">${link.targetType}</span>
                    </div>
                </div>
            `);
    }

    function handleBackgroundClick() {
        // Reset colors and camera
        graph.nodeColor(d => typeColors[d.type] || typeColors.Unknown)
            .linkColor(link => {
                const strength = link.strength;
                return strength > 2 ? '#FF9933' :
                       strength > 1 ? '#FFCC33' :
                       '#CCCCCC';
            })
            .linkWidth(link => Math.min(5, link.strength));
        
        d3.select('#tooltip').style('display', 'none');
    }

    // Add event listeners for controls with debouncing
    let updateTimeout;
    
    document.getElementById('nodeTypeFilter').addEventListener('change', () => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateVisualization, 100);
    });

    document.getElementById('distanceThreshold').addEventListener('input', () => {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateVisualization, 100);
    });

    // Initial visualization
    updateVisualization();
}

// Function to update HTML elements (called from main DOMContentLoaded)
function updateHTMLElements() {
  const nodeTypeFilter = document.getElementById('nodeTypeFilter');
  if (nodeTypeFilter) {
    nodeTypeFilter.innerHTML = `
      <option value="all">Show All Installation Types</option>
      <option value="rooftop">Rooftop Solar Only</option>
      <option value="ground">Ground-Mounted Only</option>
      <option value="parking">Parking Canopy Only</option>
    `;
  }

  const distanceThreshold = document.getElementById('distanceThreshold');
  if (distanceThreshold) {
    const label = distanceThreshold.previousElementSibling;
    if (label) {
      label.innerHTML = `
        Maximum Connection Distance
        <span class="text-muted">(Shorter distances show stronger grid relationships)</span>
        <span id="distanceValue" class="float-end">5 miles</span>
      `;
    }
  }
}

function drawDistanceHistogram(data, county) {
  const container = document.getElementById('distance-histogram');
  if (!container) return;
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const connections = calculateGridConnections(filteredData);
  
  // Clear previous content
  container.innerHTML = '';
  
  const { width, height, margin } = getChartDimensions('distance-histogram');
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Create histogram with better binning
  const bins = d3.histogram()
    .domain([0, d3.max(connections, d => d.distance)])
    .thresholds(15)
    (connections.map(d => d.distance));
  
  // Scales with padding
  const x = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.x1)])
    .range([0, width - margin.left - margin.right])
    .nice();
  
  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length) * 1.1])
    .range([height - margin.top - margin.bottom, 0])
    .nice();
  
  // Add gradient
  const gradient = svg.append('defs')
    .append('linearGradient')
    .attr('id', 'histogram-gradient')
    .attr('x1', '0%')
    .attr('y1', '100%')
    .attr('x2', '0%')
    .attr('y2', '0%');
  
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#3B82F6')
    .attr('stop-opacity', 0.2);
  
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#3B82F6')
    .attr('stop-opacity', 0.8);
  
  // Draw bars with animation
  chart.selectAll('rect')
    .data(bins)
    .join('rect')
    .attr('x', d => x(d.x0) + 1)
    .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr('y', height - margin.top - margin.bottom)
    .attr('height', 0)
    .attr('fill', 'url(#histogram-gradient)')
    .attr('stroke', '#3B82F6')
    .attr('stroke-opacity', 0.5)
    .transition()
    .duration(800)
    .attr('y', d => y(d.length))
    .attr('height', d => height - margin.top - margin.bottom - y(d.length));
  
  // Add axes with better formatting
  const xAxis = d3.axisBottom(x)
    .ticks(10)
    .tickFormat(d => d + ' mi');
  
  const yAxis = d3.axisLeft(y)
    .ticks(5)
    .tickFormat(d3.format('d'));
  
  chart.append('g')
    .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
    .call(xAxis)
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').attr('stroke-opacity', 0.5));
  
  chart.append('g')
    .call(yAxis)
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line')
      .attr('x2', width - margin.left - margin.right)
      .attr('stroke-opacity', 0.1));
  
  // Add labels
  chart.append('text')
    .attr('x', (width - margin.left - margin.right) / 2)
    .attr('y', height - margin.top)
    .attr('text-anchor', 'middle')
    .attr('fill', '#4B5563')
    .text('Distance Between Installations (miles)');
  
  chart.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -(height - margin.top - margin.bottom) / 2)
    .attr('y', -margin.left + 16)
    .attr('text-anchor', 'middle')
    .attr('fill', '#4B5563')
    .text('Number of Connections');
}

function drawConnectivityMatrix(data, county) {
  const container = document.getElementById('connectivity-matrix');
  if (!container) return;
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  const connections = calculateGridConnections(filteredData);
  
  // Clear previous content
  container.innerHTML = '';
  
  const { width, height, margin } = getChartDimensions('connectivity-matrix');
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Create matrix data with better organization
  const types = ["Rooftop", "Ground", "Parking"];
  const matrix = Array(types.length).fill(0).map(() => Array(types.length).fill(0));
  
  connections.forEach(conn => {
    const sourceType = filteredData[conn.source]["Install Type"];
    const targetType = filteredData[conn.target]["Install Type"];
    const sourceIndex = types.indexOf(sourceType);
    const targetIndex = types.indexOf(targetType);
    if (sourceIndex >= 0 && targetIndex >= 0) {
      matrix[sourceIndex][targetIndex]++;
      if (sourceIndex !== targetIndex) {
        matrix[targetIndex][sourceIndex]++;
      }
    }
  });
  
  // Calculate cell size
  const size = Math.min(
    (width - margin.left - margin.right) / types.length,
    (height - margin.top - margin.bottom) / types.length
  );
  
  // Create color scale
  const color = d3.scaleSequential()
    .domain([0, d3.max(matrix, row => d3.max(row))])
    .interpolator(d3.interpolateBlues);
  
  // Draw cells with animation
  types.forEach((row, i) => {
    types.forEach((col, j) => {
      const cell = chart.append('rect')
        .attr('x', j * size)
        .attr('y', i * size)
        .attr('width', size)
        .attr('height', size)
        .attr('fill', '#fff')
        .attr('stroke', '#e2e8f0')
        .on('mouseover', function(event) {
          d3.select(this)
            .attr('stroke', '#3B82F6')
            .attr('stroke-width', 2);
          
          const percentage = (matrix[i][j] / d3.sum(matrix.flat()) * 100).toFixed(1);
          d3.select('#tooltip')
            .style('display', 'block')
            .html(`
              <div class="tooltip-content">
                <h4 class="tooltip-title">Connection Types</h4>
                <div class="tooltip-description">
                  Shows how ${row} and ${col} installations are connected in the grid network.
                </div>
                <div class="tooltip-row">
                  <span class="label">From:</span>
                  <span class="value">${row}</span>
                </div>
                <div class="tooltip-row">
                  <span class="label">To:</span>
                  <span class="value">${col}</span>
                </div>
                <div class="tooltip-row">
                  <span class="label">Connections:</span>
                  <span class="value">${formatNumber(matrix[i][j])}</span>
                </div>
                <div class="tooltip-row">
                  <span class="label">Share of Total:</span>
                  <span class="value">${percentage}%</span>
                </div>
              </div>
            `);
          positionTooltip(event, d3.select('#tooltip'));
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('stroke', '#e2e8f0')
            .attr('stroke-width', 1);
          d3.select('#tooltip')
            .style('display', 'none');
        });
      
      // Animate fill
      cell.transition()
        .duration(800)
        .attr('fill', color(matrix[i][j]));
    });
    
    // Add row labels
    chart.append('text')
      .attr('x', -10)
      .attr('y', i * size + size/2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#4B5563')
      .text(row);
    
    // Add column labels
    chart.append('text')
      .attr('x', i * size + size/2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4B5563')
      .text(types[i]);
  });
  
  // Add title and description
  chart.append('text')
    .attr('x', (types.length * size) / 2)
    .attr('y', -margin.top / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', '#1F2937')
    .attr('font-weight', '600')
    .text('Installation Type Connections');
}

// This function was moved to the consolidated DOMContentLoaded listener below

// Visualization Functions
function updateKeyMetrics(data, county, installType = 'all', sizeCategory = 'all') {
  let filteredData = county ? data.filter(d => d.County === county) : data;
  
  // Apply installation type filter
  if (installType && installType !== 'all') {
    filteredData = filteredData.filter(d => d["Install Type"] === installType);
  }
  
  // Apply size category filter
  if (sizeCategory && sizeCategory !== 'all') {
    filteredData = filteredData.filter(d => {
      const acres = d.Acres || 0;
      switch(sizeCategory) {
        case 'Small(<1)': return acres < 1;
        case 'Medium(1-5)': return acres >= 1 && acres < 5;
        case 'Large(5-10)': return acres >= 5 && acres < 10;
        case 'X-Large(10+)': return acres >= 10;
        default: return true;
      }
    });
  }
  
  // Calculate metrics with proper error handling
  const totalInstallations = filteredData.length;
  const totalAcres = d3.sum(filteredData, d => d.Acres) || 0;
  const totalCarbonOffset = d3.sum(filteredData, d => +d.Carbon_Offset_tons) || 0;
  const avgEfficiency = filteredData.length > 0 ? (totalCarbonOffset / Math.max(totalAcres, 0.1)) : 0;
  
  // Update DOM with formatted numbers - matching the HTML IDs
  const metrics = [
    {
      id: 'total-installations',
      value: formatNumber(totalInstallations),
      tooltip: 'Total number of solar installations in the selected region'
    },
    {
      id: 'total-acres', 
      value: `${formatNumber(totalAcres)} ac`,
      tooltip: 'Total land area used by all installations'
    },
    {
      id: 'carbon-offset',
      value: `${formatNumber(totalCarbonOffset)} tons`,
      tooltip: 'Total annual CO2 emissions avoided'
    },
    {
      id: 'avg-efficiency',
      value: `${formatNumber(avgEfficiency)} tons/ac`,
      tooltip: 'Average carbon offset efficiency per acre'
    }
  ];

  // Update each metric with proper formatting and tooltips
  metrics.forEach(metric => {
    const element = document.getElementById(metric.id);
    if (element) {
      element.textContent = metric.value;
      // Update the parent metric card's tooltip
      const card = element.closest('.metric-card');
      if (card) {
        card.setAttribute('data-bs-original-title', metric.tooltip);
        // Reinitialize tooltip if Bootstrap's Tooltip is used
        if (window.bootstrap && window.bootstrap.Tooltip) {
          new bootstrap.Tooltip(card);
        }
      }
    }
  });
  
  return filteredData; // Return filtered data for use by charts
}

function drawLandUseChart(data, county) {
  const container = document.getElementById('landuse-chart');
  if (!container) {
    console.error('Land use chart container not found');
    return;
  }

  // Clear previous chart and any existing tooltips
  container.innerHTML = '';
  d3.select('#tooltip').style('display', 'none');
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  
  // Get dimensions
  const { width, height, margin } = getChartDimensions('landuse-chart');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Prepare data
  const chartData = d3.rollups(
    filteredData,
    v => ({
      acres: d3.sum(v, d => d.Acres),
      count: v.length,
      avgSize: d3.mean(v, d => d.Acres),
      avgDistance: d3.mean(v, d => d["Distance to Substation (Miles) CAISO"])
    }),
    d => d["Install Type"]
  ).map(([type, data]) => ({ 
    type, 
    ...data 
  }));
  
  // Create scales
  const x = d3.scaleBand()
    .domain(chartData.map(d => d.type))
    .range([0, chartWidth])
    .padding(0.3);
  
  const y = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d.acres) * 1.1])
    .range([chartHeight, 0]);
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Add bars with animation and enhanced tooltip
  const bars = svg.selectAll('.bar')
    .data(chartData)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.type))
    .attr('width', x.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', d => colorScales.installationType(d.type))
    .attr('opacity', 0.7);

  // Animate bars
  bars.transition()
    .duration(800)
    .attr('y', d => y(d.acres))
    .attr('height', d => chartHeight - y(d.acres));

  // Add hover interactions
  bars.on('mouseover', function(event, d) {
    // Highlight the bar
    d3.select(this)
      .attr('opacity', 0.9)
      .attr('stroke', '#000')
      .attr('stroke-width', 2);
    
    const percentage = (d.acres / d3.sum(chartData, d => d.acres) * 100).toFixed(1);
    const avgDistanceFormatted = d.avgDistance ? formatNumber(d.avgDistance) : 'N/A';
    
    // Show and position tooltip
    const tooltip = d3.select('#tooltip')
      .style('display', 'block')
      .html(`
        <div class="tooltip-content">
          <h4 class="tooltip-title">${d.type} Installations</h4>
          <div class="tooltip-description">
            ${getInstallationTypeDescription(d.type)}
          </div>
          <div class="tooltip-stats">
            <div class="tooltip-row">
              <span class="label">Count:</span>
              <span class="value">${formatNumber(d.count)} installations</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Total Area:</span>
              <span class="value">${formatNumber(d.acres)} acres</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Average Size:</span>
              <span class="value">${formatNumber(d.avgSize)} acres/installation</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Grid Distance:</span>
              <span class="value">${avgDistanceFormatted} miles</span>
            </div>
            <div class="tooltip-row">
              <span class="label">Share of Total:</span>
              <span class="value">${percentage}% of total area</span>
            </div>
          </div>
        </div>
      `);
    
    // Position tooltip
    const tooltipNode = tooltip.node();
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    let left = event.pageX + 10;
    let top = event.pageY - tooltipRect.height / 2;
    
    // Adjust if tooltip would go outside viewport
    if (left + tooltipRect.width > window.innerWidth) {
      left = event.pageX - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = window.innerHeight - tooltipRect.height - 10;
    }
    if (top < 0) {
      top = 10;
    }
    
    tooltip
      .style('left', left + 'px')
      .style('top', top + 'px');
  })
  .on('mouseout', function() {
    // Reset bar style
    d3.select(this)
      .attr('opacity', 0.7)
      .attr('stroke', 'none');
    
    // Hide tooltip
    d3.select('#tooltip')
      .style('display', 'none');
  });
  
  // Add axes with styling
  const xAxis = svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x))
    .style('font-size', '12px');
  
  const yAxis = svg.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${formatNumber(d)} ac`))
    .style('font-size', '12px');
  
  // Add axis labels
  svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .attr('transform', 'rotate(-90)')
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#4B5563')
    .text('Total Area (acres)');
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
  const avgDistance = d3.mean(filteredData, d => d["Distance to Substation (Miles) CAISO"]);
  insights.push(`Average distance to nearest substation is ${avgDistance.toFixed(2)} miles.`);
  
  // Update DOM
  const insightsElement = document.getElementById('insights-content');
  if (insightsElement) {
    insightsElement.innerHTML = `
      <ul class="insights-list">
        ${insights.map(insight => `<li>${insight}</li>`).join('')}
      </ul>
    `;
  }
}

// CONSOLIDATED SINGLE DOMContentLoaded LISTENER - handles all initialization
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing main.js...');
  
  // Only initialize if this is NOT a page with its own specific JS file
  const pageName = window.location.pathname.split('/').pop().replace('.html', '');
  const pagesWithOwnJS = ['infra-map', 'land-use', 'urban-chord', 'ai-insights'];
  
  if (pagesWithOwnJS.includes(pageName)) {
    console.log(`Page ${pageName} has its own JS file, skipping main.js initialization`);
    return;
  }
  
  console.log('Initializing page with main.js...');
  
  // Update HTML elements
  updateHTMLElements();
  
  // Show loading overlays initially
  document.querySelectorAll('.loading-overlay').forEach(el => {
    el.style.display = 'flex';
  });
  
  // Initialize controls if they exist
  const countyFilter = document.getElementById('countyFilter');
  const timeRangeFilter = document.getElementById('timeRangeFilter');
  const metricFilter = document.getElementById('metricFilter');
  
  // Use the loadData function from common.js (don't duplicate data loading)
  if (typeof loadData === 'function') {
    console.log('Using loadData from common.js');
  } else {
    console.error('loadData function not found - ensure common.js is loaded first');
  }
}); 

// Capacity vs Grid Distance Chart
function drawCapacityChart(data, county) {
  const container = '#capacityChart';
  
  // Clear previous chart
  d3.select(container).selectAll("*").remove();
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  
  // Get dimensions
  const { width, height, margin } = getChartDimensions('capacityChart');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Create scales
  const xScale = d3.scaleLinear()
    .domain(d3.extent(filteredData, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0)))
    .range([0, chartWidth]);
  
  const yScale = d3.scaleLinear()
    .domain(d3.extent(filteredData, d => +(d.Acres || 0)))
    .range([chartHeight, 0]);
  
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  
  // Add dots
  svg.selectAll('.dot')
    .data(filteredData)
    .enter()
    .append('circle')
    .attr('class', 'dot')
    .attr('cx', d => xScale(+(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0)))
    .attr('cy', d => yScale(+(d.Acres || 0)))
    .attr('r', 3)
    .attr('fill', d => colorScale(d['Install Type']))
    .attr('opacity', 0.7)
    .on('mouseover', function(event, d) {
      d3.select(this).attr('r', 5).attr('opacity', 1);
      
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>${d.County} County</h6>
            <p><strong>Type:</strong> ${d['Install Type']}</p>
            <p><strong>Size:</strong> ${formatNumber(+(d.Acres || 0))} acres</p>
            <p><strong>Grid Distance:</strong> ${formatNumber(+(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0))} miles</p>
          </div>
        `);
      
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 3).attr('opacity', 0.7);
      d3.select('#tooltip').style('display', 'none');
    });
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .style('font-size', '10px');
  
  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .style('font-size', '10px');
  
  // Add axis labels
  svg.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + 35)
    .style('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('fill', '#666')
    .text('Distance to Grid (miles)');
  
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -30)
    .style('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('fill', '#666')
    .text('Installation Size (acres)');
}

// Regional Efficiency Comparison Chart
function drawEfficiencyChart(data, county) {
  const container = '#efficiencyChart';
  
  // Clear previous chart
  d3.select(container).selectAll("*").remove();
  
  const filteredData = county ? data.filter(d => d.County === county) : data;
  
  // Get dimensions
  const { width, height, margin } = getChartDimensions('efficiencyChart');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Aggregate data by county
  const countyData = d3.rollups(
    filteredData,
    v => ({
      count: v.length,
      avgSize: d3.mean(v, d => +(d.Acres || 0)),
      avgInfraScore: d3.mean(v, d => +(d.Infrastructure_Score || 0)),
      avgDistance: d3.mean(v, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0))
    }),
    d => d.County
  ).map(([county, data]) => ({ county, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 counties
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Create scales
  const xScale = d3.scaleBand()
    .domain(countyData.map(d => d.county))
    .range([0, chartWidth])
    .padding(0.1);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(countyData, d => d.avgInfraScore) * 1.1])
    .range([chartHeight, 0]);
  
  // Add bars
  svg.selectAll('.bar')
    .data(countyData)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.county))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', '#3b82f6')
    .attr('opacity', 0.8)
    .transition()
    .duration(600)
    .attr('y', d => yScale(d.avgInfraScore))
    .attr('height', d => chartHeight - yScale(d.avgInfraScore));
  
  // Add interaction
  svg.selectAll('.bar')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 1);
      
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>${d.county} County</h6>
            <p><strong>Installations:</strong> ${formatNumber(d.count)}</p>
            <p><strong>Avg Size:</strong> ${formatNumber(d.avgSize)} acres</p>
            <p><strong>Infrastructure Score:</strong> ${formatNumber(d.avgInfraScore)}</p>
            <p><strong>Avg Grid Distance:</strong> ${formatNumber(d.avgDistance)} miles</p>
          </div>
        `);
      
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 0.8);
      d3.select('#tooltip').style('display', 'none');
    });
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale))
    .style('font-size', '9px')
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');
  
  svg.append('g')
    .call(d3.axisLeft(yScale).ticks(5))
    .style('font-size', '10px');
  
  // Add axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -30)
    .style('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('fill', '#666')
    .text('Infrastructure Score');
}