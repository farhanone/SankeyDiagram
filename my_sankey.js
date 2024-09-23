function _chart(d3, nodeAlign, data, linkColor, nodeColor, level) { // Specify the dimensions of the chart.
  const width = 1000;
  const height = 800;
  const format = d3.format(",.0f");

  d3.select("head")
    .append("style")
    .text(`
      .inactive {
        opacity: 0.3; /* Adjust opacity as needed */
      }
    `);

  // Create a SVG container.
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 13px sans-serif;");

  // Constructs and configures a Sankey generator.
  const sankey = d3.sankey()
    .nodeId(d => d.name)
    .nodeAlign(d3[nodeAlign]) // d3.sankeyLeft, etc.
    .nodeWidth(15)
    .nodePadding(10)
    .extent([[1, 5], [width - 1, height - 5]]);

  // Applies it to the data. We make a copy of the nodes and links objects
  // so as to avoid mutating the original.

  const data_level = sankey({
    nodes: data.level2nodes.get(level).map(d => Object.assign({}, d)),
    links: data.level2links.get(level).map(d => Object.assign({}, d)),
  });

  console.log(data_level.nodes)
  console.log(data_level.links)

  // Defines a color scale.
  const color = d3.scaleOrdinal(d3.schemeCategory10);

  // Creates the rects that represent the nodes.
  const rect = svg.append("g")
    .attr("stroke", "#000")
    .selectAll()
    .data(data_level.nodes)
    .join("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    // .attr("fill", d => color(d.category))
    // .attr("fill", d => d.color)
    .attr("fill", nodeColor === "parent" ? (d) => color(d.category)
      : nodeColor === "spatial" ? (d) => d.color
        : nodeColor === "level" ? (d) => color(d.level)
          : "#aaa")
    .style("cursor", "move")
    .on("mouseover", highlightRelatedNodes) // add mouseover event
    .on("mouseout", resetNodeStyles) // add mouseout event
    .call(d3.drag()
      .subject(d => d)
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));



  // Adds a title on the nodes.
  rect.append("title")
    .text(d => `${d.category}\n${d.name}\n${format(d.value)} TWh`);

  // Helper function to generate unique IDs
  function generateUniqueId(prefix = 'id') {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Creates the paths that represent the links.
  const link = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-opacity", 0.5)
    .selectAll()
    .data(data_level.links)
    .join("g")
    .style("mix-blend-mode", "multiply");

  // Creates a gradient, if necessary, for the source-target color option.
  if (linkColor === "source-target") {
    const gradient = link.append("linearGradient")
      .attr("id", d => (d.uid = generateUniqueId("link")))
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", d => d.source.x1)
      .attr("x2", d => d.target.x0);

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", d => d.source.color);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", d => d.target.color);
  }

  link.append("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", linkColor === "source-target"
      ? (d) => `url(#${d.uid})`
      : linkColor === "source"
        ? (d) => d.source.color
        : linkColor === "target"
          ? (d) => d.target.color
          : linkColor)
    .attr("stroke-width", d => Math.max(1, d.width));
  link.append("title")
    .text(d => `${d.source.name} → ${d.target.name}\n${format(d.value)} TWh`);

  // Adds labels on the nodes.
  // svg.append("g")
  //   .selectAll()
  //   .data(data_level.nodes)
  //   .join("text")
  //     .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
  //     .attr("y", d => (d.y1 + d.y0) / 2)
  //     .attr("dy", "0.35em")
  //     .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
  //     .text(d => d.name);


  function dragstarted(event, d) {
    d3.select(this).raise().classed("active", true);
  }

  function dragged(event, d) {
    // constraint the drag
    const newY = Math.max(0, Math.min(height - (d.y1 - d.y0), event.y));
    d.y1 = d.y1 + newY - d.y0;
    d.y0 = newY;

    d3.select(this)
      .attr("y", d.y0 = d.y0);

    // Update links
    sankey.update(data_level);

    rect
      .attr("y", d => d.y0);
    link.selectAll("path")
      .attr("d", d3.sankeyLinkHorizontal());
  }

  function dragended(event, d) {
    d3.select(this).classed("active", false);
  }

  function highlightRelatedNodes(event, d) {
    const relatedLinks = new Set();
    const relatedNodes = new Set();
    const visited = new Set(); // To prevent revisiting nodes

    // Function to find all parents and children of a node
    function findAllRelatedChild(node) {
      data_level.links.forEach(link => {
        if (link.source === node) {
          relatedNodes.add(link.target);
          relatedLinks.add(link);
          if (!visited.has(link.target)) {
            visited.add(link.target);
            findAllRelatedChild(link.target); // Recursively find children
          }
        }
      });
    }

    function findAllRelatedParent(node) {
      data_level.links.forEach(link => {
        if (link.target === node) {
          relatedNodes.add(link.source);
          relatedLinks.add(link);
          if (!visited.has(link.source)) {
            visited.add(link.source);
            findAllRelatedParent(link.source); // Recursively find parents
          }
        }
      });
    }

    findAllRelatedChild(d); // Start finding parents and children
    findAllRelatedParent(d);

    // Highlight related nodes and links
    rect.classed("inactive", true);
    link.classed("inactive", true);

    rect.filter(node => relatedNodes.has(node))
      .classed("inactive", false)
      .raise();

    link.filter(link => relatedLinks.has(link))
      .classed("inactive", false)
      .raise();
  }



  function resetNodeStyles() {
    rect.classed("inactive", false);
    link.classed("inactive", false);
  }

  return svg.node();
}

let isFirstRun = true; // Flag to track if it's the first run
let isUpdated = true
function customRun() {
  isFirstRun = false;
  updateChart();
}
function updateChart() {
  const fileInput = document.getElementById('fname');
  const file = fileInput.files[0];

  // Check if it's the first run
  if (isFirstRun) {
    // isFirstRun = false; // Set flag to false after the first run

    // Fetch the default CSV file from the server
    fetch("sankey_small_color.csv")
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(csvContent => {
        parseCSV(csvContent);
        document.getElementById('default-title').textContent = 'Loaded Default Chart';
        isUpdated = false;
      })
      .catch(error => {
        console.error('Error fetching the default CSV file:', error);
        alert("Could not load the default file.");
      });
  } else if (!file) {
    alert("Please select a CSV file.");
    return;
  } else {
    const reader = new FileReader();
    reader.onload = function (e) {

      parseCSV(e.target.result);
      document.getElementById('default-title').textContent = 'Loaded Custom Chart';
      isUpdated = false;
      // isFirstRun = false; // Set flag to false after the first run


    };
    reader.readAsText(file);
  }
}

function parseCSV(csvContent) {

  const links = d3.csvParse(csvContent);

  const nodeColor = new Map();
  links.forEach(l => {

    nodeColor.set(l.source, l.colorS);
    nodeColor.set(l.target, l.colorT);
  });

  const nodeParent = new Map();
  const nodeLevels = new Map();

  links.forEach(l => {
    if (l.level == -1) {
      nodeParent.set(l.target, l.source);

    }
    else {
      nodeLevels.set(l.source, l.level);
      nodeLevels.set(l.target, l.level);
    }

  });

  const levels = Array.from(new Set(links.flatMap(l => l.level)));

  const level2links = new Map();
  const level2nodes = new Map();
  levels.forEach(l => {
    level2links.set(l, links.filter(x => x.level == l));
    // level2nodes.set (l, Array.from(new Set(level2links.get(l).flatMap(ll => [ll.source, ll.target])), name => ({name, category: nodeParent.get(name)})));
    level2nodes.set(l, Array.from(new Set(level2links.get(l).flatMap(ll => [ll.source, ll.target])), name => ({ name, level: nodeLevels.get(name), category: nodeParent.get(name), color: nodeColor.get(name) })));
    // level2nodes.set (l, Array.from(new Set(level2links.get(l).flatMap(ll => [ll.source, ll.target])), name => ({name, category: name})));
  });

  level2links.set(-1, links.filter(x => x.level != -1));
  // level2nodes.set(-1, Array.from(new Set(links.filter(x=>x.level!=-1).flatMap(ll => [ll.source, ll.target])), name => ({name, category: nodeParent.get(name)})));
  level2nodes.set(-1, Array.from(new Set(links.filter(x => x.level != -1).flatMap(ll => [ll.source, ll.target])), name => ({ name, level: nodeLevels.get(name), category: nodeParent.get(name), color: nodeColor.get(name) })));
  // 

  const data = { level2links, level2nodes };

  d3.select("#sankey-chart").select("svg").remove();


  const levelSelect = document.getElementById('level');

  if (isUpdated) {
    levelSelect.innerHTML = '';
    levels.forEach(option => {

      const newOption = document.createElement('option');
      newOption.value = option;
      newOption.textContent = option;
      levelSelect.appendChild(newOption);
    });
    levelSelect.value = levels.sort().at(-1)
  }

  const levelSelect_updated = document.getElementById('level').value;
  const linkColorSelect = document.getElementById('link-color').value;
  const nodeColorSelect = document.getElementById('node-color').value;
  const result = _chart(d3, "sankeyJustify", data, linkColorSelect, nodeColorSelect, levelSelect_updated)
  document.getElementById("sankey-chart").appendChild(result);

}

// Automatically call updateChart on page load
window.onload = function () {

  updateChart();
};