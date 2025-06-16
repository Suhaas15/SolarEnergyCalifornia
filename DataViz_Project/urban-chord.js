// Urban Chord Diagram Page JavaScript

// Page initialization
function initializeCurrentPage(solarData, sustainabilityData) {
  console.log('Initializing Urban Chord page...');
  
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

// Update all visualizations for the urban chord page
function updateCurrentVisualizations(solarData, sustainabilityData, county) {
  updateChordVisualizations(solarData, county);
}

// Update chord visualizations
function updateChordVisualizations(data, county) {
  try {
    updateChordMetrics(data, county);
    
    const filteredData = county ? data.filter(d => d.County === county) : data;
    
    // Calculate energy connections
    const energyConnections = calculateEnergyConnections(filteredData);
    
    // Draw main chord diagram
    drawChordDiagram(energyConnections, county);
    
    // Update additional visualizations
    updateTopConnections(filteredData, county);
    
  } catch (error) {
    console.error('Error updating chord visualizations:', error);
  }
}

// Update chord metrics
function updateChordMetrics(data, county) {
  const filteredData = county ? data.filter(d => d.County === county) : data;
  
  // Calculate metrics
  const totalInstallations = filteredData.length;
  const totalCapacity = d3.sum(filteredData, d => +(d.Acres || 0));
  const avgCapacity = d3.mean(filteredData, d => +(d.Acres || 0)) || 0;
  
  // Urban/Rural distribution
  const urbanCount = filteredData.filter(d => d['Urban or Rural'] === 'Urban').length;
  const ruralCount = filteredData.filter(d => d['Urban or Rural'] === 'Rural').length;
  
  // Installation type distribution
  const rooftopCount = filteredData.filter(d => d['Install Type'] === 'Rooftop').length;
  const groundCount = filteredData.filter(d => d['Install Type'] === 'Ground').length;
  const parkingCount = filteredData.filter(d => d['Install Type'] === 'Parking').length;
  
  // Grid connectivity metrics
  const avgDistance = d3.mean(filteredData, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0)) || 0;
  const avgInfraScore = d3.mean(filteredData, d => +(d.Infrastructure_Score || 0)) || 0;
  
  // Update DOM elements
  const updateElement = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  
  updateElement('totalConnections', formatNumber(totalInstallations));
  updateElement('totalEnergyFlow', formatNumber(totalCapacity));
  updateElement('avgConnectionStrength', formatNumber(avgCapacity));
  updateElement('networkDensity', formatNumber(avgInfraScore));
  updateElement('urbanConnections', formatNumber(urbanCount));
  updateElement('ruralConnections', formatNumber(ruralCount));
  updateElement('rooftopConnections', formatNumber(rooftopCount));
  updateElement('groundConnections', formatNumber(groundCount));
  updateElement('parkingConnections', formatNumber(parkingCount));
  updateElement('avgGridDistance', formatNumber(avgDistance));
  
  // Update percentages
  if (totalInstallations > 0) {
    updateElement('urbanPct', `${((urbanCount / totalInstallations) * 100).toFixed(1)}%`);
    updateElement('ruralPct', `${((ruralCount / totalInstallations) * 100).toFixed(1)}%`);
  }
}

// Calculate energy connections for chord diagram
function calculateEnergyConnections(data) {
  // Define categories for connections
  const categories = {
    'Urban-Rooftop': data.filter(d => d['Urban or Rural'] === 'Urban' && d['Install Type'] === 'Rooftop').length,
    'Urban-Ground': data.filter(d => d['Urban or Rural'] === 'Urban' && d['Install Type'] === 'Ground').length,
    'Urban-Parking': data.filter(d => d['Urban or Rural'] === 'Urban' && d['Install Type'] === 'Parking').length,
    'Rural-Rooftop': data.filter(d => d['Urban or Rural'] === 'Rural' && d['Install Type'] === 'Rooftop').length,
    'Rural-Ground': data.filter(d => d['Urban or Rural'] === 'Rural' && d['Install Type'] === 'Ground').length,
    'Rural-Parking': data.filter(d => d['Urban or Rural'] === 'Rural' && d['Install Type'] === 'Parking').length
  };
  
  // Create matrix for chord diagram
  const labels = Object.keys(categories);
  const matrix = [];
  
  // Create connections matrix
  for (let i = 0; i < labels.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < labels.length; j++) {
      if (i === j) {
        matrix[i][j] = categories[labels[i]];
      } else {
        // Create synthetic connections between similar categories
        const label1 = labels[i];
        const label2 = labels[j];
        
        // Higher connections between same location type
        if (label1.split('-')[0] === label2.split('-')[0]) {
          matrix[i][j] = Math.floor(Math.min(categories[label1], categories[label2]) * 0.3);
        } else {
          matrix[i][j] = Math.floor(Math.min(categories[label1], categories[label2]) * 0.1);
        }
      }
    }
  }
  
  return { matrix, labels };
}

// Draw chord diagram
function drawChordDiagram(data, county) {
  const container = '#chordDiagram';
  
  // Clear previous diagram
  d3.select(container).selectAll("*").remove();
  
  const { width, height, margin } = getChartDimensions('chordDiagram');
  const radius = Math.min(width, height) / 2 - 40;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width/2},${height/2})`);
  
  // Color scale
  const color = d3.scaleOrdinal()
    .domain(data.labels)
    .range(['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3']);
  
  // Create chord layout
  const chord = d3.chord()
    .padAngle(0.05)
    .sortSubgroups(d3.descending);
  
  const arc = d3.arc()
    .innerRadius(radius - 30)
    .outerRadius(radius - 10);
  
  const ribbon = d3.ribbon()
    .radius(radius - 30);
  
  // Generate chords
  const chords = chord(data.matrix);
  
  // Draw outer arcs
  const group = svg.append('g')
    .selectAll('g')
    .data(chords.groups)
    .enter()
    .append('g');
  
  group.append('path')
    .style('fill', d => color(data.labels[d.index]))
    .style('stroke', d => d3.rgb(color(data.labels[d.index])).darker())
    .attr('d', arc)
    .on('mouseover', function(event, d) {
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>${data.labels[d.index]}</h6>
            <p><strong>Connections:</strong> ${formatNumber(d.value)}</p>
            <p><strong>Category:</strong> ${data.labels[d.index].split('-')[0]} ${data.labels[d.index].split('-')[1]}</p>
          </div>
        `);
      
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select('#tooltip').style('display', 'none');
    });
  
  // Add labels
  group.append('text')
    .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
    .attr('dy', '.35em')
    .attr('transform', d => `
      rotate(${(d.angle * 180 / Math.PI - 90)})
      translate(${radius + 5})
      ${d.angle > Math.PI ? 'rotate(180)' : ''}
    `)
    .style('text-anchor', d => d.angle > Math.PI ? 'end' : null)
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .text(d => data.labels[d.index]);
  
  // Draw ribbons
  svg.append('g')
    .selectAll('path')
    .data(chords)
    .enter()
    .append('path')
    .attr('d', ribbon)
    .style('fill', d => color(data.labels[d.source.index]))
    .style('opacity', 0.6)
    .style('stroke', d => d3.rgb(color(data.labels[d.source.index])).darker())
    .style('stroke-width', 1)
    .on('mouseover', function(event, d) {
      d3.select(this).style('opacity', 0.8);
      
      const tooltip = d3.select('#tooltip')
        .style('display', 'block')
        .html(`
          <div class="tooltip-content">
            <h6>Connection Flow</h6>
            <p><strong>From:</strong> ${data.labels[d.source.index]}</p>
            <p><strong>To:</strong> ${data.labels[d.target.index]}</p>
            <p><strong>Flow:</strong> ${formatNumber(d.source.value)} installations</p>
          </div>
        `);
      
      positionTooltip(event, tooltip);
    })
    .on('mouseout', function() {
      d3.select(this).style('opacity', 0.6);
      d3.select('#tooltip').style('display', 'none');
    });
}

// Update top connections table
function updateTopConnections(data, county) {
  const container = document.getElementById('connections-table');
  if (!container) return;
  
  // Calculate connection strengths
  const connections = [];
  
  // Group by location and type
  const grouped = d3.rollup(data,
    v => ({
      count: v.length,
      totalCapacity: d3.sum(v, d => +(d.Acres || 0)),
      avgDistance: d3.mean(v, d => +(d.Avg_Distance_Substation || d['Distance to Substation (Miles) CAISO'] || 0))
    }),
    d => d['Urban or Rural'],
    d => d['Install Type']
  );
  
  // Convert to connection objects
  for (const [location, typeMap] of grouped) {
    for (const [type, metrics] of typeMap) {
      connections.push({
        source: location,
        target: type,
        strength: metrics.count,
        capacity: metrics.totalCapacity,
        avgDistance: metrics.avgDistance
      });
    }
  }
  
  // Sort by strength
  connections.sort((a, b) => b.strength - a.strength);
  
  // Create table
  const table = d3.select(container)
    .html('')
    .append('table')
    .attr('class', 'table table-striped table-sm');
  
  // Table header
  const header = table.append('thead').append('tr');
  header.selectAll('th')
    .data(['Source', 'Target', 'Connections', 'Capacity', 'Avg Distance'])
    .enter()
    .append('th')
    .text(d => d)
    .style('font-size', '12px');
  
  // Table body
  const tbody = table.append('tbody');
  const rows = tbody.selectAll('tr')
    .data(connections.slice(0, 10))
    .enter()
    .append('tr');
  
  rows.append('td').text(d => d.source).style('font-size', '11px');
  rows.append('td').text(d => d.target).style('font-size', '11px');
  rows.append('td').text(d => formatNumber(d.strength)).style('font-size', '11px');
  rows.append('td').text(d => formatNumber(d.capacity) + ' acres').style('font-size', '11px');
  rows.append('td').text(d => formatNumber(d.avgDistance) + ' mi').style('font-size', '11px');
}

// Urban chord page will be initialized by common.js loadData() function