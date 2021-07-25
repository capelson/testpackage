HTMLWidgets.widget({

    name: "sankeyNetwork",

    type: "output",

    initialize: function(el, width, height) {

        d3.select(el).append("svg")
            .style("width", "100%")
            .style("height", "100%");

        return {
          sankey: d3.sankey(),
          x: null
        };
    },

    resize: function(el, width, height, instance) {
        /*  handle resizing now through the viewBox
        d3.select(el).select("svg")
            .attr("width", width)
            .attr("height", height + height * 0.05);

        this.renderValue(el, instance.x, instance);
        */

        // with flexdashboard and slides
        //   sankey might be hidden so height and width 0
        //   in this instance re-render on resize
        if( d3.min(instance.sankey.size()) <= 0 ) {
          this.renderValue(el, instance.x, instance);
        }
    },

    renderValue: function(el, x, instance) {

        // save the x in our instance (for calling back from resize)
        instance.x = x;

        // alias sankey and options
        var sankey = instance.sankey;
        var options = x.options;
        var stage_names = HTMLWidgets.dataframeToD3(x.options.stage_names);
        // convert links and nodes data frames to d3 friendly format
        var links = HTMLWidgets.dataframeToD3(x.links);
        var nodes = HTMLWidgets.dataframeToD3(x.nodes);


        // margin handling
        //   set our default margin to be 20
        //   will override with x.options.margin if provided
        var margin = {top: 20, right: 80, bottom: 20, left: 20};
        //   go through each key of x.options.margin
        //   use this value if provided from the R side
        Object.keys(x.options.margin).map(function(ky){
          if(x.options.margin[ky] !== null) {
            margin[ky] = x.options.margin[ky];
          }
          // set the margin on the svg with css style
          // commenting this out since not correct
          // s.style(["margin",ky].join("-"), margin[ky]);
        });

        // get the width and height
        var width = el.getBoundingClientRect().width - margin.right - margin.left;
        var height = el.getBoundingClientRect().height - margin.top - margin.bottom;

        var color = eval(options.colourScale);

        var color_node = function color_node(d){
          if (d.group){
            return color(d.group.replace(/ .*/, ""));
          } else {
            return "#cccccc";
          }
        }

        var color_link = function color_link(d){
          if (d.group){
            return color(d.group.replace(/ .*/, ""));
          } else {
            return "#000000";
          }
        }

        var opacity_link = function opacity_link(d){
          if (d.group){
            return 0.7;
          } else {
            return 0.2;
          }
        }


        var formatNumber = d3.format(",.0f"),
        format = function(d) { return formatNumber(d); }

        // create d3 sankey layout
        sankey
            .nodes(nodes)
            .links(links)
            .size([width, height])
            .nodeWidth(options.nodeWidth)
            .nodePadding(options.nodePadding)
            .sinksRight(options.sinksRight)
            .layout(options.iterations);

        // select the svg element and remove existing children
        d3.select(el).select("svg").selectAll("*").remove();
        // remove any previously set viewBox attribute
        d3.select(el).select("svg").attr("viewBox", null);
        // append g for our container to transform by margin
        var svg = d3.select(el).select("svg").append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // draw path
        var path = sankey.link();

        // draw links
        var link = svg.selectAll(".link")
            .data(links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", path)
            .style("stroke-width", function(d) { return Math.max(1, d.dy); })
            .style("fill", "none")
            .style("stroke", color_link)
            .style("stroke-opacity", opacity_link)
            .sort(function(a, b) { return b.dy - a.dy; })
            .on("mouseover", function(d) {
                d3.select(this)
                .style("stroke-opacity", function(d){return opacity_link(d) + 0.3});
            })
            .on("mouseout", function(d) {
                d3.select(this)
                .style("stroke-opacity", opacity_link);
            });

        // add backwards class to cycles
        link.classed('backwards', function (d) { return d.target.x < d.source.x; });

        svg.selectAll(".link.backwards")
            .style("stroke-dasharray","9,1")
            .style("stroke","#402")

        // draw nodes
        var node = svg.selectAll(".node")
            .data(nodes)
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) { return "translate(" +
                                            d.x + "," + d.y + ")"; })

            .on("mouseover", function(d) {
                link.filter(function(d1, i) { return d.targetLinks.includes(d1) | d.sourceLinks.includes(d1); })
                 .style("stroke-opacity", function(d){return opacity_link(d) + 0.3});
            })
            .on("mouseout", function(d) {
                link.filter(function(d1, i) { return d.targetLinks.includes(d1) | d.sourceLinks.includes(d1); })
                .style("stroke-opacity", opacity_link);
            })
            .call(function () {
            manualLayout();
        });
        // note: u2192 is right-arrow
        link.append("title")
            .append("foreignObject")
            .append("xhtml:body")
            .html(function(d) { return "<pre>" + d.source.name + " \u2192 " + d.target.name +
                "\n" + format(d.value) + " " + options.units + "</pre>"; });

        node.append("rect")
            .attr("height", function(d) { return d.dy; })
            .attr("width", sankey.nodeWidth())
            .style("fill", function(d) {
                return d.color = color_node(d); })
            .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
            .style("opacity", 0.9)
            .style("cursor", "move")
            .style('margin-left', '10px')
            .attr("position", "relative")
            .append("title")
            .append("foreignObject")
            .append("xhtml:body")
            .html(function(d) { return "<pre>" + d.name + "<br>" + format(d.value) +
                " " + options.units + "</pre>"; });

        var textWidth = [];

        node.append("text")
            .attr("x", -6)
            .attr("y", function(d) { return d.dy / 2; })
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .attr("transform", null)
            .text(function(d) { return d.name; })
            .style("font-size", options.fontSize + "px")
            .style('font-weight', 500)
            .style("font-family", options.fontFamily ? options.fontFamily : "inherit")
            .style("text-shadow", "-1px -1px 0 #ffffff, 1px -1px 0 #ffffff, -1px 1px 0 #ffffff, 1px 1px 0 #ffffff")
            .filter(function(d) { return d.x < width / 2 || !options.sinksRight; })
            .each(function(d,i) {
                if (d.targetLinks.length === 0)
                {
                    var thisWidth = this.getComputedTextLength()
                    textWidth.push(thisWidth)
                }

                // remove them just after displaying them
            })
            .filter(function(d) { return d.targetLinks.length === 0; })
            .attr("x", -6 - Math.max.apply(Math, textWidth))
            .attr("text-anchor", "start");



        // adjust viewBox to fit the bounds of our tree
        var s = d3.select(svg.node().parentNode);
        s.attr(
            "viewBox",
            [
              d3.min(
                s.selectAll('g').nodes().map(function(d){
                  return d.getBoundingClientRect().left
                })
              ) - s.node().getBoundingClientRect().left - margin.right,
              d3.min(
                s.selectAll('g').nodes().map(function(d){
                  return d.getBoundingClientRect().top
                })
              ) - s.node().getBoundingClientRect().top - margin.top,
              d3.max(
                s.selectAll('g').nodes().map(function(d){
                  return d.getBoundingClientRect().right
                })
              ) -
              d3.min(
                s.selectAll('g').nodes().map(function(d){
                  return d.getBoundingClientRect().left
                })
              )  + margin.left + margin.right,
              d3.max(
                s.selectAll('g').nodes().map(function(d){
                  return d.getBoundingClientRect().bottom
                })
              ) -
              d3.min(
                s.selectAll('g').nodes().map(function(d){
                  return d.getBoundingClientRect().top
                })
              ) + margin.top + margin.bottom
            ].join(",")
          );

    d3.selectAll("g.node")
        .filter(function (d) {return d.targetLinks.length !== 0 & !['Total Costs', 'Total Revenue', 'Net Profit', 'Net Loss'].includes(d.name);})
        .selectAll("text").remove();
    // definition of stages
    let group_1 = svg.selectAll(".node");

    let nodes_x_coord = [];
    for (let i = 0; i < group_1._groups[0].length; i++) {
        let x_group_1 = group_1._groups[0][i].__data__.x;
        nodes_x_coord[i] = x_group_1;

    }
    nodes_x_coord = [...new Set(nodes_x_coord)];
    nodes_x_coord = nodes_x_coord.sort(function (a, b) {  return a - b;  });
    let json_stages_x_coord = {};
    for (let i = 0; i < nodes_x_coord.length; i++)
    {
        json_stages_x_coord[i] = nodes_x_coord[i];
    }



    if (stage_names.length != 0)
    {
        for (let i = 0; i < stage_names.length; i++)
        {
            svg
                .append('g')
                .attr('class', 'stages')
                .datum({name: stage_names[i]['stage_name']})

           d3.selectAll('g.stages')
            .filter(function(d) { return d.name == stage_names[i]['stage_name']; })
            .append("text")
            .attr('class', 'stages')
            .attr("transform", null)
            .attr("y", height+x.options.margin['bottom'])
            .attr("x", nodes_x_coord[stage_names[i]['stage_id']])
            .attr("fill", "#000000")
            .attr('cursor', 'pointer')
            .text(stage_names[i]['stage_name'])
            .style('font-size', '20px');


        }
    }

    d3.selectAll('g.node')
        .filter(function(d) {return d.targetLinks.length == 0 & d.name != 'Revenue' ;})
        .append('foreignObject')
        .attr('x', -60 - Math.max.apply(Math, textWidth))
        .attr("y", function(d) { return d.dy/2-8; })
        .attr('width', options.fontSize)
        .attr('height', options.fontSize)
        .append("xhtml:body")
        .style('display', 'block')
        .attr("class","zoom-icon")
        .attr('id', 'zoom-in')
        .datum({zoom:1})
        .style('opacity', 0.7)
        .on('mouseover', function (d) {
            d3.select(this).style("opacity", 1);
        })
        .on('mouseout', function (d) {
            d3.select(this).style("opacity", 0.7);
        });

     d3.selectAll('g.node')
        .filter(function(d) {return d.targetLinks.length == 0 & d.name != 'Revenue' ;})
        .append('foreignObject')
        .attr('x', -30 - Math.max.apply(Math, textWidth))
        .attr("y", function(d) { return d.dy/2-8; })
        .attr('width', options.fontSize)
        .attr('height', options.fontSize)
        .append("xhtml:body")
        .style('display', 'block')
        .style('opacity', 0.9)
        .attr("class","zoom-icon")
        .attr('id', 'zoom-out')
        .datum({zoom:0})
        .style('opacity', 0.7)
        .on('mouseover', function (d) {
            d3.select(this).style("opacity", 1);
        })
        .on('mouseout', function (d) {
            d3.select(this).style("opacity", 0.7);
        });

    const zoom_in_style = {
        'border-radius': '50%',
        'width': '100%',
        'height': '100%',
        'background-image': 'linear-gradient(white, white), linear-gradient(white, white)',
        'background-repeat': 'no-repeat',
        'background-position': 'center center',
        'background-size': '20% 70%, 70% 20%',
        'background-color': 'rgb(44, 108, 128)'

    }

    const zoom_out_style = {
        'border-radius': '50%',
        'width': '100%',
        'height': '100%',
        'background-image': 'linear-gradient(white, white)',
        'background-repeat': 'no-repeat',
        'background-position': 'center',
        'background-size': '70% 20%',
        'background-color': 'rgb(217, 33, 20)'

    }



    Object.entries(zoom_in_style).forEach(([prop,val]) => d3.selectAll("#zoom-in").style(prop,val))

    Object.entries(zoom_out_style).forEach(([prop,val]) => d3.selectAll("#zoom-out").style(prop,val))



    function manualLayout() {
        for (j = 0; j < nodes.length; j++){
            pickNode = d3.selectAll(".node")._groups[0][j];
            d = nodes[j];
            if (d.name === "Net Profit"){
                new_y_pos = d.dy;
            }
        }
      for (j = 0; j < nodes.length; j++){
            pickNode = d3.selectAll(".node")._groups[0][j];
            d = nodes[j];
            if (d.name != "Revenue" & d.name != 'Total Revenue' & d.name != 'Net Profit'){
                 d3.select(pickNode).attr(
            "transform",
            "translate(" +
              (d.x = d.x) +
              "," +
              (d.y = height - d.dy- d.y) +
              ")"
          );
            }
        }

      for (j = 0; j < nodes.length; j++) {
        pickNode = d3.selectAll(".node")._groups[0][j];
        d = nodes[j];
        if (d.name === "Total Costs") {
          d3.select(pickNode).attr(
            "transform",
            "translate(" +
              (d.x = d.x) +
              "," +
              (d.y = new_y_pos) +
              ")"
          );
        }
      }

      sankey.relayout();
      link.attr("d", path);
    }



    console.log(height)

    function dragmove(d) {
            d3.select(this).attr("transform", "translate(" + d.x + "," +
            (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
            sankey.relayout();
            link.attr("d", path);
        }


    },
});
