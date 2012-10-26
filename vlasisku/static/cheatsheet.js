function translate(d, x, y) {
  if (typeof(x) !== 'undefined')
    d.x = x;
  if (typeof(y) !== 'undefined')
    d.y = y;
  return 'translate(' + d.x + ',' + d.y + ')';
}

function CLLIndex(cll) {
  this.cll = cll;
  this.gcIndex = this.calculateGrammarclassChapterIndex();
}
CLLIndex.prototype = {
  findChapter: function (entry) {
    var unknown = [99, 0];

    if (!entry.grammarclass)
      return unknown;
    var gc = entry.grammarclass,
        variants = [gc, gc.replace(/\*|\d$/g, ''), gc.replace(/\*|\d$|\d[a-z]/g, '')],
        keys = variants.filter(function(v) { return this.cll[v]; }, this);
    if (!keys.length)
      return unknown;

    return this.cll[keys[0]][0];
  },

  calculateGrammarclassChapterIndex: function() {
    var chapterGcs = {}, seenGcs = {};
    for (var gc in this.cll) {
      var chapters = this.cll[gc],
        section = chapters[0][1],
        chapter = chapters[0][0];

      if (!chapterGcs[chapter])
        chapterGcs[chapter] = [];
      chapterGcs[chapter].push([section, gc]);
    };

    var rv = {},
      max = 0;
    for (var chapter in chapterGcs) {
      var v = chapterGcs[chapter];
      v.sort();
      v.forEach(function(pair, i) {
        var gc = pair[1];
        rv[gc] = i;
        max = Math.max(max, i);
      });
    };

    rv.maxIndex = max;
    return rv;
  }
};

function SpatialIndex() {
  this.rt = new RTree();
}
SpatialIndex.prototype = {
  getBounds: function() {
    return this.rt.get_tree();
  },

  rebuildIndex: function(nodes) {
    this.rt = new RTree();
    nodes.forEach(function(n) {
      this.rt.insert({x: n.x, y: n.y, w: C.entryWidth, h: C.entryHeight}, n);
    }, this);
  },

  drilldown: function(referencePoint, specs) {
    for(var i in specs) {
      var found = this.drilldownEach(referencePoint, specs[i][0], specs[i][1]);
      if (found)
        return found;
    }
    return null;
  },

  drilldownEach: function(referencePoint, area, drilldowns) {
    var bounds = this.rt.get_tree(),
      nodes = this.rt.search(this.areaCodes[area](referencePoint, bounds));

    $.each(drilldowns, function(i, each) {
      if(nodes.length)
        nodes = this.drilldownCodes[each](d3.nest()).entries(nodes)[0].values;
    });

    return nodes[0];
  },

  areaCodes: {
    // left row
    lr: function(p, bounds) { return {x: bounds.x, y: p.y + 1, w: p.x - bounds.x - 1, h: C.entryHeight - 2}; },

    // left
    l: function(p, bounds) { return {x: bounds.x, y: bounds.y, w: p.x - 1 - bounds.x, h: bounds.h}; },

    // top column
    tc: function(p, bounds) { return {x: p.x + 1, y: bounds.y, w: C.entryWidth - 2, h: p.y - 1 - bounds.y}; },
 
    // top
    t: function(p, bounds) { return {x: bounds.x, y: bounds.y, w: bounds.w, h: p.y - 1 - bounds.y}; },

    // right row
    rr: function(p, bounds) { return {x: p.x + C.entryWidth + 1, y: p.y + 1, w: bounds.x + bounds.w - p.x - C.entryWidth - 1, h: C.entryHeight - 2}; },

    // right
    r: function(p, bounds) { return {x: p.x + C.entryWidth + 1, y: bounds.y, w: bounds.x + bounds.w - (p.x + C.entryWidth + 1), h: bounds.h}; },

    // bottom column
    bc: function(p, bounds) { return {x: p.x + 1, y: p.y + C.entryHeight + 1, w: C.entryWidth - 2, h: bounds.y + bounds.h - (p.y + C.entryHeight + 1)}; },

    // bottom
    b: function(p, bounds) { return {x: bounds.x, y: p.y + C.entryHeight + 1, w: bounds.w, h: bounds.h - (p.y + C.entryHeight + 1 - bounds.y)}; }
  },

  drilldownCodes: {
    l: function(index) { return index.key(function(d) { return d.x; }).sortKeys(numericAscending); },
    t: function(index) { return index.key(function(d) { return d.y; }).sortKeys(numericAscending); },
    r: function(index) { return index.key(function(d) { return d.x; }).sortKeys(numericDescending); },
    b: function(index) { return index.key(function(d) { return d.y; }).sortKeys(numericDescending); }
  }
};

var C = {};
C.colSize = 15;
C.entryWidth = 54;
C.entryHeight = 20;
C.entryPadding = 0.2;

d3.json("/entries.json?group_by=type", function(root) {
  // model -> model
  function updateScale(layout) {
    var height = layout.coords.yMax * C.entryHeight;
    y.domain([0, layout.coords.yMax]).range([0, height]);
  }

  // model -> view
  function adjustCanvasSize() {
    var bounds = spatial.getBounds(),
      canvasWidth = bounds.w,
      canvasHeight = bounds.h + 50;

    d3.select('#canvas')
      .attr("width", canvasWidth)
      .attr("height", canvasHeight);
    d3.select('#backdrop rect')
      .attr("width", canvasWidth)
      .attr("height", canvasHeight);

    $('#cheatsheet').scrollLeft(-pan.x).scrollTop(-pan.y);
  }

  // view -> model
  function currentLayout() {
    return layouts[$('#layout .active').data('value')];
  }

  // model -> view
  function updateMainView(value, callback) {
    var layout = value ? layouts[value] : currentLayout();
    updateScale(layout);

    var t = svg.transition().duration(1000);
    t.selectAll(".entry")
      .delay(function(d, i) { return layout.coords.xMap[d.word] * 4; })
      .attr("transform", function(d) {
         return translate(d, layout.x(d), layout.y(d));
      });

    // move backdrop to the very end
    $('#backdrop').appendTo('#content');
    layoutFocus();
    t.attr('data-last-update', (new Date()).getTime()).each('end', function() {
      spatial.rebuildIndex(nodes);
      updateCursor();
      adjustCanvasSize();
      if (callback) callback();
    });
    return t;
  }

  // model -> view
  function layoutFocus() {
    var layout = currentLayout(),
      confusables = {t: [], r: [], b: [], l: [], identical: []},
      focus = $('.focus-center text').text();

    if (!focus) {
      d3.select('#backdrop').attr('class', '');
      return;
    } else {
      d3.select('#backdrop').attr('class', 'in');
    }

    d3.selectAll(".entry.focus").each(function(d, i) {
      $(this).insertAfter('#backdrop');
      var text = $(this).find('text').text(),
        type = d.focus_type + (typeof d.diff_index === 'number' ? '-' + d.diff_index : ''),
        mem;
      if (type === 'yhy' || type === 'singleletter-1')
        mem = confusables.t;
      else if (type === 'singleletter-2' || type === 'singleletter-3')
        mem = confusables.b;
      else if (type === 'singleletter-0')
        mem = (text < focus) ? confusables.l : confusables.r;
      else if (type === 'identical')
        mem = confusables.identical;
      mem.push({el: this, text: text, d: d, i: i});
    });

    var center = confusables.identical[0];
    center.x = layout.x(center.d);
    center.y = layout.y(center.d);
    var bounds = {x: center.x, y: center.y, width: C.entryWidth, height: C.entryHeight};

    for(type in confusables) {
      if (type === 'identical')
        continue;
      var mem = confusables[type],
        positions = layoutFocusRow(center, type, mem);
      $.each(positions, function(i, pos) { growRectangle(bounds, pos); });
    }

    d3.selectAll('.entry:not(.focus)')
      .filter(function(d) {
        return contains(bounds, {x: layout.x(d), y: layout.y(d)});
      })
      .transition()
      .duration(1000)
      .delay(function(d, i) { return i * 4; })
      .attr('transform', function(d) {
        var each = {x: layout.x(d), y: layout.y(d), width: C.entryWidth, height: C.entryHeight},
          run = evade(bounds, each),
          evaded = move(each, {x: run.x * 1.2, y: run.y * 1.2});
        
        return translate(d, evaded.x, evaded.y);
      });
  }

  // model -> view
  function layoutFocusRow(center, direction, confusables) {
    confusables.sort(function(a, b) { return a.text.localeCompare(b.text); });
    var centerIndex = confusables.indexOf(center.text),
      reverse = direction === 'l' || direction === 't',
      positions = [];
    for(i in confusables) {
      var each = reverse ? confusables[confusables.length - i - 1] : confusables[i],
        pos = layoutFocusEntry(center, direction, each, parseInt(i));
      if (pos)
        positions.push(pos, {x: pos.x + C.entryWidth, y: pos.y + C.entryHeight});
    }
    return positions;
  }

  // model -> view
  function layoutFocusEntry(center, type, each, distance) {
    var directionMap = {
        't': {x: 0, y: -1},
        'l': {x: -1, y: 0},
        'b': {x: 0, y: 1},
        'r': {x: 1, y: 0}
      },
      direction = directionMap[type];

    if (!direction)
      return null;
    
    var dx = center.x + C.entryWidth * direction.x * (distance + 1),
      dy = center.y + C.entryHeight * direction.y * (distance + 1);

    d3.select(each.el)
      .transition()
      .duration(1000)
      .delay(each.i * 4)
      .attr('transform', function(d) {
        return translate(d, dx, dy);
      });

    return {x: dx, y: dy};
  }

  // model -> view
  function updateCursor() {
    var d;
    if (!cursor) {
      d = spatial.rt.search({x: 0, y: 0, h: 1, w: 1});
      d = (d && d.length) ? d[0] : nodes[0];
    } else {
      d = cursor.d;
    }
    moveCursor(d);
  }

  // model -> view
  function moveCursor(d) {
    d3.select('.entry.hover').classed('hover', false);
    d3.select('#' + slugify(d.word)).classed('hover', true);
    d3.select('#cursor')
      .attr('transform', translate(d));

    d3.json("/entries.json?lite=0&word=" + d.word, function(response) {
      var text = ['<span class="word">', d.word, '</span><span class="grammarclass">', d.grammarclass, '</span><span class="description">'],
        classOp = 'removeClass';
      if (response) {
        text.push(response.word.textdefinition);
      } else {
        classOp = 'addClass';
        text.push('Failed to load description');
      }
      text.push('</span>');
      $('#inspector')[classOp]('error').html(text.join(' '))
    });
    if (!cursor || cursor.d.word !== d.word)
      cursor = {d: d};
  }

  // view -> model
  function mouseover() {
    moveCursor(d3.select(this).datum());
  }

  // model -> view
  function unFocus() {
    d3.select('.focus-center').classed('focus-center', false);
    d3.selectAll('.entry.focus').attr('class', 'entry');
  }

  var pan = {x: 0, y: 0},
      x = d3.scale.linear().domain([0, C.colSize]).range([0, C.colSize * C.entryWidth]),
      y = d3.scale.linear(),
      c = d3.scale.category20b().domain(d3.range(20));
  
  var svg = d3.select("#cheatsheet").append("svg")
      .attr("id", "canvas")
    .append("g")
      .attr("id", "content");
  
  svg.append("g")
    .attr('id', 'cursor')
    .append('rect')
    .attr('width', C.entryWidth)
    .attr('height', C.entryHeight)
    .attr('transform', 'translate(0,-3)');
  
  svg.append("g")
    .attr('id', 'backdrop')
    .append('rect')
    .attr('width', 1000)
    .attr('height', 1000);

  var index = [],
      cll = new CLLIndex(root.cll),
      spatial = new SpatialIndex(),
      nodes = root.cmavo.concat(root['experimental cmavo']),
      n = nodes.length,
      gc = d3.scale.category10().domain(d3.range(cll.gcIndex.maxIndex)),
      cursor;

  // Precompute the orders.
  var scales = {x: x, y: y},
    layouts = {
      alphabet: new ABCLayout(scales, nodes, cll),
      chapter: new ChapterLayout(scales, nodes, cll),
      length: new LengthLayout(scales, nodes, cll)
    };

  var entries = svg.selectAll(".entry")
      .data(nodes)
    .enter().append("g")
      .attr("class", "entry")
      .attr("id", function(d) { return slugify(d.word); })
      .attr("transform", "translate(0,-10000)"),
    crestWidth = 5,
    crestOffset = 0,
    fontHeight = 14 - 3,
    crestGap = (fontHeight - crestOffset) - crestWidth * 2;

  entries.append("rect")
      .attr("width", crestWidth)
      .attr("height", crestWidth)
      .attr("transform", "translate(0," + crestOffset + ")")
      .attr("fill", function(d) { return c(cll.findChapter(d)[0]); });

  entries.append("rect")
      .attr("width", crestWidth)
      .attr("height", crestWidth)
      .attr("transform", "translate(0," + (crestOffset + crestWidth + crestGap) + ")")
      .attr("fill", function(d) { return gc(cll.gcIndex[d.grammarclass]); });

  entries.append("text")
      .attr("x", 6)
      .attr("y", 0)
      .attr("width", C.entryWidth)
      .attr("height", C.entryHeight * (1.0 - C.entryPadding))
      .attr("text-anchor", "start")
      .on("mouseover", mouseover)
      .text(function(d) { return d.word; });

  // view -> model -> view
  $('#canvas').on('click', '.entry text, .entry rect', function() {
    unFocus();
    var $entry = $(this).parent(),
      focus = $entry.find('text').text(),
      d = d3.select($entry.get()[0]).classed('focus-center', true).datum();
    d3.selectAll('.entry').each(function() {
      var each = $(this).find('text').text(),
        conf = isConfusable(focus, each);
      if (conf) {
        var d = d3.select(this)
          .classed('focus', true)
          .classed(conf.type, true)
          .datum();
        d.focus_type = conf.type;
        d.diff_index = conf.type === 'singleletter' ? parseInt(conf.index) : null;
      }
    });
    updateMainView(null, function() { panToShow(d); });
  });

  // view -> model -> view
  $('#backdrop').on('click', function() {
    unFocus();
    updateMainView();
  });

  // view -> model -> view
  $("#layout").on("change", function() {
    updateMainView($(this).find('.active').data('value'));
  });

  // controller
  function selectLeft() {
    var selected = spatial.drilldown(cursor.d, [['lr', 'r'], ['t', 'br']]);
    if (selected)
      moveCursor(selected);
  }

  // controller
  function selectRight() {
    var selected = spatial.drilldown(cursor.d, [['rr', 'l'], ['b', 'tl']]);
    if (selected)
      moveCursor(selected);
  }

  // controller
  function selectUp() {
    var selected = spatial.drilldown(cursor.d, [['tc', 'b']]);
    if (selected)
      moveCursor(selected);
  }

  // controller
  function selectDown() {
    var selected = spatial.drilldown(cursor.d, [['bc', 't']]);
    if (selected)
      moveCursor(selected);
  }

  // controller
  function panLeft() {
    panBy(-C.entryWidth * 0.5);
  }

  // controller
  function panUp() {
    panBy(0, -C.entryHeight);
  }

  // controller
  function panDown() {
    panBy(0, C.entryHeight);
  }

  // controller
  function panRight() {
    panBy(C.entryWidth * 0.5);
  }

  // controller
  function panBy(x, y) {
    pan.x += x || 0;
    adjustCanvasSize();
  }

  // controller
  function panTo(p) {
    pan.x = -p.x;
    pan.y = -p.y;
    adjustCanvasSize();
  }

  // controller
  function panToShow(d) {
    var viewport = getViewport();

    if (contains(viewport, {x: d.x, y: d.y, width: C.entryWidth, height: C.entryHeight})) {
      return;
    }

    var xMargin = viewport.width * 0.1,
      yMargin = viewport.height * 0.4;

    viewport.right = viewport.x + viewport.width;
    viewport.bottom = viewport.y + viewport.height;
    dRight = d.x + C.entryWidth;
    dBottom = d.y + C.entryHeight;

    // d | viewport |
    if (d.x < viewport.x)
      pan.x = -d.x + xMargin;

    //   | viewport | d
    if (viewport.right < dRight)
      pan.x = -(dRight - viewport.width) - xMargin;

    if (d.y < viewport.y)
      pan.y = -d.y + yMargin;

    if (viewport.bottom < dBottom)
      pan.y = -(dBottom - viewport.height) - yMargin;

    adjustCanvasSize();
  }

  // view
  function getViewport() {
    var $sheet = $('#cheatsheet');
    return {x: -pan.x, y: -pan.y, width: $sheet.width(), height: $sheet.height()};
  }

  // controller
  function search() {
    var q = $('#q').val(),
      candidates = [];
    d3.selectAll('.entry').each(function(d) {
      var textElem = d3.select(this).select('text');
      if (q.length && d.word.startsWith(q)) {
        textElem.text('');
        textElem.append('tspan').attr('class', 'highlight').text(q);
        textElem.append('tspan').text(d.word.slice(q.length));
        candidates.push(d);
      } else {
        textElem.text(d.word);
      }
    });
    updateSearchCandidates(candidates);
  }

  // model -> view
  function updateSearchCandidates(candidates) {
    var li = d3.select('#candidates').selectAll('li').data(candidates),
      cur = d3.select('#candidates .selected');
    li
      .enter()
      .append('li');
    li
      .text(function(d){ return d.word; });
    li
      .exit().remove();
    li
      .on('click', function(d) {
        jumpToCandidate($(this));
      });
    $('#candidates .selected').removeClass('selected');
    if (!cur.empty()) {
      var prev = cur.datum().word;
      li.each(function(d){
        if (d.word === prev)
          $(this).addClass('.selected');
      });
    }
    if (!$('#candidates .selected').length)
      $('#search-next').trigger('click');
  }

  // controller
  function jumpToCandidate($next, $cur) {
    if (!$cur || !$cur.length)
      $cur = $('#candidates .selected');
    $cur.removeClass('selected');
    $next.addClass('selected');
    d3.select($next.get()[0]).each(function(d){
      moveCursor(d);
      panToShow(d);
    });
  }

  // controller
  $('#search-next, #search-prev').on('click', function(e) {
    e.preventDefault();
    var $cur = $('#candidates .selected'),
      selectNext = $(e.target).is('#search-next'),
      $next = selectNext ? $cur.next('li') : $cur.prev('li');
    if(!$next.length)
      $next = $('#candidates li')[selectNext ? 'first' : 'last']();

    jumpToCandidate($next, $cur);
  });

  // controller
  $('#search-box input').on('keyup', _.debounce(search, 100));

  function focusSearchBox() {
    $('#search-box input').focus();
    return false;
  }

  // controller
  Mousetrap
    .bind('h', selectLeft)
    .bind('j', selectDown)
    .bind('k', selectUp)
    .bind('l', selectRight)
    .bind('s', panLeft)
    .bind('d', panDown)
    .bind('f', panUp)
    .bind('g', panRight)
    .bind('/', focusSearchBox);

  // controller
  $('#layout button').each(function(i, each){
    var $each = $(each);
    Mousetrap.bind(i + 1 + '', function() {
      layoutButtonClicked($each);
    });
    $each.on('click', function() {
      layoutButtonClicked($each);
    });
  })

  // controller
  function layoutButtonClicked($button) {
    if ($button.is('.active'))
      return;
    $('#layout').find('.active').removeClass('active');
    $button.button('toggle');
    $('#layout').trigger('change');
  }

  var app = $.sammy('#wrapper', function() {
    this.get('#/sort/:layout', function() {
      $('#layout')
        .find('[data-value="' + this.params.layout + '"]').button('toggle').end()
        .trigger('change');
    });
  });

  $(function() { app.run('#' + (location.hash || '/sort/alphabetical')); });
});
