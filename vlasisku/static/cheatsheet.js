var margin = {top: 80, right: 0, bottom: 10, left: 80},
    width = 720,
    height = 1440;

var x = d3.scale.ordinal().rangeBands([0, width]),
    y = d3.scale.ordinal().rangeBands([0, height]),
    c = d3.scale.category20().domain(d3.range(20));

var svg = d3.select("#cheatsheet").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("margin-left", -margin.left + "px")
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("/entries.json", function(root) {

  var index = [],
      nodes = root.cmavo,
      n = nodes.length,
      colSize;

  colSize = 10; //d3.max(index, function(row) { return row.values.length; });

  function extend(superType, submethods) {
    function factory() {};
    factory.prototype = superType.prototype;
    var subproto = new factory();
    subproto.superType = superType;
    for (var key in submethods) {
      subproto[key] = submethods[key];
    }
    return subproto;
  }

  function Layout(nodes) {
    this.coords = calculateCoords(nodes, this);
  }
  Layout.prototype = {
    letters: 'abcdefgijklmnoprstuvxyz',
    categorize: function() {
      throw 'Not implemented';
    },
    x: function(d) {
      return x(this.coords.xMap[d.word]);
    },

    y: function(d) {
      var cat = this.categorize(d);
      return y(this.coords.yMap[[cat.mainIndex, cat.subIndex]]) + Math.floor(this.coords.xMap[d.word] / colSize) * y.rangeBand();
    }
  };

  function ABCLayout() {
    this.superType.apply(this, arguments);
  }
  ABCLayout.prototype = extend(Layout, {
    categorize: function(d) {
      return {
        mainIndex: this.letters.indexOf(d.word[0]),
        subIndex: d.word.length - 1
      };
    }
  });

  function LengthLayout() {
    this.superType.apply(this, arguments);
  }
  LengthLayout.prototype = extend(Layout, {
    categorize: function(d) {
      return {
        mainIndex: d.word.length,
        subIndex: this.letters.indexOf(d.word[0])
      };
    }
  });

  function ChapterLayout() {
    this.superType.apply(this, arguments);
  }
  ChapterLayout.prototype = extend(Layout, {
    categorize: function(d) {
      var chapter = findChapter(d);
      return {
        mainIndex: chapter[0],
        subIndex: chapter[1]
      };
    }
  });

  function calculateCoords(nodes, layout) {
    var yMap = {},
      xMap = {},
      y = 0,
      index = d3.nest()
      .key(function(d) { return zeroFill(layout.categorize(d).mainIndex, 2); })
      .sortKeys(d3.ascending)
      .key(function(d) { return zeroFill(layout.categorize(d).subIndex, 2); })
      .sortKeys(d3.ascending)
      .sortValues(function(a, b) { return d3.ascending(a.word, b.word); })
      .entries(nodes);

    index.forEach(function(maingroup) {
      maingroup.values.forEach(function(subgroup) {
        subgroup.height = Math.ceil(subgroup.values.length / colSize);
        subgroup.y = y;

        var key = [parseInt(maingroup.key, 10), parseInt(subgroup.key, 10)];
        yMap[key] = subgroup.y;
        subgroup.values.forEach(function(entry, i) {
          xMap[entry.word] = i;
        });
        y = y + subgroup.height;
      });
      y += 1;
    });
    return {yMap: yMap, xMap: xMap, yMax: y};
  }

  // Precompute the orders.
  var layouts = {
    alphabet: new ABCLayout(nodes),
    chapter: new ChapterLayout(nodes),
    length: new LengthLayout(nodes)
  };

  var layout = layouts.chapter;

  function zeroFill( number, width )
  {
    width -= number.toString().length;
    if ( width > 0 )
    {
      return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
    }
    return number + ""; // always return a string
  }

  // The default sort order.
  x.domain(d3.range(colSize));
  y.domain(d3.range(layout.coords.yMax));

  svg.append("rect")
      .attr("class", "background")
      .attr("width", width)
      .attr("height", height);

  var entries = svg.selectAll(".entry")
      .data(nodes)
    .enter().append("g")
      .attr("class", "entry")
      .attr("transform", function(d) { return "translate(" + layout.x(d) + "," + layout.y(d) + ")"; });

  entries.append("rect")
      .attr("width", "5")
      .attr("height", y.rangeBand())
      .attr("fill", function(d) { return c(findChapter(d)[0]); });

  entries.append("text")
      .attr("x", 6)
      .attr("y", 0)
      .attr("width", x.rangeBand())
      .attr("height", y.rangeBand())
      .attr("dy", ".64em")
      .attr("text-anchor", "start")
      .attr("stroke", "#444")
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .text(function(d) { return d.word; });

  function entry(subgroup) {
    var entries = d3.select(this).selectAll(".entry")
        .data(subgroup.values)
      .enter().append("g")
        .attr("class", "entry")
        .attr("transform", function(d, i) { return "translate(" + x(i) + "," + Math.floor(i / colSize) * y.rangeBand() + ")"; });
//        .attr("x", function(d, i) { return x(i); })
//        .attr("y", function(d, i) { return Math.floor(i / colSize) * y.rangeBand(); })

  }

  function findChapter(entry) {
    if (!entry.grammarclass)
      return [];
    var gc = entry.grammarclass,
        variants = [gc, gc.replace(/\*|\d$/g, ''), gc.replace(/\*|\d$|\d[a-z]/g, '')],
        keys = variants.filter(function(v) { return root.cll[v]; });
    if (!keys.length)
      return [];

    return root.cll[keys[0]][0];
  }

  function mouseover(p) {
    d3.selectAll(".row text").classed("active", function(d, i) { return i == p.y; });
    d3.selectAll(".column text").classed("active", function(d, i) { return i == p.x; });
  }

  function mouseout() {
    d3.selectAll("text").classed("active", false);
  }

  d3.select("#layout").on("change", function() {
//    clearTimeout(timeout);
    changeLayout(this.value);
  });

  function changeLayout(value) {
    var layout = layouts[value];

    var t = svg.transition().duration(2500);

    y.domain(d3.range(layout.coords.yMax));
    t.selectAll(".entry")
      .delay(function(d, i) { return layout.coords.xMap[d.word] * 4; })
      .attr("transform", function(d) { return "translate(" + layout.x(d) + "," + layout.y(d) + ")"; });
  }

/*
  var timeout = setTimeout(function() {
    order("group");
    d3.select("#order").property("selectedIndex", 2).node().focus();
  }, 5000);
*/
});
