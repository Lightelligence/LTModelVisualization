var config = [];

const makeRequest = async () => {
  target = document.getElementById("content");
  try {
    opts = {
      lines: 9, // The number of lines to draw
      length: 9, // The length of each line
      width: 5, // The line thickness
      radius: 14, // The radius of the inner circle
      color: "#EE3124", // #rgb or #rrggbb or array of colors
      speed: 1.9, // Rounds per second
      trail: 40, // Afterglow percentage
      className: "spinner" // The CSS class to assign to the spinner
    };
    spinner = new Spinner(opts);
    spinner.spin(target);
    const data = await d3.json("/graph.json");
    spinner.stop();
    return data;
  } catch (err) {
    console.log(err);
    throw Error("Failed to load data");
  }
};

async function drawGraph(graph) {
  var optArray = [];
  labelAnchors = [];
  labelAnchorLinks = [];

  highlightNode_button = d3.select("#highlightNode");
  highlightNode_button.on("click", highlightNode);

  shrinkNode_button = d3.select("#shrinkNode");
  shrinkNode_button.on("click", minimizeNode);

  for (var i = 0; i < graph.nodes.length - 1; i++) {
    optArray.push(graph.nodes[i].name);
    graph.nodes[i]["scanned"] = false;
    // Adding a new property scanned to help with quadtree node detection
  }

  optArray = optArray.sort();

  $(function() {
    $("#targetNode").autocomplete({
      source: optArray
    });
  });

  var svg1 = d3.select("svg");
  var width = +window.innerWidth - 150;
  var height = +window.innerHeight - 100;
  prev_node_ids = new Set();
  prev_link_ids = new Set();
  initial_zoom_scale = 0.05;
  var transform = d3.zoomIdentity
    .translate(width / 2, height / 2)
    .scale(initial_zoom_scale);
  var zoom = d3.zoom().on("zoom", handleZoom);

  svg1

    .attr("width", width)
    .attr("height", height)
    .attr("id", "root_svg")
    .style("border", "3px solid black")
    .style("cssFloat", "left")
    .call(zoom) // Adds zoom functionality
    .call(zoom.transform, transform)
    .attr("class", "white_theme");

  var svg = svg1
    .call(zoom)
    .on("dblclick.zoom", null)
    .append("svg")
    .style("border", "3px solid black")
    .append("g")
    .attr("id", "zoom_svg")
    .attr("class", "zoomable")
    .attr("transform", transform);

  function zoomed() {
    svg.attr("transform", d3.event.transform);
  }

  function handleZoom() {
    if (svg) {
      svg.attr("transform", d3.event.transform);

      // Calculate the node,link sets only if zoomed out.
      if (initial_zoom_scale > d3.event.transform.k) {
        // elements to fetch = elements_in_visible_view - previous_elements_set
        node_ids = new Set(
          [...fetch_elements_in_visible_view("node")].filter(
            x => !prev_node_ids.has(x)
          )
        );
        link_ids = new Set(
          [...fetch_elements_in_visible_view("link")].filter(
            x => !prev_link_ids.has(x)
          )
        );
      } else if (initial_zoom_scale < d3.event.transform.k) {
        // if zoomed in then show all link and nodes but only if < 500 nodes
        // if > 500 nodes in current view then show partial info

        node_ids = fetch_elements_in_visible_view("node");
        link_ids = fetch_elements_in_visible_view("link");
      } else {
        node_ids = fetch_elements_in_visible_view("node");
        link_ids = fetch_elements_in_visible_view("link");
      }
      if (prev_node_ids.size + node_ids.size < 500) {
        node_ids.forEach(show_all_node_related_elements);
        link_ids.forEach(show_all_link_related_elements);
      } else {
        node_ids.forEach(function(node_name) {
          document.getElementById(node_name).style.display = "none";
          document.getElementById(
            "textElement_nodes" + node_name
          ).style.display = "none";
        });
        link_ids.forEach(function(link_name) {
          document.getElementById(link_name).style.display = "block";
          document.getElementById("edgepath" + link_name).style.display =
            "none";
          document.getElementById("edgelabel" + link_name).style.display =
            "none";
        });
      }
      prev_node_ids = node_ids;
      prev_link_ids = link_ids;
      initial_zoom_scale = d3.event.transform.k;
    }
  }

  function create_point(base_element, x, y) {
    point = base_element.createSVGPoint();
    point.x = x;
    point.y = y;
    return point;
  }

  var groups = d3
    .nest()
    .key(function(d) {
      return d.group;
    })
    .entries(graph.nodes);

  var polygons = svg
    .selectAll("path_1")
    .data(groups)
    .attr("d", groupPath)
    .enter()
    .append("path")
    .attr("class", "hull")
    .attr("d", groupPath);

  var gradient = svg
    .append("svg:defs")
    .append("svg:linearGradient")
    .attr("id", "gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "100%")
    .attr("y2", "100%")

    .attr("spreadMethod", "pad");

  // Define the gradient colors
  gradient
    .append("svg:stop")
    .attr("offset", "0%")
    .attr("stop-color", "#b721ff")
    .attr("stop-opacity", 1);

  gradient
    .append("svg:stop")
    .attr("offset", "100%")
    .attr("stop-color", "#21d4fd")
    .attr("stop-opacity", 1);

  var linkText = svg
    .selectAll(".gLink")
    .data(graph.links)
    .append("text")
    .attr("font-family", "Arial, Helvetica, sans-serif")
    .attr("x", function(d) {
      if (d.target.x > d.source.x) {
        return d.source.x + (d.target.x - d.source.x) / 2;
      } else {
        return d.target.x + (d.source.x - d.target.x) / 2;
      }
    })
    .attr("y", function(d) {
      if (d.target.y > d.source.y) {
        return d.source.y + (d.target.y - d.source.y) / 2;
      } else {
        return d.target.y + (d.source.y - d.target.y) / 2;
      }
    })
    .attr("fill", "Black")
    .style("font", "normal 12px Arial")
    .attr("dy", ".35em")
    .text(function(d) {
      return d.linkname;
    });

  var dragDrop = d3
    .drag()
    .on("start", node => {
      if (!d3.event.active) {
        simulation.alphaTarget(1).restart();
      }
      node.fx = node.x;
      node.fy = node.y;
    })
    .on("drag", node => {
      node.fx = d3.event.x;
      node.fy = d3.event.y;
    })
    .on("end", node => {
      if (!d3.event.active) {
        simulation.alphaTarget(0);
      }
      node.fx = node.x;
      node.fy = node.y;
      fix_nodes(node);
    });

  // Saving a reference to link attributes so that it helps to change
  // these attriibutes by slider-user-input by changing
  // sepcific elements of reference.
  var linkForce = d3
    .forceLink(graph.links)
    .id(function(d) {
      return d.name;
    })
    .distance(50);

  // Saving a reference to node attribute
  var nodeForce = d3.forceManyBody().strength(-30);

  var groupPath = function(d) {
    var arr = [];
    offset = 10;
    if (d.key != 0) {
      for (i = 0; i < d.values.length; i++) {
        arr.push([d.values[i].x - 20 - offset, d.values[i].y - 10 - offset]);
        arr.push([
          d.values[i].x - 20 + config.Width + offset,
          d.values[i].y - 10 - offset
        ]);
        arr.push([
          d.values[i].x - 20 - offset,
          d.values[i].y - 10 + config.Height + offset
        ]);
        arr.push([
          d.values[i].x - 20 + config.Width + offset,
          d.values[i].y - 10 + config.Height + offset
        ]);
      }
      return "M" + d3.polygonHull(arr).join("L") + "Z";
    }
  };

  brush = svg
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", 0)
    .style("opacity", 0.1);

  // Grouping
  var simulation = d3
    .forceSimulation(graph.nodes)
    .force("links", linkForce)
    .force("charge", nodeForce)
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", ticked)
    .on("end", lazyload);

  // start spinner to let user know nodes are being laid out
  // the spinner is ended in lazyload function.
  spinner.spin(target);

  var div = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  var markers = svg
    .append("defs")
    .append("marker")
    .attrs({
      id: "arrowhead",
      viewBox: "-0 -5 10 10",
      refX: 33,
      refY: 0,
      orient: "auto-start-reverse",
      markerWidth: 3,
      markerHeight: 3
    })
    .append("svg:path")
    .attr("d", "M 0,0 L 10 ,-5 L 10,5")
    .attr("fill", "black")
    .attr("fill-opacity", "1")
    .call(
      d3.zoom().on("zoom", function() {
        svg.attr("transform", d3.event.transform);
      })
    );

  prev_edge = null;
  prev_edge_color = null;
  var link = svg
    .append("g")
    .selectAll("line_class.line")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("id", function(d) {
      return d.linkname + d.target.name;
    })
    .attr("stroke-width", "8")
    .style("stroke", "pink")
    .text("text", function(d) {
      return d.name;
    })
    .on("mouseover", function(d) {
      div
        .transition()
        .duration(200)
        .style("opacity", 0.9);
      div
        .html(d.hover_info)
        .style("left", d3.event.pageX + "px")
        .style("top", d3.event.pageY - 28 + "px")
        .style("width", "auto")
        .style("height", "auto");
    })
    .on("click", function(d) {
      d3.select("#chart").remove();
      if ((prev_edge != null) & (prev_edge != d3.select(this))) {
        prev_edge.style("stroke", prev_edge_color);
      }

      selected_edge = d3.select(this);
      if (d.edge_hist_data.length >= 1) {
        prev_edge = d3.select(this);
        prev_edge_color = d3.select(this).style("stroke");
        selected_edge.style("stroke", "cyan");
        counts = [];
        bins = [];
        num_zeroes = [];
        parent_folders = [];
        max_size = 0;
        for (i = 0; i < d.edge_hist_data.length; i++) {
          max_size = Math.max(max_size, d.edge_hist_data[i][1]);
        }
        for (i = 0; i < d.edge_hist_data.length; i++) {
          counts[i] = d.edge_hist_data[i][0];
          num_zeroes[i] = d.edge_hist_data[i][2];

          // -1 maps to curr graph , 0 to the next provided path and so on ...
          parent_folders[i] = d.edge_hist_data[i][3];
          bins[i] = make_bins(counts[i], max_size);
          slice_left = 0;
          slice_right = 0;
          if (counts[i][0] == 0) {
            for (j = 0; j < counts[i].length; j++) {
              if (counts[i][j] == 0) {
                slice_left += 1;
              } else {
                break;
              }
            }
          }
          if (counts[i][counts[i].length - 1] == 0) {
            for (j = counts[i].length - 1; j >= 0; j--) {
              if (counts[i][j] == 0) {
                slice_right += 1;
              } else {
                break;
              }
            }
          } else {
          }
          if (slice_left > 0) {
            for (j = 0; j < slice_left; j++) {
              counts[i].shift();
              bins[i].shift();
            }
          }
          if (slice_right > 0) {
            for (j = 0; j < slice_right; j++) {
              counts[i].pop();
              bins[i].pop();
            }
          }
        }

        createChart(counts, bins, d.linkname, num_zeroes, parent_folders);
      }
    })
    .on("mouseout", function(d) {
      div
        .transition()
        .duration(500)
        .style("opacity", 0);
    })
    .attr("marker-start", "url(#arrowhead)")
    .style("display", "none");

  var edgepaths = svg
    .selectAll(".edgepath")
    .data(graph.links)
    .enter()
    .append("path")
    .attr("d", function(d) {
      return (
        "M " +
        d.source.x +
        " " +
        d.source.y +
        " L " +
        d.target.x +
        " " +
        d.target.y
      );
    })
    .attr("class", "edgepath")
    .attr("fill-opacity", 0)
    .attr("stroke-opacity", 0)
    .attr("fill", "blue")
    .attr("stroke", "red")
    .attr("id", function(d) {
      return "edgepath" + d.linkname + d.target.name;
    })
    .style("pointer-events", "none")
    .style("display", "none");

  var edgelabels = svg
    .selectAll(".edgelabel")
    .data(graph.links)
    .enter()
    .append("text")
    .style("pointer-events", "none")
    .attr("class", "edgelabel")
    .attr("id", function(d) {
      // associating each label to link name so that they stay binded by data (id)
      return "edgelabel" + d.linkname + d.target.name;
    })
    .attr("dx", 80)
    .attr("dy", 0)
    .attr("font-size", 10)
    .attr("fill", "black")
    .style("display", "none");

  edgelabels
    .append("textPath")
    .attr("xlink:href", function(d, i) {
      return "#edgepath" + i;
    })
    .style("pointer-events", "none")
    .text(function(d) {
      return d.linkname;
    });

  var radius = 4;
  var node_data_array = [];
  var node_name = "";

  var node = svg
    .append("g")
    .selectAll("circle_class.circle")
    .data(graph.nodes)
    .enter()
    .append("rect")
    .attr("fill", "url(#gradient)")
    .style("transform", "translate(-20px,-10px)")
    .attr("stroke", "purple")
    .attr("id", function(d) {
      node_name = d.name;
      return d.name;
    })
    .attr("width", function(d) {
      if (d.node_info == "Dummy") {
        return 65;
      }
      return d.node_info.length * 8;
    })
    .attr("height", 20)
    .on("dblclick", connectedNodes)
    .on("mouseover", function(d) {
      if (d.node_info.length > 0) {
        var hover_text = "";
        if (d.hover_text.length > 0) {
          hover_text = "<br> Info: <br>" + d.hover_text;
        }
        div
          .transition()
          .duration(200)
          .style("opacity", 0.9);
        div
          .html("Name: " + d.name + hover_text + "<br> Error: " + d.error)
          .style("left", d3.event.pageX + "px")
          .style("top", d3.event.pageY - 28 + "px")
          .style("width", "auto")
          .style("height", "auto")
          .style("color", "black");
      }
    })
    .on("mouseout", function(d) {
      if (d.node_info.length > 0) {
        div
          .transition()
          .duration(500)
          .style("opacity", 0);
      }
    })
    .style("display", "none");

  var textElements_nodes = svg
    .append("g")
    .selectAll("text")
    .data(graph.nodes)
    .enter()
    .append("text")
    .text(function(d) {
      return d.node_info;
    })
    .attr("id", function(d) {
      return "textElement_nodes" + d.name;
    })
    .attr("font-size", 15)
    .attr("dx", -19)
    .style("pointer-events", "none")
    .style("display", "none");

  node.call(dragDrop);
  //bind drag and drop function to the elements required:
  //here we add it to node ,so nodes are now interactive.

  link.call(updateState1);

  // turn to "visible" to see edge_labels
  edgelabels.style("visibility", "hidden");

  graph.nodes.forEach(function(entry) {
    ele = document.getElementById(entry.name);
  });

  function fetch_elements_in_visible_view(element_type_str) {
    root_svg = document.getElementById("root_svg");
    zoom_svg = document.getElementById("zoom_svg");
    viewing_frame_coods = [];
    // should hold the coods start x, start y, width (extending right) and height (extending bottom)
    // of the viewing rectangle before transformation.
    viewing_frame_coods = [
      create_point(root_svg, 0, 0),
      create_point(root_svg, width, 0),
      create_point(root_svg, width, height),
      create_point(root_svg, 0, height)
    ];
    matrix = zoom_svg.getCTM();
    transformed_viewing_frame_coods = [];
    // holds the coordinates for top left, top right, bottom left and bottom right
    viewing_frame_coods.forEach(function(point_item) {
      transformed_viewing_frame_coods.push(
        point_item.matrixTransform(matrix.inverse())
      );
    });

    transformed_mid_x =
      (transformed_viewing_frame_coods[0].x +
        transformed_viewing_frame_coods[2].x) /
      2;
    transformed_mid_y =
      (transformed_viewing_frame_coods[0].y +
        transformed_viewing_frame_coods[2].y) /
      2;
    radius =
      Math.hypot(
        transformed_viewing_frame_coods[2].x - transformed_mid_x,
        transformed_viewing_frame_coods[2].y - transformed_mid_y
      ) * 1.5;

    foundAll = findInCircle(
      element_type_str,
      transformed_mid_x,
      transformed_mid_y,
      radius
    );
    return foundAll;
  }

  function get_quadtree_from_identifier_str(identifier_str) {
    return quadtree_str_to_type_map[identifier_str];
  }

  function findInCircle(quadtree_type_str, x, y, radius) {
    quadtree = get_quadtree_from_identifier_str(quadtree_type_str);
    // convert result from array to set.
    const result = new Set();
    function accept(d) {
      if (quadtree_type_str == "node") {
        result.add(d.name);
      } else result.add(d.linkname + d.target.name);
    }

    // Visit the quadtree from the top, recursively
    quadtree.visit(function(node, x1, y1, x2, y2) {
      if (node.length) {
        // this is not a leaf: mark that we visited it
        node.visited = true;
        // if <x,y> is outside the quad + a margin of radius, we know that there is no point
        // in that quad’s hierarchy that is at a distance < radius: eliminate the quad by returning truthy
        return (
          x1 >= x + radius ||
          y1 >= y + radius ||
          x2 < x - radius ||
          y2 < y - radius
        );
      }

      // this is a leaf node: it contains 1 point in node.data
      do {
        // mark that we visited it
        const d = node.data;
        d.visited = true;
        if (quadtree_type_str == "node") {
          if (Math.hypot(d.x - x, d.y - y) < radius) accept(d);
        } else {
          if (Math.hypot(d.source.x - x, d.source.y - y) < radius) accept(d);
        }
        // measure its euclidian distance to <x,y> and accept it if < radius
      } while ((node = node.next));
      // the do...while chained call is used to test coincident points—which would belong
      // to the same leaf node; in our case with random points, however, this test is useless
      // as the probability of coincident points is 0.
    });
    return result;
  }

  function fix_nodes(this_node) {
    node.each(function(d) {
      if (this_node != d) {
        d.fx = d.x;
        d.fy = d.y;
      }
    });
  }

  function updateState1() {
    link // get all the links
      .each(function(d) {
        var colors = ["red", "green", "blue"];
        var num = 0;
        if (d.source.name.startsWith("Dummy")) {
          num = 1;
        } else if (d.target.name.startsWith("Dummy")) {
          num = 2;
        } else {
          num = 0;
          for (i = 0; i < graph.input_nodes.length; i++) {
            if (graph.input_nodes[i].name == d.source.name) {
              num = 1;
            }
          }
        }

        d3.select(this).style("stroke", function(d) {
          return colors[num];
        });
        if (d.port == -1) {
          d3.select(this).attr("stroke-dasharray", function(d) {
            return "5, 5";
          });
        }
      });
  }

  function show_all_node_related_elements(node_name) {
    // show node and node labels
    document.getElementById(node_name).style.display = "block";
    document.getElementById("textElement_nodes" + node_name).style.display =
      "block";
  }

  function show_all_link_related_elements(link_name) {
    //show links, edgePaths and edgeLabels
    document.getElementById(link_name).style.display = "block";
    document.getElementById("edgepath" + link_name).style.display = "block";
    document.getElementById("edgelabel" + link_name).style.display = "block";
  }
  //Creating a chart
  function updateChart(data_chart, bins, name, hidden_status = "visible") {
    data_chart = [0];
    bins = [0, 0];

    var width_chart = bins.length >= 21 ? window.width : 500;
    var width_chart = 1000;
    var height_chart = 180;
    var margin_chart = {
      left: screen.width - width_chart - 100,
      right: 15,
      top: 40,
      bottom: 40
    };

    var svg_chart = d3
      .select("body")
      .append("svg")
      .attr("id", "chart")
      .attr("width", width_chart)
      .attr("height", height_chart + margin_chart.top + margin_chart.bottom)
      .attr("position", "absolute")
      .attr("bottom", 0)
      .attr("right", 0);

    var g = svg_chart
      .append("g")
      .attr(
        "transform",
        "translate(" + [margin_chart.left, margin_chart.top] + ")"
      );

    // Used for counts
    var y_chart = d3
      .scaleLinear()
      .range([height_chart, 0])
      .domain([0, d3.max(data_chart)]);

    var yAxis_chart = d3.axisLeft().scale(y_chart);

    g.append("g").call(yAxis_chart);

    // Used for bins created from values
    var x_chart = d3
      .scaleLinear()
      .range([0, width_chart])
      .domain([Math.min(...bins), Math.max(...bins)]);

    var xAxis_chart = d3.axisBottom(x_chart).tickValues(bins);

    g.append("g")
      .attr("transform", "translate(0," + height_chart + ")")
      .call(xAxis_chart)
      .selectAll("text");

    var rects_chart = g
      .selectAll("rect")
      .data(data_chart)
      .enter()
      .append("rect")
      .attr("x", function(d, i) {
        return x_chart(bins[i]);
      })
      .attr("y", function(d, i) {
        return y_chart(d);
      })
      .attr("height", function(d) {
        return height_chart - y_chart(d);
      })
      .attr("width", function(d, i) {
        return x_chart(bins[i + 1]) - x_chart(bins[i]);
      })
      .attr("fill", "steelblue")
      .on("mouseover", function(d, i) {
        div
          .transition()
          .duration(200)
          .style("opacity", 0.9);
        div
          .html("Range: " + bins[i] + " to " + bins[i + 1] + "<br> count: " + d)
          .style("left", d3.event.pageX + "px")
          .style("top", d3.event.pageY - 28 + "px")
          .style("width", "auto")
          .style("height", "auto");
      })
      .on("mouseout", function(d) {
        div
          .transition()
          .duration(500)
          .style("opacity", 0);
      })
      .transition()
      .duration(1000);

    svg_chart.style("visibility", hidden_status);
  }

  function make_bins(counts, max_value) {
    // Calculates bin values with the count array

    min_value = -max_value;

    bin_length = (max_value - min_value) / counts.length;

    bin_list = [];
    for (var index = 0; index < counts.length; index++) {
      bin_list.push(-max_value + bin_length * index);
    }
    bin_list.push(max_value);

    return bin_list;
  }

  var label_toggle = 0;
  function show_hide_node_labels() {
    if (label_toggle) {
      textElements_nodes.style("visibility", "visible");
    } else {
      textElements_nodes.style("visibility", "hidden");
    }
    label_toggle = !label_toggle;
  }

  var toggle = 0;

  var linkedByIndex = {};
  for (i = 0; i < graph.nodes.length; i++) {
    linkedByIndex[i + "," + i] = 1;
  }
  graph.links.forEach(function(d) {
    linkedByIndex[d.source.index + "," + d.target.index] = 1;
  });

  //DAT GUI for controls
  var gui = new dat.GUI({ width: 400 });

  config = {
    linkStrength: 1,
    linkDistance: 180,
    nodeStrength: -30,
    restart: reset,
    showHideNodeLabels: show_hide_node_labels
  };

  var linkDistanceChanger = gui
    .add(config, "linkDistance", 0, 400)
    .step(1)
    .name("Link Distance");

  linkDistanceChanger.onChange(function(value) {
    linkForce.distance(value);
    simulation.alpha(1).restart();
  });

  var linkStrengthChanger = gui
    .add(config, "linkStrength", 0, 1)
    .name("Link Strength");

  linkStrengthChanger.onChange(function(value) {
    linkForce.strength(value);
    simulation.alpha(1).restart();
  });

  var nodeStrengthChanger = gui
    .add(config, "nodeStrength", -4500, -1)
    .step(1)
    .name("Node Strength");

  nodeStrengthChanger.onChange(function(value) {
    nodeForce.strength(value);
    simulation.alpha(1).restart();
  });

  gui.add(config, "showHideNodeLabels").name("Show/Hide Node Labels");

  //set of contrasting colors with and their color intensity
  var colors_256 = [
    ["#000000", "dark"],
    ["#FFFF00", "light"],
    ["#1CE6FF", "light"],
    ["#FF34FF", "light"],
    ["#FF4A46", "light"],
    ["#008941", "dark"],
    ["#006FA6", "dark"],
    ["#A30059", "dark"],
    ["#FFDBE5", "light"],
    ["#7A4900", "dark"],
    ["#0000A6", "dark"],
    ["#63FFAC", "light"],
    ["#B79762", "light"],
    ["#004D43", "dark"],
    ["#8FB0FF", "light"],
    ["#997D87", "light"],
    ["#5A0007", "dark"],
    ["#809693", "light"],
    ["#FEFFE6", "light"],
    ["#1B4400", "dark"],
    ["#4FC601", "light"],
    ["#3B5DFF", "dark"],
    ["#4A3B53", "dark"],
    ["#FF2F80", "light"],
    ["#61615A", "dark"],
    ["#BA0900", "dark"],
    ["#6B7900", "dark"],
    ["#00C2A0", "light"],
    ["#FFAA92", "light"],
    ["#FF90C9", "light"],
    ["#B903AA", "dark"],
    ["#D16100", "light"],
    ["#DDEFFF", "light"],
    ["#000035", "dark"],
    ["#7B4F4B", "dark"],
    ["#A1C299", "light"],
    ["#300018", "dark"],
    ["#0AA6D8", "light"],
    ["#013349", "dark"],
    ["#00846F", "dark"],
    ["#372101", "dark"],
    ["#FFB500", "light"],
    ["#C2FFED", "light"],
    ["#A079BF", "light"],
    ["#CC0744", "dark"],
    ["#C0B9B2", "light"],
    ["#C2FF99", "light"],
    ["#001E09", "dark"],
    ["#00489C", "dark"],
    ["#6F0062", "dark"],
    ["#0CBD66", "light"],
    ["#EEC3FF", "light"],
    ["#456D75", "dark"],
    ["#B77B68", "light"],
    ["#7A87A1", "light"],
    ["#788D66", "light"],
    ["#885578", "dark"],
    ["#FAD09F", "light"],
    ["#FF8A9A", "light"],
    ["#D157A0", "light"],
    ["#BEC459", "light"],
    ["#456648", "dark"],
    ["#0086ED", "light"],
    ["#886F4C", "dark"],
    ["#34362D", "dark"],
    ["#B4A8BD", "light"],
    ["#00A6AA", "light"],
    ["#452C2C", "dark"],
    ["#636375", "dark"],
    ["#A3C8C9", "light"],
    ["#FF913F", "light"],
    ["#938A81", "light"],
    ["#575329", "dark"],
    ["#00FECF", "light"],
    ["#B05B6F", "dark"],
    ["#8CD0FF", "light"],
    ["#3B9700", "dark"],
    ["#04F757", "light"],
    ["#C8A1A1", "light"],
    ["#1E6E00", "dark"],
    ["#7900D7", "dark"],
    ["#A77500", "light"],
    ["#6367A9", "dark"],
    ["#A05837", "dark"],
    ["#6B002C", "dark"],
    ["#772600", "dark"],
    ["#D790FF", "light"],
    ["#9B9700", "light"],
    ["#549E79", "light"],
    ["#FFF69F", "light"],
    ["#201625", "dark"],
    ["#72418F", "dark"],
    ["#BC23FF", "light"],
    ["#99ADC0", "light"],
    ["#3A2465", "dark"],
    ["#922329", "dark"],
    ["#5B4534", "dark"],
    ["#FDE8DC", "light"],
    ["#404E55", "dark"],
    ["#0089A3", "dark"],
    ["#CB7E98", "light"],
    ["#A4E804", "light"],
    ["#324E72", "dark"],
    ["#6A3A4C", "dark"],
    ["#83AB58", "light"],
    ["#001C1E", "dark"],
    ["#D1F7CE", "light"],
    ["#004B28", "dark"],
    ["#C8D0F6", "light"],
    ["#A3A489", "light"],
    ["#806C66", "dark"],
    ["#222800", "dark"],
    ["#BF5650", "dark"],
    ["#E83000", "light"],
    ["#66796D", "dark"],
    ["#DA007C", "dark"],
    ["#FF1A59", "light"],
    ["#8ADBB4", "light"],
    ["#1E0200", "dark"],
    ["#5B4E51", "dark"],
    ["#C895C5", "light"],
    ["#320033", "dark"],
    ["#FF6832", "light"],
    ["#66E1D3", "light"],
    ["#CFCDAC", "light"],
    ["#D0AC94", "light"],
    ["#7ED379", "light"],
    ["#012C58", "dark"],
    ["#7A7BFF", "light"],
    ["#D68E01", "light"],
    ["#353339", "dark"],
    ["#78AFA1", "light"],
    ["#FEB2C6", "light"],
    ["#75797C", "dark"],
    ["#837393", "dark"],
    ["#943A4D", "dark"],
    ["#B5F4FF", "light"],
    ["#D2DCD5", "light"],
    ["#9556BD", "dark"],
    ["#6A714A", "dark"],
    ["#001325", "dark"],
    ["#02525F", "dark"],
    ["#0AA3F7", "light"],
    ["#E98176", "light"],
    ["#DBD5DD", "light"],
    ["#5EBCD1", "light"],
    ["#3D4F44", "dark"],
    ["#7E6405", "dark"],
    ["#02684E", "dark"],
    ["#962B75", "dark"],
    ["#8D8546", "light"],
    ["#9695C5", "light"],
    ["#E773CE", "light"],
    ["#D86A78", "light"],
    ["#3E89BE", "light"],
    ["#CA834E", "light"],
    ["#518A87", "dark"],
    ["#5B113C", "dark"],
    ["#55813B", "dark"],
    ["#E704C4", "light"],
    ["#00005F", "dark"],
    ["#A97399", "light"],
    ["#4B8160", "dark"],
    ["#59738A", "dark"],
    ["#FF5DA7", "light"],
    ["#F7C9BF", "light"],
    ["#643127", "dark"],
    ["#513A01", "dark"],
    ["#6B94AA", "light"],
    ["#51A058", "light"],
    ["#A45B02", "dark"],
    ["#1D1702", "dark"],
    ["#E20027", "dark"],
    ["#E7AB63", "light"],
    ["#4C6001", "dark"],
    ["#9C6966", "dark"],
    ["#64547B", "dark"],
    ["#97979E", "light"],
    ["#006A66", "dark"],
    ["#391406", "dark"],
    ["#F4D749", "light"],
    ["#0045D2", "dark"],
    ["#006C31", "dark"],
    ["#DDB6D0", "light"],
    ["#7C6571", "dark"],
    ["#9FB2A4", "light"],
    ["#00D891", "light"],
    ["#15A08A", "light"],
    ["#BC65E9", "light"],
    ["#FFFFFE", "light"],
    ["#C6DC99", "light"],
    ["#203B3C", "dark"],
    ["#671190", "dark"],
    ["#6B3A64", "dark"],
    ["#F5E1FF", "light"],
    ["#FFA0F2", "light"],
    ["#CCAA35", "light"],
    ["#374527", "dark"],
    ["#8BB400", "light"],
    ["#797868", "dark"],
    ["#C6005A", "dark"],
    ["#3B000A", "dark"],
    ["#C86240", "light"],
    ["#29607C", "dark"],
    ["#402334", "dark"],
    ["#7D5A44", "dark"],
    ["#CCB87C", "light"],
    ["#B88183", "light"],
    ["#AA5199", "dark"],
    ["#B5D6C3", "light"],
    ["#A38469", "light"],
    ["#9F94F0", "light"],
    ["#A74571", "dark"],
    ["#B894A6", "light"],
    ["#71BB8C", "light"],
    ["#00B433", "light"],
    ["#789EC9", "light"],
    ["#6D80BA", "light"],
    ["#953F00", "dark"],
    ["#5EFF03", "light"],
    ["#E4FFFC", "light"],
    ["#1BE177", "light"],
    ["#BCB1E5", "light"],
    ["#76912F", "light"],
    ["#003109", "dark"],
    ["#0060CD", "dark"],
    ["#D20096", "dark"],
    ["#895563", "dark"],
    ["#29201D", "dark"],
    ["#5B3213", "dark"],
    ["#A76F42", "dark"],
    ["#89412E", "dark"],
    ["#1A3A2A", "dark"],
    ["#494B5A", "dark"],
    ["#A88C85", "light"],
    ["#F4ABAA", "light"],
    ["#A3F3AB", "light"],
    ["#00C6C8", "light"],
    ["#EA8B66", "light"],
    ["#958A9F", "light"],
    ["#BDC9D2", "light"],
    ["#9FA064", "light"],
    ["#BE4700", "dark"],
    ["#658188", "dark"],
    ["#83A485", "light"],
    ["#453C23", "dark"],
    ["#47675D", "dark"],
    ["#3A3F00", "dark"],
    ["#061203", "dark"],
    ["#DFFB71", "light"],
    ["#868E7E", "light"],
    ["#98D058", "light"],
    ["#6C8F7D", "light"],
    ["#D7BFC2", "light"],
    ["#3C3E6E", "dark"],
    ["#D83D66", "light"],
    ["#2F5D9B", "dark"],
    ["#6C5E46", "dark"],
    ["#D25B88", "light"],
    ["#5B656C", "dark"],
    ["#00B57F", "light"],
    ["#545C46", "dark"],
    ["#866097", "dark"],
    ["#365D25", "dark"],
    ["#252F99", "dark"],
    ["#00CCFF", "light"],
    ["#674E60", "dark"],
    ["#FC009C", "light"],
    ["#92896B", "light"]
  ];

  var opu_type_to_color_map = {};

  for (i = 0; i < graph["all_opu_type_names"].length; i++) {
    opu_type_to_color_map[graph["all_opu_type_names"][i]] = colors_256[i];
  }
  var theme_types = {
    white: false,
    black: false
  };

  var set_theme = gui.addFolder("Choose theme");

  var white_theme = set_theme
    .add(theme_types, "white")
    .name("White")
    .listen()
    .onChange(function() {
      setChecked("white", theme_types);
      d3.select("body").classed("light_theme", true);
      d3.select("body").classed("dark_theme", false);
      document.getElementById("node_search_label").style.color = "black";
      markers.attr("fill", "black");
    });

  var black_theme = set_theme
    .add(theme_types, "black")
    .name("Black")
    .listen()
    .onChange(function() {
      setChecked("black", theme_types);
      d3.select("body").classed("dark_theme", true);
      d3.select("body").classed("light_theme", false);
      document.getElementById("node_search_label").style.color = "white";
      markers.attr("fill", "white");
    });

  // //  Perform default action of coloring nodes by opu initially
  // white_theme();
  setChecked("white", theme_types);

  var parameters = {
    a: false,
    b: false,
    c: false
  };
  var color_nodes = gui.addFolder("Color Nodes by");
  var color_nodes_by_error = color_nodes
    .add(parameters, "a")
    .name("Error Value")
    .listen()
    .onChange(function() {
      setChecked("a", parameters);
      node.attr("fill", function(d) {
        if (d.error == 0) {
          return "#12FF00";
        }
        if (d.error <= 0.2) {
          return "#D4FF00";
        }
        if (d.error <= 0.3) {
          return "#FFF600";
        }
        if (d.error <= 0.4) {
          return "#FFAF00";
        }
        if (d.error <= 0.5) {
          return "#FF2300";
        }
        return "#FF0000";
      });
      textElements_nodes.attr("fill", "#000000");
    });

  var nodes_by_opu = color_nodes
    .add(parameters, "b")
    .name("Op Nodes")
    .listen()
    .onChange(function() {
      setChecked("b", parameters);
      color_nodes_by_opu();
    });

  var color_nodes_by_base_graph = color_nodes
    .add(parameters, "c")
    .name("None")
    .listen()
    .onChange(function() {
      setChecked("c", parameters);
      node.attr("fill", "url(#gradient)");
      textElements_nodes.attr("fill", "#000000");
    });

  //  Perform default action of coloring nodes by opu initially
  // white_theme();
  color_nodes_by_opu();
  setChecked("b", parameters);

  gui.add(config, "restart").name("Restart");

  function reset() {
    window.location.reload();
  }

  function setChecked(prop, parameters) {
    for (let param in parameters) {
      parameters[param] = false;
    }
    parameters[prop] = true;
  }

  //This function looks up whether a pair are neighbours
  function neighboring(a, b) {
    return linkedByIndex[a.index + "," + b.index];
  }

  function color_nodes_by_opu() {
    node.attr("fill", function(d) {
      return opu_type_to_color_map[d.node_info][0];
    });
    textElements_nodes.attr("fill", function(d) {
      if (opu_type_to_color_map[d.node_info][1] == "dark") {
        return "#FFFFFF";
      }
      return "#000000";
    });
  }

  function createChart(counts, bins, name, num_zeroes, parent_folders) {
    let margin = {
        top: 300,
        right: 100,
        bottom: 50,
        left: 50
      },
      width = screen.width - 150;
    height = 700 - margin.top - margin.bottom;

    const svg = d3
      .select("body")
      .append("svg")
      .attr("id", function() {
        return "chart";
      })
      .attr("width", width)
      .attr("height", height)
      .style("border", "3px solid black")
      .style("float", "left")
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`)
      .call(
        d3
          .zoom()
          .translateExtent([
            [0, 0],
            [width, height]
          ])
          .extent([
            [0, 0],
            [width, height]
          ])
          .on("zoom", zoom)
      );

    // the scale
    var x = d3.scaleLinear().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);
    var xScale = x.domain([Math.min(...bins[0]), Math.max(...bins[0])]).nice();

    //Normalize betn 0-1
    var yScale = y.domain([0, 1]).nice();

    // for the width of rect
    var xBand = d3
      .scaleBand()
      .domain(d3.range(Math.min(...bins[0]), Math.max(...bins[0])))
      .range([0, width]);

    // zoomable rect
    svg
      .append("rect")
      .attr("class", "zoom-panel")
      .attr("width", width)
      .attr("height", height);

    // x axis
    var xAxis = svg
      .append("g")
      .attr("class", "xAxis")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(xScale).ticks(11));

    // y axis
    var yAxis = svg
      .append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(yScale));

    var bars = [];
    var colors = ["green", "red", "purple", "yellow", "orange"];
    // create a list of keys which are all available directories.
    var keys = graph.directories;
    var directories_to_show_in_legend = [];

    for (
      var current_hist_index = 0;
      current_hist_index < counts.length;
      current_hist_index++
    ) {
      // If parent_folder number is -1 the histogram is taken from current graph
      if (parent_folders[current_hist_index] == -1) {
        directories_to_show_in_legend.push("Graph");
      } else {
        directories_to_show_in_legend.push(
          keys[parent_folders[current_hist_index] + 1]
        );
      }

      bars[current_hist_index] = svg
        .append("g")
        .attr("clip-path", "url(#my-clip-path)")
        .selectAll(".bar")
        .data(counts[current_hist_index])
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", function(data, data_index) {
          return (
            xScale(bins[current_hist_index][data_index]) +
            ((xScale(bins[current_hist_index][data_index + 1]) -
              xScale(bins[current_hist_index][data_index])) /
              counts.length) *
              current_hist_index
          );
        })
        .attr("y", function(data, data_index) {
          return yScale(data / Math.max(...counts[current_hist_index]));
        })
        .attr("height", function(data) {
          return height - yScale(data);
        })
        .attr("width", function(data, data_index) {
          return (
            (xScale(bins[current_hist_index][data_index + 1]) -
              xScale(bins[current_hist_index][data_index])) /
            counts.length
          );
        })
        //saving current index value as id to fetch it in mouseover
        // which updates the index .
        .attr("id", current_hist_index)
        .style("fill", colors[parent_folders[current_hist_index] + 1])
        .style("opacity", 0.7)
        .on("mouseover", function(data, data_index) {
          div
            .transition()
            .duration(200)
            .style("opacity", 0.9);
          div
            .html(
              "Range: " +
                bins[d3.select(this).attr("id")][data_index] +
                " to " +
                bins[d3.select(this).attr("id")][data_index + 1] +
                "<br> count: " +
                data
            )
            .style("left", d3.event.pageX + "px")
            .style("top", d3.event.pageY - 28 + "px")
            .style("width", "auto")
            .style("height", "auto")
            .style("color", "green");
        })
        .on("mouseout", function(data) {
          div
            .transition()
            .duration(500)
            .style("opacity", 0);
        });
    }

    var SVG3 = svg.append("g");

    // Add one dot in the legend for each name.
    var size = 20;
    SVG3.selectAll("mydots")
      .data(parent_folders)
      .enter()
      .append("rect")
      .attr("x", 100)
      .attr("y", function(d, i) {
        return 100 + i * (size + 5);
      }) // 100 is where the first dot appears. 25 is the distance between dots
      .attr("width", size)
      .attr("height", size)

      .style("fill", function(d, i) {
        return colors[parent_folders[i] + 1];
      })
      .attr("transform", `translate(-50, -270)`);

    SVG3.selectAll("mylabels")
      .data(directories_to_show_in_legend)
      .enter()
      .append("text")
      .attr("x", 100 + size * 1.2)
      .attr("y", function(d, i) {
        return 100 + i * (size + 5) + size / 2;
      })
      .style("fill", function(d, i) {
        return "black";
      })
      .text(function(d) {
        return d;
      })
      .attr("transform", `translate(-50, -270)`)
      .attr("text-anchor", "left")
      .style("alignment-baseline", "middle");

    var defs = svg.append("defs");

    defs
      .append("clipPath")
      .attr("id", "my-clip-path")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    var title_chart = svg
      .append("text")
      .style("font-size", "20px")
      .text(function() {
        if (num_zeroes != 0) {
          return (
            "Histogram: " + name + " ( " + num_zeroes + " zeroes excluded )"
          );
        } else {
          return "Histogram: " + name;
        }
      })
      .attr("x", width / 2 + margin.left)
      .attr("y", -20 - (20 * current_hist_index + 1))
      .attr("transform", `translate(-470, -190)`)
      .attr("text-anchor", "middle");

    let hideTicksWithoutLabel = function() {
      d3.selectAll(".xAxis .tick text").each(function(d) {
        if (this.innerHTML === "") {
          this.parentNode.style.display = "none";
        }
      });
    };

    function zoom() {
      if (d3.event.transform.k < 1) {
        d3.event.transform.k = 1;
        return;
      }

      xAxis.call(d3.axisBottom(d3.event.transform.rescaleX(xScale)).ticks(12));

      hideTicksWithoutLabel();

      // the bars transform
      for (
        var current_hist_index = 0;
        current_hist_index < counts.length;
        current_hist_index++
      ) {
        bars[current_hist_index].attr(
          "transform",
          "translate(" +
            d3.event.transform.x +
            ",0)scale(" +
            d3.event.transform.k +
            ",1)"
        );
      }
    }
  }

  function connectedNodes() {
    if (toggle == 0) {
      // Reduce the opacity of all but the neighbouring nodes
      d = d3.select(this).node().__data__;
      node.style("opacity", function(o) {
        return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
      });

      link.style("opacity", function(o) {
        return (d.index == o.source.index) | (d.index == o.target.index)
          ? 1
          : 0.1;
      });

      edgelabels.style("opacity", function(o) {
        return (d.index == o.source.index) | (d.index == o.target.index)
          ? 1
          : 0.1;
      });

      textElements_nodes.style("opacity", function(o) {
        return neighboring(d, o) | neighboring(o, d) ? 1 : 0.1;
      });

      toggle = 1;
    } else {
      //Put them back to opacity 1
      node.style("opacity", 1);
      link.style("opacity", 1);
      edgelabels.style("opacity", 1);
      textElements_nodes.style("opacity", 1);
      toggle = 0;
    }
  }

  function lazyload() {
    /* Create and store the quadtree for nodes and links
     */
    quadtree_str_to_type_map = {};

    root_svg = document.getElementById("root_svg");
    zoom_svg = document.getElementById("zoom_svg");
    viewing_frame_coods = [];
    // should hold the coods start x, start y, width (extending right) and height (extending bottom)
    // of the viewing rectangle before transformation.
    viewing_frame_coods = [
      create_point(root_svg, 0, 0),
      create_point(root_svg, width, 0),
      create_point(root_svg, width, height),
      create_point(root_svg, 0, height)
    ];
    matrix = zoom_svg.getCTM();
    transformed_viewing_frame_coods = [];
    // holds the coordinates for top left, top right, bottom left and bottom right
    viewing_frame_coods.forEach(function(point_item) {
      transformed_viewing_frame_coods.push(
        point_item.matrixTransform(matrix.inverse())
      );
    });

    transformed_mid_x =
      (transformed_viewing_frame_coods[0].x +
        transformed_viewing_frame_coods[2].x) /
      2;
    transformed_mid_y =
      (transformed_viewing_frame_coods[0].y +
        transformed_viewing_frame_coods[2].y) /
      2;

    max_y =
      Math.max.apply(
        Math,
        node.data().map(function(o) {
          return o.y;
        })
      ) + 1;

    max_x =
      Math.max.apply(
        Math,
        node.data().map(function(o) {
          return o.x;
        })
      ) + 1;

    min_y =
      Math.min.apply(
        Math,
        node.data().map(function(o) {
          return o.y;
        })
      ) - 1;

    min_x =
      Math.min.apply(
        Math,
        node.data().map(function(o) {
          return o.x;
        })
      ) - 1;

    quad_tree_nodes = d3
      .quadtree()
      .extent([
        [min_x, min_y],
        [Math.abs(max_x - min_x), Math.abs(max_y - min_y)]
      ])
      .x(function(data_pt) {
        return 1;
      })
      .y(function(data_pt) {
        return 1;
      })
      .addAll(node.data());

    quad_tree_links = d3
      .quadtree()
      .extent([
        [min_x, min_y],
        [Math.abs(max_x - min_x), Math.abs(max_y - min_y)]
      ])
      .x(function(data_pt) {
        return data_pt.source.x;
      })
      .y(function(data_pt) {
        return data_pt.source.y;
      })
      .addAll(link.data());

    quadtree_str_to_type_map["node"] = quad_tree_nodes;
    quadtree_str_to_type_map["link"] = quad_tree_links;

    // Associating node textelements to the node quadtree.
    quadtree_str_to_type_map["textElement_nodes"] = quad_tree_nodes;

    // Associating edgepath,edgelbal to the link quadtree.
    quadtree_str_to_type_map["edgepath"] = quad_tree_links;
    quadtree_str_to_type_map["edgelabel"] = quad_tree_links;

    node_ids = fetch_elements_in_visible_view("node");
    link_ids = fetch_elements_in_visible_view("link");

    node_ids.forEach(show_all_node_related_elements);
    link_ids.forEach(show_all_link_related_elements);
    spinner.stop();
  }
  function ticked() {
    for (let i = 0; i < 10; i++) {
      simulation.tick();
    }

    /* A graph has these basic elements: nodes,links,textElements_nodes,
                                      edgepaths,edgelabels,polygons.
        Ticked changes the positions of these elements.
    */
    link
      .attr("x1", function(d) {
        return d.source.x;
      })
      .attr("y1", function(d) {
        return d.source.y;
      })
      .attr("x2", function(d) {
        return d.target.x;
      })
      .attr("y2", function(d) {
        return d.target.y;
      });

    node
      .attr("x", function(d) {
        return d.x;
      })
      .attr("y", function(d) {
        return d.y;
      });

    textElements_nodes.attr("x", node => node.x).attr("y", node => node.y);

    edgepaths.attr("d", function(d) {
      var path =
        "M " +
        d.source.x +
        " " +
        d.source.y +
        " L " +
        d.target.x +
        " " +
        d.target.y;
      return path;
    });

    edgelabels.attr("transform", function(d, i) {
      if (d.target.x < d.source.x) {
        bbox = this.getBBox();
        rx = bbox.x + bbox.width / 2;
        ry = bbox.y + bbox.height / 2;
        return "rotate(180 " + rx + " " + ry + ")";
      } else {
        return "rotate(0)";
      }
    });

    polygons.attr("d", groupPath).attr("d", groupPath);
  }

  var pulse = false;
  var rect_width = 0;
  var rect_height = 0;
  function pulsed(rect) {
    (function repeat() {
      if (pulse) {
        rect
          .transition()
          .duration(200)
          .attr("stroke-width", 0)
          .attr("stroke-opacity", 0)
          .attr("width", rect_width)
          .attr("height", rect_height)
          .transition()
          .duration(200)
          .attr("stroke-width", 0)
          .attr("stroke-opacity", 0.5)
          .attr("width", rect_width * 3)
          .attr("height", rect_height * 3)
          .transition()
          .duration(400)
          .attr("stroke-width", 65)
          .attr("stroke-opacity", 0)
          .attr("width", rect_width)
          .attr("height", rect_width)
          .ease(d3.easeSin)
          .on("end", repeat);
      } else {
        ticking = false;
        var og_color = rect.attr("fill");
        rect
          .attr("width", rect_width)
          .attr("height", rect_height)
          .attr("fill", og_color)
          .attr("stroke", "purple");
      }
    })();
  }

  function highlightNode() {
    var userInput = document.getElementById("targetNode");
    var temp = userInput.value;
    var userInputRefined = temp.replace(/[/]/g, "\\/");
    // make userInput work with "/" as they are considered special characters
    // the char "/" is escaped with escape characters.
    theNode = d3.select("#" + userInputRefined);
    const isEmpty = theNode.empty();
    if (isEmpty) {
      document.getElementById("output").innerHTML = "Given node doesn't exist";
    } else {
      document.getElementById("output").innerHTML = "";
    }
    pulse = true;
    rect_height = theNode.attr("height");
    rect_width = theNode.attr("width");
    if (pulse) {
      pulsed(theNode);
    }

    scalingFactor = 0.5;
    // Create a zoom transform from d3.zoomIdentity
    var transform = d3.zoomIdentity
      .translate(
        screen.width / 2 - scalingFactor * theNode.attr("x"),
        screen.height / 4 - scalingFactor * theNode.attr("y")
      )
      .scale(scalingFactor);
    // Apply the zoom and trigger a zoom event:
    svg1.call(zoom.transform, transform);
  }

  function minimizeNode() {
    var userInput = document.getElementById("targetNode");
    var temp = userInput.value;
    var userInputRefined = temp.replace(/[/]/g, "\\/");
    // make userInput work with "/" as they are considered special characters
    // the char "/" is escaped with escape characters.
    theNode = d3.select("#" + userInputRefined);
    const isEmpty = theNode.empty();
    if (isEmpty) {
      document.getElementById("output").innerHTML = "Given node doesn't exist";
    } else {
      document.getElementById("output").innerHTML = "";
    }
    pulse = false;
  }
}

makeRequest().then(data => drawGraph(data));
