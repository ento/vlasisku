function zeroFill( number, width ) {
  width -= number.toString().length;
  if ( width > 0 )
  {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number + ""; // always return a string
}

var margin = {top: 80, right: 0, bottom: 10, left: 80},
    colSize = 10,
    entryWidth = 72,
    entryHeight = 20,
    entryPadding = 0.2,
    width = colSize * entryWidth;

var x = d3.scale.ordinal().domain(d3.range(colSize)).rangeBands([0, colSize * entryWidth], entryPadding),
    y = d3.scale.ordinal(),
    c = d3.scale.category20().domain(d3.range(20));

var svg = d3.select("#cheatsheet").append("svg")
    .attr("id", "canvas")
    .style("margin-left", -margin.left + "px")
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("/entries.json?group_by=type", function(root) {

  var index = [],
      nodes = root.cmavo,
      n = nodes.length;

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
      return y(this.coords.yMap[[cat.mainIndex, cat.subIndex]]) + Math.floor(this.coords.xMap[d.word] / colSize) * entryHeight;
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

  function updateScale(layout) {
    var height = layout.coords.yMax * entryHeight;
    y.domain(d3.range(layout.coords.yMax));
    y.rangeBands([0, height], entryPadding);
    d3.select('#canvas')
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);
  }

  var entries = svg.selectAll(".entry")
      .data(nodes)
    .enter().append("g")
      .attr("class", "entry");

  entries.append("rect")
      .attr("width", "5")
      .attr("height", entryHeight * (1.0 - entryPadding))
      .attr("fill", function(d) { return c(findChapter(d)[0]); });

  entries.append("text")
      .attr("x", 6)
      .attr("y", 0)
      .attr("width", entryWidth)
      .attr("height", entryHeight * (1.0 - entryPadding))
      .attr("dy", ".64em")
      .attr("text-anchor", "start")
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .text(function(d) { return d.word; });

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
    var d = d3.select(this).datum();
    d3.json("/entries.json?lite=0&word=" + d.word, function(response) {
      $('#inspector').text(d.word + ' ' + d.grammarclass + ' ' + response.word.textdefinition);
               console.log(response);
    });
  }

  function mouseout() {
    //d3.selectAll("text").classed("active", false);
  }

  function currentLayout() {
    return layouts[$('#layout :selected').val()];
  }

  function changeLayout(value) {
    var layout = value ? layouts[value] : currentLayout();
    updateScale(layout);

    var t = svg.transition().duration(1000);
    t.selectAll(".entry")
      .delay(function(d, i) { return layout.coords.xMap[d.word] * 4; })
      .attr("transform", function(d) { return "translate(" + layout.x(d) + "," + layout.y(d) + ")"; });

    changeSelection();
  }

  function changeSelection() {
    var layout = currentLayout(),
      confusables = {t: [], r: [], b: [], l: [], identical: []},
      selected = $('#selected text').text();

    if (!selected)
      return;

    d3.selectAll(".entry.selected").each(function(d, i) {
      var text = $(this).find('text').text(),
        type = d.selection_type + (typeof d.diff_index === 'number' ? '-' + d.diff_index : ''),
        mem;
      if (type === 'yhy' || type === 'singleletter-1')
        mem = confusables.t
      else if (type === 'singleletter-2' || type === 'singleletter-3')
        mem = confusables.b
      else if (type === 'singleletter-0')
        mem = (text < selected) ? confusables.l : confusables.r;
      else if (type === 'identical')
        mem = confusables.identical;
      mem.push({el: this, text: text, d: d, i: i});
    });

    var center = confusables.identical[0];
    center.x = layout.x(center.d);
    center.y = layout.y(center.d);
    var bounds = {x: center.x, y: center.y, width: entryWidth, height: entryHeight};
    console.log(confusables.identical, center.text);

    for(type in confusables) {
      if (type === 'identical')
        continue;
      var mem = confusables[type],
        positions = layoutSelectionRow(center, type, mem);
      $.each(positions, function(i, pos) { growRectangle(bounds, pos); });
    }

    d3.selectAll('.entry:not(.selected)')
      .filter(function(d) {
        return contains(bounds, {x: layout.x(d), y: layout.y(d)});
      })
      .transition()
      .duration(1000)
      .delay(function(d, i) { return i * 4; })
      .attr('transform', function(d) {
        var each = {x: layout.x(d), y: layout.y(d), width: entryWidth, height: entryHeight},
          run = evade(bounds, each),
          evaded = move(each, {x: run.x * 1.2, y: run.y * 1.2});
        
        return 'translate(' + evaded.x + ',' + evaded.y + ')';
      });
/*
    svg.selectAll('#bounds')
      .data([bounds])
      .enter()
      .append('rect')
      .attr('id', 'bounds');

    svg.selectAll('#bounds')
      .attr('x', bounds.x)
      .attr('y', bounds.y)
      .attr('width', bounds.width)
      .attr('height', bounds.height);
*/
    
  }

  function layoutSelectionRow(center, direction, confusables) {
    confusables.sort(function(a, b) { return a.text.localeCompare(b.text); });
    var centerIndex = confusables.indexOf(center.text),
      reverse = direction === 'l' || direction === 't',
      positions = [];
    for(i in confusables) {
      var each = reverse ? confusables[confusables.length - i - 1] : confusables[i],
        pos = layoutSelection(center, direction, each, parseInt(i));
      if (pos)
        positions.push(pos, {x: pos.x + entryWidth, y: pos.y + entryHeight});
    }
    return positions;
  }

  function growRectangle(rect, point) {
    if (point.x < rect.x) {
      rect.width += rect.x - point.x;
      rect.x = point.x;
    } else if ((rect.x + rect.width) < point.x) {
      rect.width += point.x - (rect.x + rect.width);
    }
    if (point.y < rect.y) {
      rect.height += rect.y - point.y;
      rect.y = point.y;
    } else if ((rect.y + rect.height) < point.y) {
      rect.height += point.y - (rect.y + rect.height);
    }
  }

  function contains(rect, point) {
    if (point.x < rect.x || (rect.x + rect.width) < point.x)
      return false;
    if (point.y < rect.y || (rect.y + rect.height) < point.y)
      return false;
    return true;
  }

  function evade(danger, victim) {
    var dangerCenter = center(danger),
      victimCenter = center(victim),
      dx, dy;
    if (victimCenter.x < dangerCenter.x) {
      dx = danger.x - (victim.x + victim.width);
    } else {
      dx = danger.x + danger.width - victim.x;
    }
    if (victimCenter.y < dangerCenter.y) {
      dy = danger.y - (victim.y + victim.height);
    } else {
      dy = danger.y + danger.height - victim.y;
    }
    var evadeToX = Math.abs(dx) < Math.abs(dy);
//    console.log(dangerCenter, victimCenter, danger, victim, dx, dy);
    return {x: (evadeToX ? dx : 0), y: (evadeToX ? 0 : dy)};
  }

  function center(rect) {
    return {x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5};
  }

  function move(rect, diff) {
    return {x: rect.x + diff.x, y: rect.y + diff.y, width: rect.width, height: rect.height};
  }

  function layoutSelection(center, type, each, distance) {
    var directionMap = {
        't': {x: 0, y: -1},
        'l': {x: -1, y: 0},
        'b': {x: 0, y: 1},
        'r': {x: 1, y: 0}
      },
      direction = directionMap[type];

    if (!direction)
      return;
    
    var dx = center.x + entryWidth * direction.x * (distance + 1),
      dy = center.y + entryHeight * direction.y * (distance + 1);

    d3.select(each.el)
      .transition()
      .duration(1000)
      .delay(each.i * 4)
      .attr('transform', "translate(" + dx + "," + dy + ")");

    return {x: dx, y: dy};
  }

  $("#layout").on("change", function() {
    changeLayout(this.value);
  });

  var app = $.sammy('#yui-main', function() {
    this.get('#/sort/:layout', function() {
      $('#layout')
        .find('[value="' + this.params.layout + '"]').prop('selected', true).end()
        .trigger('change');
    });
  });

  $('#yui-main').on('click', '.entry text, .entry rect', function() {
    d3.select('#selected').attr('id', null);
    d3.selectAll('.entry.selected').attr('class', 'entry');
    var $entry = $(this).parent(),
      selected = $entry.attr('id', 'selected').find('text').text();
    d3.selectAll('.entry').each(function() {
      var each = $(this).find('text').text(),
        conf = isConfusable(selected, each);
      if (conf) {
        var d = d3.select(this)
          .attr('class', 'entry selected ' + conf.type)
          .datum();
        d.selection_type = conf.type;
        d.diff_index = conf.type === 'singleletter' ? parseInt(conf.index) : null;
      }
    });
    changeLayout();
  });

  $(function() { app.run('#' + location.hash); });
});

function isConfusable(a, b) {
  if (a === b)
    return {type: 'identical'};

  //a = a.replace("'", '');
  //b = b.replace("'", '');

  if (a.length !== b.length) {
    var longer = a.length > b.length ? a : b;
    var shorter = a.length > b.length ? b : a;
    for (i in longer) {
      var withApostrophe = shorter.substring(0, i) + "'" + shorter.substring(i);
      if (withApostrophe === longer)
         return {type: 'yhy'};
    }
    return null;
  }

  var diffs = 0, diffIndex;
  for (i in a) {
    if (a[i] !== b[i]) {
       diffs += 1;
       diffIndex = i;
    }
  }

  if (diffs === 1)
    return {type: 'singleletter', index: diffIndex};

  return null;
}

