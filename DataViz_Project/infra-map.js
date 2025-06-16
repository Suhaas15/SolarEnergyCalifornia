// Infrastructure Map Page JavaScript

// Page initialization for infrastructure map
function initializeInfraPage(solarData, sustainabilityData) {
  // Prevent double initialization
  if (window.infraMapInitialized) {
    console.log('Infrastructure Map already initialized, skipping...');
    return;
  }
  
  console.log('Initializing Infrastructure Map page...');
  window.infraMapInitialized = true;
  
  // Store data globally for access in filter functions
  window.solarData = solarData;
  window.sustainabilityData = sustainabilityData;
  
  // Populate county filter
  const countyFilter = document.getElementById('countyFilter');
  if (countyFilter && solarData) {
    const counties = [...new Set(solarData.map(d => d.County))].sort();
    countyFilter.innerHTML = '<option value="">All Counties</option>';
    counties.forEach(county => {
      const option = document.createElement('option');
      option.value = county;
      option.textContent = county;
      countyFilter.appendChild(option);
    });
    
    // Add event listener for county changes only if not already added
    if (!countyFilter.hasAttribute('data-listener-added')) {
      countyFilter.addEventListener('change', function() {
        updateInfraMapVisualizations(solarData, sustainabilityData, this.value);
      });
      countyFilter.setAttribute('data-listener-added', 'true');
    }
  }
  
  // Initialize filters with actual data
  initializeMapFilters(solarData);
  
  // Initial render
  updateInfraMapVisualizations(solarData, sustainabilityData, '');
}

// Update all visualizations for the infrastructure map page
function updateInfraVisualizations(solarData, sustainabilityData, county) {
  updateInfraMapVisualizations(solarData, sustainabilityData, county);
}

// Main function to update infrastructure map visualizations
function updateInfraMapVisualizations(data, sustainabilityData, county) {
  console.log('updateInfraMapVisualizations called with:', {
    dataLength: data?.length,
    county: county,
    sustainabilityDataLength: sustainabilityData?.length
  });
  
  // Prevent multiple simultaneous updates
  if (window.infraMapUpdating) {
    console.log('Update already in progress, skipping...');
    return;
  }
  window.infraMapUpdating = true;
  
  const mapElement = document.getElementById('map');
  if (mapElement) {
    try {
      console.log('Drawing infrastructure map...', { county, dataLength: data?.length });
      
      // Show loading state
      const loadingEl = document.getElementById('loading');
      if (loadingEl) {
        loadingEl.style.display = 'flex';
        console.log('Showing loading overlay');
      }
      
      // Get filtered data
      const filteredData = getFilteredData(data);
      console.log('Filtered data length:', filteredData.length);
      
      // Use default color metric since dropdown was removed
      const colorMetric = 'installation_density';
      console.log('Color metric:', colorMetric);
      
      // Aggregate data by county for the map
      const countyDataAggregated = aggregateDataByCounty(filteredData, colorMetric);
      console.log('County data aggregated:', countyDataAggregated.size, 'counties');
      console.log('Sample aggregated data:', Array.from(countyDataAggregated.entries()).slice(0, 5));
      console.log('Sample filtered data counties:', [...new Set(filteredData.slice(0, 10).map(d => d.County))]);
      
      updateMapMetrics(filteredData, county);
      
      // Test metrics display
      setTimeout(() => {
        const testElements = {
          totalInstallations: document.getElementById('totalInstallations'),
          totalAcres: document.getElementById('totalAcres'),
          avgDistance: document.getElementById('avgDistance')
        };
        console.log('Testing metrics elements:', testElements);
        
        if (testElements.totalInstallations && testElements.totalInstallations.textContent === '-') {
          console.warn('Metrics still showing dashes, forcing update...');
          testElements.totalInstallations.textContent = filteredData.length.toLocaleString();
          testElements.totalAcres.textContent = d3.sum(filteredData, d => +d.Acres || 0).toFixed(2) + ' acres';
          testElements.avgDistance.textContent = (d3.mean(filteredData, d => +d['Distance to Substation (Miles) CAISO'] || +d.Avg_Distance_Substation || 0) || 0).toFixed(1) + ' mi';
        }
      }, 100);
      
      drawInfraMap(filteredData, 'california-counties.json', colorMetric, countyDataAggregated, county);
      drawCapacityChart(filteredData, county);
      
      // Hide loading state
      setTimeout(() => {
        if (loadingEl) {
          loadingEl.style.display = 'none';
          console.log('Hiding loading overlay');
        }
        window.infraMapUpdating = false;
      }, 1000);
      
    } catch (error) {
      console.error('Error updating infrastructure visualizations:', error);
      window.infraMapUpdating = false;
      const loadingEl = document.getElementById('loading');
      if (loadingEl) {
        loadingEl.innerHTML = `
          <div class="alert alert-danger">
            <strong>Error:</strong> ${error.message}
          </div>
        `;
      }
    }
  } else {
    console.error('Map element not found!');
    window.infraMapUpdating = false;
  }
}

// Helper function to aggregate data by county for the map visualization
function aggregateDataByCounty(data, colorMetric) {
  console.log('Aggregating data for', data.length, 'records by county for metric:', colorMetric);
  
  return d3.rollup(
    data,
    v => {
      const installations = v.length;
      const totalArea = d3.sum(v, d => {
        const acres = parseFloat(d.Acres);
        // Validate acre values
        if (isNaN(acres)) {
          console.warn(`Invalid acre value found for installation in ${d.County}: ${d.Acres}`);
          return 0;
        }
        if (acres < 0) {
          console.warn(`Negative acre value found for installation in ${d.County}: ${d.Acres}`);
          return 0;
        }
        if (acres > 1000) {
          console.warn(`Unusually large acre value found for installation in ${d.County}: ${d.Acres}`);
        }
        return acres;
      });
      
      // Calculate average installation size
      const avgInstallationSize = totalArea / installations;
      
      const avgInfraScore = d3.mean(v, d => +(d.Infrastructure_Score || 0)) || 0;
      const avgDistance = d3.mean(v, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0)) || 0;
      
      return {
        installations,
        totalArea,
        avgInstallationSize,
        avgInfraScore,
        avgDistance,
        count: installations,
        total_acres: totalArea,
        infrastructure_score: avgInfraScore,
        avg_distance_substation: avgDistance
      };
    },
    d => d.County
  );
}

// Configuration for different color metrics
function getColorMetricConfig(colorMetric, countyDataAggregated) {
  const allValues = Array.from(countyDataAggregated.values());
  console.log('All values for color scale:', allValues.length, 'counties');
  console.log('Sample values:', allValues.slice(0, 3));
  
  const configs = {
    installation_density: {
      accessor: 'installations',
      label: '🏠 Solar Installation Density',
      scale: d3.scaleSequential(d3.interpolateYlOrRd)
        .domain(d3.extent(allValues, d => d.installations) || [0, 1])
    },
    total_acres: {
      accessor: 'totalArea', 
      label: '🌱 Total Solar Coverage (acres)',
      scale: d3.scaleSequential(d3.interpolateGreens)
        .domain(d3.extent(allValues, d => d.totalArea) || [0, 1])
    },
    avg_installation_size: {
      accessor: 'avgInstallationSize',
      label: '📏 Average Installation Size (acres)',
      scale: d3.scaleSequential(d3.interpolateBlues)
        .domain(d3.extent(allValues, d => d.avgInstallationSize) || [0, 1])
    },
    infrastructure_score: {
      accessor: 'avgInfraScore',
      label: '⚡ Grid Readiness Score', 
      scale: d3.scaleSequential(d3.interpolatePlasma)
        .domain(d3.extent(allValues, d => d.avgInfraScore) || [0, 1])
    },
    avg_distance: {
      accessor: 'avgDistance',
      label: '📍 Grid Proximity',
      scale: d3.scaleSequential(d3.interpolateRdYlBu).range([1, 0])
        .domain(d3.extent(allValues, d => d.avgDistance) || [0, 1])
    }
  };
  
  return configs[colorMetric] || configs.installation_density;
}

// Generate legend for the map
function generateLegend(svg, colorScale, label, svgHeight) {
  const legendWidth = 240;
  const legendHeight = 20;
  const legendMargin = 20;
  
  // Remove existing legend
  svg.select('.map-legend').remove();
  
  const legend = svg.append('g')
    .attr('class', 'map-legend')
    .attr('transform', `translate(${legendMargin}, ${svgHeight - legendHeight - 50})`);
  
  // Create gradient
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
  const gradient = defs.select('#map-gradient').empty() ? 
    defs.append('linearGradient').attr('id', 'map-gradient') : 
    defs.select('#map-gradient');
  
  gradient.selectAll('stop').remove();
  
  const domain = colorScale.domain();
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const value = domain[0] + (domain[1] - domain[0]) * (i / steps);
    gradient.append('stop')
      .attr('offset', `${(i / steps) * 100}%`)
      .attr('stop-color', colorScale(value));
  }
  
  // Legend background
  legend.append('rect')
    .attr('x', -10)
    .attr('y', -25)
    .attr('width', legendWidth + 20)
    .attr('height', legendHeight + 50)
    .attr('rx', 8)
    .style('fill', 'rgba(255, 255, 255, 0.95)')
    .style('stroke', '#ddd')
    .style('stroke-width', 1);
  
  // Legend rectangle
  legend.append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', 'url(#map-gradient)')
    .style('stroke', '#999')
    .style('stroke-width', 1)
    .attr('rx', 3);
  
  // Legend labels
  const minValue = domain[0];
  const maxValue = domain[1];
  const midValue = (minValue + maxValue) / 2;
  
  legend.append('text')
    .attr('x', 0)
    .attr('y', legendHeight + 15)
    .style('font-size', '11px')
    .style('font-weight', '500')
    .style('fill', '#555')
    .text(formatLegendValue(minValue, label));
  
  legend.append('text')
    .attr('x', legendWidth / 2)
    .attr('y', legendHeight + 15)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', '500')
    .style('fill', '#555')
    .text(formatLegendValue(midValue, label));
  
  legend.append('text')
    .attr('x', legendWidth)
    .attr('y', legendHeight + 15)
    .attr('text-anchor', 'end')
    .style('font-size', '11px')
    .style('font-weight', '500')
    .style('fill', '#555')
    .text(formatLegendValue(maxValue, label));
  
  // Legend title
  legend.append('text')
    .attr('x', legendWidth / 2)
    .attr('y', -8)
    .attr('text-anchor', 'middle')
    .style('font-size', '13px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text(label);
}

// Helper function to format legend values
function formatLegendValue(value, label) {
  if (label.includes('Density') || label.includes('Count')) {
    return Math.round(value).toString();
  } else if (label.includes('acres')) {
    return value < 1000 ? Math.round(value) + '' : (value/1000).toFixed(1) + 'K';
  } else if (label.includes('miles')) {
    return value.toFixed(1) + 'mi';
  } else if (label.includes('Score')) {
    return Math.round(value) + '%';
  }
  return formatNumber(value);
}

// Initialize map filters
function initializeMapFilters(solarData) {
  if (window.mapFiltersInitialized) return;
  window.mapFiltersInitialized = true;
  
  console.log('Initializing map filters...');
  


  // Installation type filter
  const installTypeRadios = document.querySelectorAll('input[name="installType"]');
  installTypeRadios.forEach(radio => {
    if (!radio.hasAttribute('data-listener-added')) {
      radio.addEventListener('change', function() {
        updateInfraMapVisualizations(window.solarData, window.sustainabilityData, document.getElementById('countyFilter')?.value || '');
      });
      radio.setAttribute('data-listener-added', 'true');
    }
  });

  // Location type filter
  const locationTypeRadios = document.querySelectorAll('input[name="locationType"]');
  locationTypeRadios.forEach(radio => {
    if (!radio.hasAttribute('data-listener-added')) {
      radio.addEventListener('change', function() {
        updateInfraMapVisualizations(window.solarData, window.sustainabilityData, document.getElementById('countyFilter')?.value || '');
      });
      radio.setAttribute('data-listener-added', 'true');
    }
  });

  // Size filter dropdown
  const sizeFilter = document.getElementById('sizeFilter');
  if (sizeFilter && !sizeFilter.hasAttribute('data-listener-added')) {
    sizeFilter.addEventListener('change', function() {
      updateInfraMapVisualizations(window.solarData, window.sustainabilityData, '');
    });
    sizeFilter.setAttribute('data-listener-added', 'true');
  }
  
  // Distance filter dropdown
  const distanceFilter = document.getElementById('distanceFilter');
  if (distanceFilter && !distanceFilter.hasAttribute('data-listener-added')) {
    distanceFilter.addEventListener('change', function() {
      updateInfraMapVisualizations(window.solarData, window.sustainabilityData, '');
    });
    distanceFilter.setAttribute('data-listener-added', 'true');
  }
}

// Get filtered data based on current filter settings
function getFilteredData(data) {
  if (!data || data.length === 0) {
    console.warn('getFilteredData: No data provided');
    return [];
  }
  
  const installTypeRadios = document.querySelectorAll('input[name="installType"]');
  const locationTypeRadios = document.querySelectorAll('input[name="locationType"]');
  const sizeFilter = document.getElementById('sizeFilter')?.value;
  const distanceFilter = document.getElementById('distanceFilter')?.value;
  
  let filtered = [...data];
  console.log('Starting with', filtered.length, 'records');
  
  // Apply installation type filter
  const selectedInstallType = Array.from(installTypeRadios).find(radio => radio.checked)?.value;
  if (selectedInstallType) {
    filtered = filtered.filter(d => d['Install Type'] === selectedInstallType);
    console.log('After install type filter (' + selectedInstallType + '):', filtered.length, 'records');
  }
  
  // Apply location type filter
  const selectedLocationType = Array.from(locationTypeRadios).find(radio => radio.checked)?.value;
  if (selectedLocationType) {
    filtered = filtered.filter(d => d['Urban or Rural'] === selectedLocationType);
    console.log('After location type filter (' + selectedLocationType + '):', filtered.length, 'records');
  }
  
  // Apply size filter - now handles dropdown ranges
  if (sizeFilter && sizeFilter !== "") {
    filtered = filtered.filter(d => {
      const acres = parseFloat(d.Acres || 0);
      if (isNaN(acres)) return false;
      
      switch(sizeFilter) {
        case '0-5': return acres >= 0 && acres < 5;
        case '5-10': return acres >= 5 && acres < 10;
        case '10-15': return acres >= 10 && acres < 15;
        case '15-25': return acres >= 15 && acres < 25;
        case '25+': return acres >= 25;
        default: return true;
      }
    });
    console.log('After size filter (' + sizeFilter + '):', filtered.length, 'records');
  }
  
  // Apply distance filter - now handles dropdown ranges
  if (distanceFilter && distanceFilter !== "") {
    filtered = filtered.filter(d => {
      const distance = parseFloat(d['Distance to Substation (Miles) CAISO'] || d.Avg_Distance_Substation || 0);
      if (isNaN(distance)) return false;
      
      switch(distanceFilter) {
        case '0-5': return distance >= 0 && distance < 5;
        case '5-10': return distance >= 5 && distance < 10;
        case '10-15': return distance >= 10 && distance < 15;
        case '15-25': return distance >= 15 && distance < 25;
        case '25+': return distance >= 25;
        default: return true;
      }
    });
    console.log('After distance filter (' + distanceFilter + '):', filtered.length, 'records');
  }
  
  console.log('Final filtered data:', filtered.length, 'records');
  return filtered;
}

// Update map metrics
function updateMapMetrics(data, county) {
  console.log('Updating metrics with data:', data?.length, 'records for county:', county);
  
  const updateElement = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
      console.log('Updated', id, 'to:', value);
    } else {
      console.warn('Element not found:', id);
    }
  };

  if (!data || data.length === 0) {
    updateElement('totalInstallations', formatMetricValue(0, 'count'));
    updateElement('totalAcres', formatMetricValue(0, 'acres'));
    updateElement('avgDistance', formatMetricValue(0, 'miles'));
    return;
  }

  // Calculate metrics
  const totalInstallations = data.length;
  const totalAcres = d3.sum(data, d => {
    const acres = parseFloat(d.Acres);
    return isNaN(acres) ? 0 : acres;
  });
  const avgDistance = d3.mean(data, d => {
    const distance = parseFloat(d['Distance to Substation (Miles) CAISO']) || parseFloat(d.Avg_Distance_Substation);
    return isNaN(distance) ? 0 : distance;
  });

  // Update metric displays
  updateElement('totalInstallations', formatMetricValue(totalInstallations, 'count'));
  updateElement('totalAcres', formatMetricValue(totalAcres, 'acres'));
  updateElement('avgDistance', formatMetricValue(avgDistance || 0, 'miles'));
}

// Draw the infrastructure map
async function drawInfraMap(mapData, geoJsonPath, colorMetric, countyDataAggregated, selectedCounty = null) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Prevent multiple simultaneous map draws
    if (window.mapDrawing) {
        console.log('Map already drawing, skipping...');
        return;
    }
    window.mapDrawing = true;

    console.log('Map container dimensions:', {
        width: mapContainer.clientWidth,
        height: mapContainer.clientHeight
    });

    try {
        console.log('Loading GeoJSON from:', geoJsonPath);
        
        // Check if we already have the GeoJSON data cached
        if (!window.cachedCaliforniaGeoJSON) {
            const california = await d3.json(geoJsonPath);
            window.cachedCaliforniaGeoJSON = california;
            console.log('GeoJSON loaded and cached successfully. Features:', california.features ? california.features.length : 'Unknown');
        } else {
            console.log('Using cached GeoJSON data');
        }
        
        const california = window.cachedCaliforniaGeoJSON;
        
        // Clear existing map
        mapContainer.innerHTML = '';
        
        // Set up the map dimensions
        const width = mapContainer.clientWidth || 800;
        const height = mapContainer.clientHeight || 600;
        
        // Create SVG with viewBox for responsive scaling
        const svg = d3.select(mapContainer)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('background', '#f8f9fa'); // Temporary background to see if SVG is visible
            
        console.log('SVG created with dimensions:', width, 'x', height);
        
        // Add defs for gradients
        svg.append('defs');
        
        // Create a group for the map
        const g = svg.append('g');
        
        // Add a test rectangle to make sure SVG is working
        g.append('rect')
            .attr('x', 10)
            .attr('y', 10) 
            .attr('width', 50)
            .attr('height', 30)
            .attr('fill', 'red')
            .attr('opacity', 0.5);
            
        console.log('Test rectangle added to SVG');
        
        // Check for different possible structures
        let counties;
        if (california.features) {
            // Regular GeoJSON
            counties = california;
        } else if (california.objects && california.objects.counties) {
            // TopoJSON
            counties = topojson.feature(california, california.objects.counties);
        } else if (california.objects && california.objects.collection) {
            // Alternative TopoJSON structure
            counties = topojson.feature(california, california.objects.collection);
        } else {
            throw new Error('Could not find county features in GeoJSON data');
        }
        
        // Create a projection
        const projection = d3.geoMercator()
            .fitSize([width, height], counties);
        
        // Create a path generator
        const path = d3.geoPath().projection(projection);
        
        // Get color configuration
        const colorConfig = getColorMetricConfig(colorMetric, countyDataAggregated);
        console.log('Color config:', colorConfig);
        
        // Debug: Check first few county names from GeoJSON
        const geoCountyNames = counties.features.slice(0, 5).map(d => d.properties.NAME || d.properties.name || d.properties.COUNTY);
        console.log('Sample GeoJSON county names:', geoCountyNames);
        
        // Draw counties
        const paths = g.selectAll('path')
            .data(counties.features)
            .enter()
            .append('path')
            .attr('d', path)
            .attr('class', 'county')
            .style('fill', d => {
                const countyName = d.properties.NAME || d.properties.name || d.properties.COUNTY;
                const countyData = countyDataAggregated.get(countyName);
                let fillColor;
                
                if (countyData && colorConfig.scale && !isNaN(countyData[colorConfig.accessor])) {
                    fillColor = colorConfig.scale(countyData[colorConfig.accessor]);
                } else {
                    fillColor = '#e9ecef'; // Default gray for counties with no data
                }
                
                // Only log first few counties to avoid spam
                if (counties.features.indexOf(d) < 5) {
                    console.log('County:', countyName, 'Data:', countyData, 'Accessor value:', countyData ? countyData[colorConfig.accessor] : 'N/A', 'Color:', fillColor);
                }
                return fillColor;
            })
            .style('stroke', '#2563eb')
            .style('stroke-width', 1)
            .on('mouseover', function(event, d) {
                const countyName = d.properties.NAME || d.properties.name || d.properties.COUNTY;
                const countyData = countyDataAggregated.get(countyName);
                if (countyData) {
                    d3.select(this)
                        .style('stroke', '#000')
                        .style('stroke-width', 2);
                    
                    // Show tooltip
                    const tooltip = d3.select('#tooltip');
                    if (tooltip.empty()) {
                        d3.select('body').append('div')
                            .attr('id', 'tooltip')
                            .style('position', 'absolute')
                            .style('background', 'rgba(0,0,0,0.8)')
                            .style('color', 'white')
                            .style('padding', '10px')
                            .style('border-radius', '5px')
                            .style('font-size', '12px')
                            .style('pointer-events', 'none')
                            .style('opacity', 0);
                    }
                    
                    d3.select('#tooltip')
                        .style('display', 'block')
                        .style('opacity', 1)
                        .html(`
                            <div class="tooltip-content">
                                <h6>${countyName} County</h6>
                                <div class="tooltip-details">
                                    <p><strong>Solar Installations Found:</strong> ${formatMetricValue(countyData.installations, 'count')}</p>
                                    <p><strong>Total Land Coverage:</strong> ${formatMetricValue(countyData.totalArea, 'acres')}</p>
                                    <p><strong>Grid Readiness Score:</strong> ${countyData.avgInfraScore.toFixed(2)}</p>
                                    <p><strong>Avg Distance to Power Grid:</strong> ${formatMetricValue(countyData.avgDistance, 'miles')}</p>
                                </div>
                            </div>
                        `)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                }
            })
            .on('mouseout', function() {
                d3.select(this)
                    .style('stroke', '#2563eb')
                    .style('stroke-width', 1);
                d3.select('#tooltip').style('display', 'none').style('opacity', 0);
            });
        
        console.log('Drew', paths.size(), 'county paths');
        console.log('County features available:', counties.features.length);
        console.log('Paths selection:', paths);
        
        // Test if any paths were actually created
        const allPaths = g.selectAll('path');
        console.log('Total paths in group:', allPaths.size());
        
        // Generate legend
        generateLegend(svg, colorConfig.scale, colorConfig.label, height);
        
        // Highlight selected county if any
        if (selectedCounty) {
            g.selectAll('path')
                .filter(d => {
                    const countyName = d.properties.NAME || d.properties.name || d.properties.COUNTY;
                    return countyName === selectedCounty;
                })
                .style('stroke', '#000')
                .style('stroke-width', 2);
        }
        
        console.log('Map rendered successfully');
        
    } catch (error) {
        console.error('Error drawing map:', error);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="alert alert-danger">
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }
    } finally {
        window.mapDrawing = false;
    }
}

// Add tooltip positioning function at the top of the file
function positionTooltip(event, tooltip) {
  const tooltipNode = tooltip.node();
  if (!tooltipNode) return;

  const tooltipWidth = tooltipNode.offsetWidth;
  const tooltipHeight = tooltipNode.offsetHeight;
  const padding = 10;

  let left = event.pageX + padding;
  let top = event.pageY + padding;

  // Adjust if tooltip would go off the right side
  if (left + tooltipWidth > window.innerWidth - padding) {
    left = event.pageX - tooltipWidth - padding;
  }

  // Adjust if tooltip would go off the bottom
  if (top + tooltipHeight > window.innerHeight - padding) {
    top = event.pageY - tooltipHeight - padding;
  }

  tooltip
    .style('left', left + 'px')
    .style('top', top + 'px');
}

// 2D Density Heatmap for Size vs Distance Analysis
function drawCapacityChart(data, county) {
  console.log('Drawing capacity chart with', data.length, 'installations');
  
  const margin = { top: 40, right: 100, bottom: 60, left: 80 };
  const width = 1200 - margin.left - margin.right;
  const height = 320 - margin.top - margin.bottom;
  
  // Clear existing chart
  d3.select('#capacityChart').selectAll('*').remove();
  
  // Create SVG container
  const svg = d3.select('#capacityChart')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Process data
  const validData = data.filter(d => {
    const size = +d.Acres;
    const distance = +d['Distance to Substation (Miles) CAISO'] || +d.Avg_Distance_Substation;
    return !isNaN(size) && !isNaN(distance) && size > 0 && distance >= 0;
  });

  // Create scales
  const sizeExtent = d3.extent(validData, d => +d.Acres);
  const distanceExtent = d3.extent(validData, d => +d['Distance to Substation (Miles) CAISO'] || +d.Avg_Distance_Substation);
  
  // Add some padding to the extents
  const sizePadding = (sizeExtent[1] - sizeExtent[0]) * 0.05;
  const distancePadding = (distanceExtent[1] - distanceExtent[0]) * 0.05;
  
  const xScale = d3.scaleLinear()
    .domain([sizeExtent[0] - sizePadding, sizeExtent[1] + sizePadding])
    .range([0, width]);
  
  const yScale = d3.scaleLinear()
    .domain([distanceExtent[0] - distancePadding, distanceExtent[1] + distancePadding])
    .range([height, 0]);

  // Add grid lines
  svg.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line')
    .data(xScale.ticks(10))
    .enter()
    .append('line')
    .attr('x1', d => xScale(d))
    .attr('x2', d => xScale(d))
    .attr('y1', 0)
    .attr('y2', height)
    .style('stroke', '#f0f0f0')
    .style('stroke-width', 1);

  svg.append('g')
    .attr('class', 'grid-lines')
    .selectAll('line')
    .data(yScale.ticks(8))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', width)
    .attr('y1', d => yScale(d))
    .attr('y2', d => yScale(d))
    .style('stroke', '#f0f0f0')
    .style('stroke-width', 1);

  // Create a color scale for installation types
  const typeColorScale = d3.scaleOrdinal()
    .domain(['Rooftop', 'Ground', 'Parking'])
    .range(['#3b82f6', '#10b981', '#f59e0b']);

  // Add scatter plot points
  const points = svg.append('g')
    .attr('class', 'points')
    .selectAll('circle')
    .data(validData)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(+d.Acres))
    .attr('cy', d => yScale(+d['Distance to Substation (Miles) CAISO'] || +d.Avg_Distance_Substation))
    .attr('r', 4)
    .style('fill', d => typeColorScale(d['Install Type']))
    .style('fill-opacity', 0.6)
    .style('stroke', d => typeColorScale(d['Install Type']))
    .style('stroke-width', 1)
    .style('stroke-opacity', 0.8);

  // Add hover interactions
  points.on('mouseover', function(event, d) {
    // Highlight the point
    d3.select(this)
      .transition()
      .duration(150)
      .attr('r', 6)
      .style('fill-opacity', 1)
      .style('stroke-width', 2);

    // Show tooltip
    const tooltip = d3.select('#tooltip');
    const size = +d.Acres;
    const distance = +d['Distance to Substation (Miles) CAISO'] || +d.Avg_Distance_Substation;
    
    tooltip
      .style('display', 'block')
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .html(`
        <div style="font-weight: bold; margin-bottom: 5px;">Installation Details</div>
        <div>📏 Size: ${size.toFixed(1)} acres</div>
        <div>🔌 Grid Distance: ${distance.toFixed(1)} mi</div>
        <div>🏢 Type: ${formatInstallationType(d['Install Type'])}</div>
        <div>📍 County: ${d.County}</div>
      `);
  })
  .on('mouseout', function() {
    // Reset point style
    d3.select(this)
      .transition()
      .duration(150)
      .attr('r', 4)
      .style('fill-opacity', 0.6)
      .style('stroke-width', 1);

    // Hide tooltip
    d3.select('#tooltip').style('display', 'none');
  });

  // Add trend line
  const trendLine = d3.line()
    .x(d => d[0])
    .y(d => d[1])
    .curve(d3.curveBasis);

  // Calculate trend line points
  const trendData = d3.pairs(
    d3.range(0, 1.1, 0.1).map(t => {
      const x = xScale.invert(t * width);
      const relevantPoints = validData.filter(d => 
        Math.abs(+d.Acres - x) < (sizeExtent[1] - sizeExtent[0]) * 0.1
      );
      const y = d3.mean(relevantPoints, d => 
        +d['Distance to Substation (Miles) CAISO'] || +d.Avg_Distance_Substation
      ) || yScale.invert(height / 2);
      return [xScale(x), yScale(y)];
    })
  );

  // Add trend line
  svg.append('path')
    .datum(trendData)
    .attr('class', 'trend-line')
    .attr('fill', 'none')
    .attr('stroke', '#6b7280')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,4')
    .attr('d', trendLine);

  // Add axes
  const xAxis = d3.axisBottom(xScale)
    .ticks(6)
    .tickFormat(d => d + ' ac');

  const yAxis = d3.axisLeft(yScale)
    .ticks(8)
    .tickFormat(d => d + ' mi');

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);

  svg.append('g')
    .call(yAxis);

  // Add axis labels
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + margin.bottom - 10)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Installation Size (acres)');

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -margin.left + 30)
    .attr('text-anchor', 'middle')
    .style('font-size', '14px')
    .text('Distance to Grid (miles)');

  // Add legend
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width + 20}, 0)`);

  const types = ['Rooftop', 'Ground', 'Parking'];
  
  legend.selectAll('circle')
    .data(types)
    .enter()
    .append('circle')
    .attr('cx', 10)
    .attr('cy', (d, i) => i * 25 + 10)
    .attr('r', 4)
    .style('fill', d => typeColorScale(d))
    .style('fill-opacity', 0.6)
    .style('stroke', d => typeColorScale(d));

  legend.selectAll('text')
    .data(types)
    .enter()
    .append('text')
    .attr('x', 20)
    .attr('y', (d, i) => i * 25 + 10)
    .attr('dy', '0.35em')
    .style('font-size', '12px')
    .text(d => formatInstallationType(d));

  // Add trend line explanation
  legend.append('line')
    .attr('x1', 5)
    .attr('x2', 15)
    .attr('y1', 85)
    .attr('y2', 85)
    .style('stroke', '#6b7280')
    .style('stroke-width', 2)
    .style('stroke-dasharray', '4,4');

  legend.append('text')
    .attr('x', 20)
    .attr('y', 85)
    .attr('dy', '0.35em')
    .style('font-size', '12px')
    .text('Trend Line');
}

// Helper function to format size ranges
function formatSizeRange(min, max) {
  return `${min.toFixed(1)} - ${max.toFixed(1)} acres`;
}

// Helper function to format distance ranges
function formatDistanceRange(min, max) {
  return `${min.toFixed(1)} - ${max.toFixed(1)} miles`;
}

// Helper function to format installation types
function formatInstallationType(type) {
  const icons = {
    'Rooftop': '🏠',
    'Ground': '🌱',
    'Parking': '🅿️'
  };
  return `${icons[type] || '📍'} ${type}`;
}

// Infrastructure map page will be initialized by common.js loadData() function

// Map control functions
function zoomIn() {
  console.log('Zooming in...');
  if (typeof mapZoomIn === 'function') {
    mapZoomIn();
  }
}

function zoomOut() {
  console.log('Zooming out...');
  if (typeof mapZoomOut === 'function') {
    mapZoomOut();
  }
}

function resetZoom() {
  console.log('Resetting zoom...');
  if (typeof mapResetView === 'function') {
    mapResetView();
  }
} 