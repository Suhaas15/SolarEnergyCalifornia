// Index/Dashboard Page JavaScript

// Page initialization
function initializeCurrentPage(solarData, sustainabilityData) {
  console.log('Initializing Dashboard page...');
  
  // Initialize county filter
  const countyFilter = document.getElementById('countyFilter');
  if (countyFilter && solarData) {
    const counties = [...new Set(solarData.map(d => d.County))].sort();
    countyFilter.innerHTML = `
      <option value="">All Counties (${counties.length})</option>
      ${counties.map(county => `<option value="${county}">${county}</option>`).join('')}
    `;
    
    countyFilter.addEventListener('change', function() {
      console.log('County selected:', this.value);
      updateCurrentVisualizations(solarData, sustainabilityData, this.value);
    });
  }

  // Initial visualization update
  updateCurrentVisualizations(solarData, sustainabilityData, '');

  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const selectedCounty = countyFilter ? countyFilter.value : '';
      updateCurrentVisualizations(solarData, sustainabilityData, selectedCounty);
    }, 250);
  });
}

// Update all visualizations for the dashboard
function updateCurrentVisualizations(solarData, sustainabilityData, county) {
  console.log('Updating dashboard visualizations...');
  updateDashboardVisualizations(solarData, sustainabilityData, county);
}

// Main dashboard visualization function
function updateDashboardVisualizations(solarData, sustainabilityData, county = '') {
  const filteredData = county ? solarData.filter(d => d.County === county) : solarData;
  
  // Update dashboard metrics
  updateDashboardMetrics(filteredData, county);
  
  // Draw dashboard charts
  if (document.getElementById('overview-chart')) {
    drawOverviewChart(filteredData, county);
  }
  
  if (document.getElementById('county-breakdown')) {
    drawCountyBreakdown(filteredData, county);
  }
  
  if (document.getElementById('installation-types')) {
    drawInstallationTypesChart(filteredData, county);
  }
  
  if (document.getElementById('capacity-trends')) {
    drawCapacityTrends(filteredData, county);
  }
}

// Update dashboard metrics cards
function updateDashboardMetrics(data, county) {
  const totalInstallations = data.length;
  const totalCapacity = d3.sum(data, d => +(d.Acres || 0));
  const avgCapacity = d3.mean(data, d => +(d.Acres || 0)) || 0;
  const counties = new Set(data.map(d => d.County)).size;
  
  // Calculate type distribution
  const typeDistribution = d3.rollup(data, v => v.length, d => d['Install Type']);
  const rooftopCount = typeDistribution.get('Rooftop') || 0;
  const groundCount = typeDistribution.get('Ground') || 0;
  const parkingCount = typeDistribution.get('Parking') || 0;
  
  // Calculate urban/rural distribution
  const locationDistribution = d3.rollup(data, v => v.length, d => d['Urban or Rural']);
  const urbanCount = locationDistribution.get('Urban') || 0;
  const ruralCount = locationDistribution.get('Rural') || 0;
  
  // Update metric elements
  const updateElement = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  
  updateElement('totalInstallations', formatNumber(totalInstallations));
  updateElement('totalCapacity', formatNumber(totalCapacity));
  updateElement('avgCapacity', formatNumber(avgCapacity));
  updateElement('countiesCount', formatNumber(counties));
  updateElement('rooftopCount', formatNumber(rooftopCount));
  updateElement('groundCount', formatNumber(groundCount));
  updateElement('parkingCount', formatNumber(parkingCount));
  updateElement('urbanCount', formatNumber(urbanCount));
  updateElement('ruralCount', formatNumber(ruralCount));
  
  // Update percentages
  updateElement('rooftopPct', `${((rooftopCount / totalInstallations) * 100).toFixed(1)}%`);
  updateElement('groundPct', `${((groundCount / totalInstallations) * 100).toFixed(1)}%`);
  updateElement('parkingPct', `${((parkingCount / totalInstallations) * 100).toFixed(1)}%`);
  updateElement('urbanPct', `${((urbanCount / totalInstallations) * 100).toFixed(1)}%`);
  updateElement('ruralPct', `${((ruralCount / totalInstallations) * 100).toFixed(1)}%`);
}

// Draw overview chart
function drawOverviewChart(data, county) {
  const container = '#overview-chart';
  d3.select(container).selectAll("*").remove();
  
  const { width, height, margin } = getChartDimensions('overview-chart');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  // Aggregate data by installation type
  const typeData = Array.from(d3.rollup(data,
    v => ({
      count: v.length,
      totalAcres: d3.sum(v, d => +(d.Acres || 0)),
      avgAcres: d3.mean(v, d => +(d.Acres || 0))
    }),
    d => d['Install Type']
  ), ([type, metrics]) => ({ type, ...metrics }));
  
  // Create pie chart
  const radius = Math.min(chartWidth, chartHeight) / 2;
  const pie = d3.pie().value(d => d.count);
  const arc = d3.arc().innerRadius(0).outerRadius(radius - 10);
  
  const g = svg.append('g')
    .attr('transform', `translate(${chartWidth/2}, ${chartHeight/2})`);
  
  const arcs = g.selectAll('.arc')
    .data(pie(typeData))
    .enter()
    .append('g')
    .attr('class', 'arc');
  
  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => colorScales.installationType(d.data.type))
    .attr('stroke', 'white')
    .attr('stroke-width', 2)
    .on('mouseover', function(event, d) {
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>${d.data.type} Installations</h6>
            <p><strong>Count:</strong> ${formatNumber(d.data.count)}</p>
            <p><strong>Total Area:</strong> ${formatNumber(d.data.totalAcres)} acres</p>
            <p><strong>Avg Size:</strong> ${formatNumber(d.data.avgAcres)} acres</p>
            <p><strong>Percentage:</strong> ${((d.data.count / data.length) * 100).toFixed(1)}%</p>
          </div>
        `);
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select('#tooltip').style('display', 'none');
    });
  
  // Add labels
  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', 'white')
    .text(d => d.data.type);
}

// Draw county breakdown chart
function drawCountyBreakdown(data, selectedCounty) {
  const container = '#county-breakdown';
  d3.select(container).selectAll("*").remove();
  
  const { width, height, margin } = getChartDimensions('county-breakdown');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Get top 15 counties by installation count
  const countyData = Array.from(d3.rollup(data,
    v => ({
      count: v.length,
      totalAcres: d3.sum(v, d => +(d.Acres || 0)),
      avgAcres: d3.mean(v, d => +(d.Acres || 0))
    }),
    d => d.County
  ), ([county, metrics]) => ({ county, ...metrics }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  const xScale = d3.scaleBand()
    .domain(countyData.map(d => d.county))
    .range([0, chartWidth])
    .padding(0.1);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(countyData, d => d.count)])
    .range([chartHeight, 0]);
  
  // Draw bars
  svg.selectAll('.bar')
    .data(countyData)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.county))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', d => d.county === selectedCounty ? '#ff6b6b' : '#4ecdc4')
    .transition()
    .duration(800)
    .attr('y', d => yScale(d.count))
    .attr('height', d => chartHeight - yScale(d.count));
  
  // Add interaction
  svg.selectAll('.bar')
    .on('mouseover', function(event, d) {
      d3.select(this).attr('opacity', 0.8);
      
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>${d.county} County</h6>
            <p><strong>Installations:</strong> ${formatNumber(d.count)}</p>
            <p><strong>Total Area:</strong> ${formatNumber(d.totalAcres)} acres</p>
            <p><strong>Avg Size:</strong> ${formatNumber(d.avgAcres)} acres</p>
          </div>
        `);
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select(this).attr('opacity', 1);
      d3.select('#tooltip').style('display', 'none');
    })
    .on('click', function(event, d) {
      const countyFilter = document.getElementById('countyFilter');
      if (countyFilter) {
        countyFilter.value = d.county;
        updateCurrentVisualizations(window.currentSolarData, window.currentSustainabilityData, d.county);
      }
    });
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')
    .style('font-size', '10px');
  
  svg.append('g')
    .call(d3.axisLeft(yScale))
    .style('font-size', '10px');
  
  // Add axis labels
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Number of Installations');
}

// Draw installation types chart
function drawInstallationTypesChart(data, county) {
  const container = '#installation-types';
  d3.select(container).selectAll("*").remove();
  
  const { width, height, margin } = getChartDimensions('installation-types');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Group by type and urban/rural
  const typeLocationData = Array.from(d3.rollup(data,
    v => v.length,
    d => d['Install Type'],
    d => d['Urban or Rural']
  ), ([type, locationMap]) => ({
    type,
    urban: locationMap.get('Urban') || 0,
    rural: locationMap.get('Rural') || 0,
    total: (locationMap.get('Urban') || 0) + (locationMap.get('Rural') || 0)
  }));
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  const xScale = d3.scaleBand()
    .domain(typeLocationData.map(d => d.type))
    .range([0, chartWidth])
    .padding(0.1);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(typeLocationData, d => d.total)])
    .range([chartHeight, 0]);
  
  const colorScale = d3.scaleOrdinal()
    .domain(['urban', 'rural'])
    .range(['#3b82f6', '#10b981']);
  
  // Stack the data
  const stack = d3.stack()
    .keys(['urban', 'rural']);
  
  const stackedData = stack(typeLocationData);
  
  // Draw stacked bars
  svg.selectAll('.series')
    .data(stackedData)
    .enter()
    .append('g')
    .attr('class', 'series')
    .attr('fill', d => colorScale(d.key))
    .selectAll('rect')
    .data(d => d)
    .enter()
    .append('rect')
    .attr('x', d => xScale(d.data.type))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .transition()
    .duration(800)
    .attr('y', d => yScale(d[1]))
    .attr('height', d => yScale(d[0]) - yScale(d[1]));
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale))
    .style('font-size', '10px');
  
  svg.append('g')
    .call(d3.axisLeft(yScale))
    .style('font-size', '10px');
  
  // Add legend
  const legend = svg.append('g')
    .attr('transform', `translate(${chartWidth - 80}, 10)`);
  
  ['urban', 'rural'].forEach((key, i) => {
    const legendRow = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    legendRow.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', colorScale(key));
    
    legendRow.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .style('font-size', '12px')
      .text(key.charAt(0).toUpperCase() + key.slice(1));
  });
}

// Draw capacity trends chart
function drawCapacityTrends(data, county) {
  const container = '#capacity-trends';
  d3.select(container).selectAll("*").remove();
  
  const { width, height, margin } = getChartDimensions('capacity-trends');
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Create size categories for trend analysis
  const sizeCategories = ['Small(<1)', 'Medium(1-5)', 'Large(5-10)', 'X-Large(10+)'];
  const categoryData = sizeCategories.map(category => {
    const categoryCount = data.filter(d => {
      const acres = parseFloat(d.Acres || 0);
      if (isNaN(acres)) return false;
      
      switch(category) {
        case 'Small(<1)': return acres < 1;
        case 'Medium(1-5)': return acres >= 1 && acres < 5;
        case 'Large(5-10)': return acres >= 5 && acres < 10;
        case 'X-Large(10+)': return acres >= 10;
        default: return false;
      }
    }).length;
    return { category, count: categoryCount };
  });
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
  
  const xScale = d3.scaleBand()
    .domain(sizeCategories)
    .range([0, chartWidth])
    .padding(0.1);
  
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(categoryData, d => d.count)])
    .range([chartHeight, 0]);
  
  // Draw bars
  svg.selectAll('.bar')
    .data(categoryData)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(d.category))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', '#8b5cf6')
    .transition()
    .duration(800)
    .attr('y', d => yScale(d.count))
    .attr('height', d => chartHeight - yScale(d.count));
  
  // Add interaction
  svg.selectAll('.bar')
    .on('mouseover', function(event, d) {
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>${d.category} Acres</h6>
            <p><strong>Count:</strong> ${formatNumber(d.count)} installations</p>
            <p><strong>Percentage:</strong> ${((d.count / data.length) * 100).toFixed(1)}%</p>
          </div>
        `);
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select('#tooltip').style('display', 'none');
    });
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${chartHeight})`)
    .call(d3.axisBottom(xScale))
    .style('font-size', '10px');
  
  svg.append('g')
    .call(d3.axisLeft(yScale))
    .style('font-size', '10px');
  
  // Add axis labels
  svg.append('text')
    .attr('x', chartWidth / 2)
    .attr('y', chartHeight + 35)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Installation Size Category');
  
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -chartHeight / 2)
    .attr('y', -margin.left + 15)
    .style('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Number of Installations');
}

// Dashboard page will be initialized by common.js loadData() function