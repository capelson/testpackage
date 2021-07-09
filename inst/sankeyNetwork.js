HTMLWidgets.widget({
  name: "sankeyNetwork",

  type: "output",

  initialize: function (el, width, height) {
    d3.select(el).append("svg").style("width", "100%").style("height", "100%");

    return {
      sankey: d3.sankey(),
      x: null,
    };
  },

  resize: function (el, width, height, instance) {
    // with flexdashboard and slides
    //   sankey might be hidden so height and width 0
    //   in this instance re-render on resize
    if (d3.min(instance.sankey.size()) <= 0) {
      this.renderValue(el, instance.x, instance);
    }
  },

  renderValue: function (el, x, instance) {
    // save the x in our instance (for calling back from resize)
    instance.x = x;

    // alias sankey and options
    var sankey = instance.sankey;
    var options = x.options;

    // convert links and nodes data frames to d3 friendly format
    var links = HTMLWidgets.dataframeToD3(x.links);
    var nodes = HTMLWidgets.dataframeToD3(x.nodes);

    // margin handling
    //   set our default margin to be 20
    //   will override with x.options.margin if provided
    var margin = { top: 20, right: 20, bottom: 20, left: 20 };

    //   go through each key of x.options.margin
    //   use this value if provided from the R side
    Object.keys(x.options.margin).map(function (ky) {
      if (x.options.margin[ky] !== null) {
        margin[ky] = x.options.margin[ky];
      }
    });

    // get the width and height
    var width = el.getBoundingClientRect().width - margin.right - margin.left;
    var height = el.getBoundingClientRect().height - margin.top - margin.bottom;

    var color = eval(options.colourScale);
    
    var color_node = function color_node(d) {
      if (d.group) {
        return color(d.group.replace(/ .*/, ""));
      } else {
        return "#cccccc";
      }
    };
    
    var color_link = function color_link(d) {
      console.log(d)
      if (d.group || options.linkGradient === TRUE) {
        return color(d.group.replace(/ .*/, ""));
      } else {
        return "#000000";
      }
    };

    var opacity_link = function opacity_link(d) {
      if (d.group) {
        return 0.5;
      } else {
        return 0.2;
      }
    };

    var formatNumber = d3.format(",.0f"),
      format = function (d) {
        return formatNumber(d);
      };

    // create d3 sankey layout
    sankey
      .nodes(nodes)
      .links(links)
      .size([width, height])
      .nodeWidth(options.nodeWidth)
      .nodePadding(options.nodePadding)
      .sinksRight(options.sinksRight)
      .layout(options.iterations);
      
    // remove previously added scale
    d3.select(el).select("div").remove();

    // select the svg element and remove existing children
    d3.select(el).select("svg").selectAll("*").remove();

    // remove any previously set viewBox attribute
    d3.select(el).select("svg").attr("viewBox", null);

    // append g for our container to transform by margin
    var svg = d3
      .select(el)
      .select("svg")
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // draw path
    var path = sankey.link();

    // draw links
    var link = svg
      .selectAll(".link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", path)
      .style("stroke-width", function (d) {
        return Math.max(1, d.dy);
      })
      .style("fill", "none")
      .style("stroke", color_link)
      .style("stroke-opacity", opacity_link)
      .sort(function (a, b) {
        return b.dy - a.dy;
      })
      .on("mouseover", function (d) {
        d3.select(this).style("stroke-opacity", function (d) {
          return opacity_link(d) + 0.3;
        });
      })
      .on("mouseout", function (d) {
        d3.select(this).style("stroke-opacity", opacity_link);
      });

    // add backwards class to cycles
    link.classed("backwards", function (d) {
      return d.target.x < d.source.x;
    });

    svg
      .selectAll(".link.backwards")
      .style("stroke-dasharray", "9,1")
      .style("stroke", "#402");
      
    var defs = svg.append("defs");

    console.log(defs)
        if (options.linkGradient) {
          
          var lg = defs.append("linearGradient")
          .attr("id", "linearLinkGradient")
          .attr("x1", "0%")
          .attr("x2", "100%") // horizontal gradient
          .attr("y1", "0%")
          .attr("y2", "0%");

          lg.append("stop")
          .attr("offset", "0%")
          .style("stop-color", "#A0A0A0")//end in light gray
          .style("stop-opacity", 1)
        
          lg.append("stop")
          .attr("offset", "100%")
          .style("stop-color", "#D0D0D0")//start in dark gray
          .style("stop-opacity", 1)
        }

    // draw nodes
    var node = svg
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .on("mouseover", null)
      .on("mouseover", function (d) {
        link
          .filter(function (d1, i) {
            return d.targetLinks.includes(d1) | d.sourceLinks.includes(d1);
          })
          .style("stroke-opacity", function (d) {
            return opacity_link(d) + 0.3;
          });
        Shiny.onInputChange("node_piechart", d.name);
      })
      .on("mouseout", function (d) {
        link
          .filter(function (d1, i) {
            return d.targetLinks.includes(d1) | d.sourceLinks.includes(d1);
          })
          .style("stroke-opacity", opacity_link);
      })
      .on("mousedown.drag", Shiny.onInputChange("node_zoom", null))
      .on("click", function (d) {
        if (node_to_zoom.includes(d.name)) {
          d3.select(this).style("stroke-width", "5");
          Shiny.onInputChange("node_zoom", d.name);
        }
      })
      .call(function () {
        manualLayout();
      });
      
    // note: u2192 is right-arrow
    link
      .append("title")
      .append("foreignObject")
      .append("xhtml:body")
      .html(function (d) {
        return (
          "<pre>" +
          d.source.name +
          " \u2192 " +
          d.target.name +
          "\n" +
          format(d.value) +
          " " +
          options.units +
          "</pre>"
        );
      });

    node
      .append("rect")
      .attr("height", function (d) {
        return d.dy;
      })
      .attr("width", sankey.nodeWidth())
      .style("fill", function (d) {
        return (d.color = color_node(d));
      })
      .style("stroke", function (d) {
        return d3.rgb(d.color).darker(2);
      })
      .style("opacity", 0.9)
      .append("title")
      .append("foreignObject")
      .append("xhtml:body")
      .html(function (d) {
        return (
          "<pre>" +
          d.name + ': ' +
          "<br>" +
          format(d.value) +
          " " +
          options.units +
          "</pre>"
        );
      });

    const node_to_zoom = [
      "Apples and products",
      "Animals",
      "Pigmeat",
      "Bananas",
      "Barley and products",
      "Beans",
      "Meat",
      "Bovine Meat",
      "Cereals",
      "Citrus, Other",
      "Coconuts - Incl Copra",
      "Cropland Production",
      "Dates",
      "Fats",
      "Aquatic Products",
      "Fish, Seafood",
      "Fruits",
      "Fruits, Other",
      "Grapes and products (excl wine)",
      "Groundnuts",
      "Materials",
      "Lemons, Limes and products",
      "Maize and products",
      "Meat, Other",
      "Poultry Meat",
      "Mutton & Goat Meat",
      "Dairy",
      "Milk, whole fresh camel",
      "Milk, whole fresh cow",
      "Milk, whole fresh goat",
      "Milk, whole fresh sheep",
      "Millet and products",
      "Nuts and products",
      "Oats",
      "Offals, Edible",
      "Oilcrops",
      "Oilcrops, Other",
      "Olives (including preserved)",
      "Onions",
      "Oranges, Mandarines",
      "Other",
      "Palm kernels",
      "Peas",
      "Pineapples and products",
      "Plantains",
      "Potatoes and products",
      "Pulses",
      "Pulses, Other and products",
      "Rape and Mustardseed",
      "Rice and products",
      "Sesame seed",
      "Soyabeans",
      "Spices",
      "Spices, Other",
      "Starchy Roots",
      "Stimulants",
      "Sugar Crops",
      "Sunflower seed",
      "Tea (including mate)",
      "Tomatoes and products",
      "Treenuts",
      "Vegetables",
      "Vegetables, Other",
      "Wheat and products",
      "Yams",
      "Aquatic Products, Other",
      "Coffee and products",
      "Milk, whole fresh buffalo",
      "Rye and products",
      "Cereals, Other",
      "Cocoa Beans and products",
      "Grapefruit and products",
      "Pepper",
      "Pimento",
      "Sorghum and products",
      "Cassava and products",
      "Sweet potatoes",
      "Roots, Other",
      "Cloves",
      'Net Imports Harvest',
      'Net Imports Primary'

    ];

    //Add cursor to nodes with zoom
    d3.select(el)
      .selectAll(".node rect")
      .filter(function (d) {
        return node_to_zoom.includes(d.name);
      })
      .style("cursor", "zoom-in");

    node
      .append("text")
      .attr("x", -6)
      .attr("y", function (d) {
        return d.dy / 2;
      })
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("transform", null)
      .text(function (d) {
        return d.name;
      })
      .style("font-size", options.fontSize + "px")
      .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
      .filter(function (d) {
        return d.x < width / 2 || !options.sinksRight;
      })
      .attr("x", 6 + sankey.nodeWidth())
      .attr("text-anchor", "start");

    // adjust viewBox to fit the bounds of our tree
    var s = d3.select(svg.node().parentNode);

    s.attr(
      "viewBox",
      [
        d3.min(
          s
            .selectAll("g")
            .nodes()
            .map(function (d) {
              return d.getBoundingClientRect().left;
            })
        ) -
          s.node().getBoundingClientRect().left -
          margin.right,
        d3.min(
          s
            .selectAll("g")
            .nodes()
            .map(function (d) {
              return d.getBoundingClientRect().top;
            })
        ) -
          s.node().getBoundingClientRect().top -
          margin.top,
        d3.max(
          s
            .selectAll("g")
            .nodes()
            .map(function (d) {
              return d.getBoundingClientRect().right;
            })
        ) -
          d3.min(
            s
              .selectAll("g")
              .nodes()
              .map(function (d) {
                return d.getBoundingClientRect().left;
              })
          ) +
          margin.left +
          margin.right,
        d3.max(
          s
            .selectAll("g")
            .nodes()
            .map(function (d) {
              return d.getBoundingClientRect().bottom;
            })
        ) -
          d3.min(
            s
              .selectAll("g")
              .nodes()
              .map(function (d) {
                return d.getBoundingClientRect().top;
              })
          ) +
          margin.top +
          margin.bottom,
      ].join(",")
    );

    //Styling elements
    d3.select(el)
      .selectAll(".node rect")
      .filter(function (d) {
        return d.name.startsWith("Net");
      })
      .attr(
        "style",
        "fill:	#FFFFFF; stroke: #000000; stroke-width: 1; opacity: 0.9; cursor: help"
      );

    d3.select(el)
      .selectAll(".node rect")
      .filter(function (d, i) {
        return ["Human processed food", "Human raw food"].indexOf(d.name) >= 0;
      })
      .style("stroke", "#8EAF0C")
      .style("stroke-width", "3");

    d3.select(el)
      .selectAll(".node rect")
      .filter(function (d, i) {
        return (
          [
            "Fuels",
            "Consumer goods",
            "Industrial goods",
            "Drugs",
            "Edible oils and fats",
          ].indexOf(d.name) >= 0
        );
      })
      .style("stroke", "#000000")
      .style("stroke-width", "3");

    //Add titles to stages

    //Stage 1
    const productionNodes = ["Cropland Production", "Graizing", "Marine"];

    let group_1 = svg.selectAll(".node").filter(function (d) {
      return productionNodes.includes(d.name);
    });

    if (group_1._groups[0].length !== 0) {
      let x_group_1 = group_1._groups[0][0].__data__.x;

      svg
        .append("text")
        .attr("transform", null)
        .attr("y", -10)
        .attr("x", x_group_1)
        .attr("fill", "#A9A9A9")
        .text("Production");
    }

    //Stage 2
    const processNodes = [
      "Processed",
      "By-product",
      "Industrial",
      "Seed",
      "Animal usable",
      "Crop Residues",
      "Loss",
      "Net Exports Crop"
    ];

    let group_2 = svg.selectAll(".node").filter(function (d) {
      return processNodes.includes(d.name);
    });

    if (group_2._groups[0].length !== 0) {
      let x_group_2 = group_2._groups[0][0].__data__.x;

      svg
        .append("text")
        .attr("transform", null)
        .attr("y", -10)
        .attr("x", x_group_2)
        .attr("fill", "#A9A9A9")
        .text("Processing");
    }

    //Stage 3
    const animalNodes = ["Animals"];

    let group_3 = svg.selectAll(".node").filter(function (d) {
      return animalNodes.includes(d.name);
    });

    if (group_3._groups[0].length !== 0) {
      var x_group_3 = group_3._groups[0][0].__data__.x;

      svg
        .append("text")
        .attr("transform", null)
        .attr("y", -10)
        .attr("x", x_group_3)
        .attr("fill", "#A9A9A9")
        .text("Animals");
    }

    //Stage 4
    const goodsNodes = [
      "Human raw food",
      "Human processed food",
      "Alcoholic Beverages",
      "Consumer goods",
      "Industrial goods",
      "Tourists/refugee",
      "Fuels",
      "Drugs",
      "Edible oils and fats",
      "Net Exports Food",
      "Net Exports Goods",
    ];

    let group_4 = svg.selectAll(".node").filter(function (d) {
      return goodsNodes.includes(d.name);
    });

    if (group_4._groups[0].length !== 0) {
      var x_group_4 = group_4._groups[0][0].__data__.x;

      svg
        .append("text")
        .attr("transform", null)
        .attr("y", -10)
        .attr("x", x_group_4)
        .attr("fill", "#A9A9A9")
        .text("Goods");
    }

    const cropNodes = [
      "Cereals",
      "Sugar Crops",
      "Fruits",
      "Oilcrops",
      "Starchy Roots",
      "Vegetables",
      "Other",
      "Barley and products",
      "Cereals, Other",
      "Maize and products",
      "Millet and products",
      "Oats",
      "Rice and products",
      "Rye and products",
      "Sorghum and products",
      "Wheat and products",
      "Apples and products",
      "Bananas",
      "Citrus, Other",
      "Dates",
      "Fruits, Other",
      "Grapefruit and products",
      "Grapes and products (excl wine)",
      "Lemons, Limes and products",
      "Oranges, Mandarines",
      "Pineapples and products",
      "Plantains",
      "Coconuts - Incl Copra",
      "Cottonseed",
      "Groundnuts",
      "Oilcrops, Other",
      "Olives (including preserved)",
      "Palm kernels",
      "Rape and Mustardseed",
      "Sesame seed",
      "Soyabeans",
      "Sunflower seed",
      "Beans",
      "Peas",
      "Pulses, Other and products",
      "Cloves",
      "Pepper",
      "Pimento",
      "Spices, Other",
      "Cassava and products",
      "Potatoes and products",
      "Roots, Other",
      "Sweet potatoes",
      "Yams",
      "Cocoa Beans and products",
      "Coffee and products",
      "Tea (including mate)",
      "Nuts and products",
      "Onions",
      "Tomatoes and products",
      "Vegetables, Other",
      "Pulses",
      "Stimulants",
      "Treenuts",
      "Spices",
    ];

    //Stage zoom/Cropland
    group_5 = svg.selectAll(".node").filter(function (d) {
      return cropNodes.includes(d.name);
    });

    //Change place of Animals node
    function manualLayout() {
      for (j = 0; j < nodes.length; j++) {
        pickNode = d3.selectAll(".node")._groups[0][j];
        d = nodes[j];
        if (d.name === "Animals") {
          d3.select(pickNode).attr(
            "transform",
            "translate(" +
              (d.x = d.x) +
              "," +
              (d.y = Math.max(0, Math.min(height - d.dy))) +
              ")"
          );
        }
      }

      sankey.relayout();
      link.attr("d", path);
    }
    
    //Add scale
    let coef_refactor = 1 /  window.devicePixelRatio;
    
    let node__height = svg.selectAll(".node rect")._groups[0][0].__data__.dy;
    let node__value = svg.selectAll(".node rect")._groups[0][0].__data__.value;
    
    const refactor = 57;
    
    let node__full_size = node__height / refactor;
    let scale_value = node__value * coef_refactor / node__full_size;
    
    let sankey_graph = document.getElementById('plot');
    let div = document.createElement("div");
    
    let scale_text = document.createElement("p");
    scale_text.textContent = "1 сm ~  " + scale_value.toFixed(1) + " Kilotonne";
    
    scale_text.setAttribute("style", "margin: 0px;");
    
    div.setAttribute("id", "scale");
    div.setAttribute("style", "background-color: #F0F0F0; float: right;  border-radius: 12px; box-shadow: inset 0 1px 0 0 white; color: #1a3e66; padding: 6px 0 7px 0; text-align: center; text-shadow: 0 1px 1px #fff; outline: 0; width: auto; height: 40px; padding: 10px; vertical-align: middle; letter-spacing: 1px; font-size: 14px;")

    sankey_graph.append(div);
    div.append(scale_text)
  },
});
