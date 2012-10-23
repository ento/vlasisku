if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}

function zeroFill( number, width ) {
  width -= number.toString().length;
  if ( width > 0 )
  {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number + ""; // always return a string
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

function contains(aRect, bRect) {
  var bx_lt_ax = bRect.x < aRect.x,
    ar_lt_br = (aRect.x + aRect.width) < (bRect.x + (bRect.width || 0));
  if (bx_lt_ax || ar_lt_br)
    return false;
  var by_lt_ay = bRect.y < aRect.y,
    ab_lt_bb = (aRect.y + aRect.height) < (bRect.y + (bRect.height || 0));
  if (by_lt_ay || ab_lt_bb)
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
    console.log(dangerCenter, victimCenter, danger, victim, dx, dy);
  return {x: (evadeToX ? dx : 0), y: (evadeToX ? 0 : dy)};
}

function center(rect) {
  return {x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5};
}

function move(rect, diff) {
  return {x: rect.x + diff.x, y: rect.y + diff.y, width: rect.width, height: rect.height};
}

function translate(d, x, y) {
  if (typeof(x) !== 'undefined')
    d.x = x;
  if (typeof(y) !== 'undefined')
    d.y = y;
  return 'translate(' + d.x + ',' + d.y + ')';
}

function debounce(fn, timeout) {
  var timeoutID = -1;
  return function() {
    if (timeoutID > -1) {
      window.clearTimeout(timeoutID);
    }
    timeoutID = window.setTimeout(fn, timeout);
  }
};

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

function numericAscending(a, b) {
  return d3.ascending(parseFloat(a), parseFloat(b));
}

function numericDescending(a, b) {
  return -numericAscending(a, b);
}

var pan = {x: 0, y: 0},
    colSize = 10,
    entryWidth = 48,
    entryHeight = 20,
    entryPadding = 0.2,
    width = colSize * entryWidth;

var x = d3.scale.linear().domain([0, colSize]).range([0, colSize * entryWidth]),
    y = d3.scale.linear(),
    c = d3.scale.category20().domain(d3.range(20));

var svg = d3.select("#cheatsheet").append("svg")
    .attr("id", "canvas")
  .append("g")
    .attr("id", "content");

svg.append("g")
  .attr('id', 'cursor')
  .append('rect')
  .attr('width', entryWidth)
  .attr('height', entryHeight);

svg.append("g")
  .attr('id', 'backdrop')
  .append('rect')
  .attr('width', 1000)
  .attr('height', 1000);

d3.json("/entries.json?group_by=type", function(root) {
  var index = [],
      nodes = root.cmavo,
      n = nodes.length,
      cursor, rt;

  function Layout(nodes) {
    this.coords = calculateCoords(nodes, this);
  }

  Layout.prototype = {
    letters: 'abcdefgijklmnoprstuvxyz',

    categorize: function() {
      throw 'Not implemented';
    },

    x: function(d) {
      return x(this.coords.xMap[d.word] % colSize);
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
    y.domain([0, layout.coords.yMax]).range([0, height]);
  }

  function adjustCanvasSize() {
    var bounds = rt.get_tree(),
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

  function currentLayout() {
    return layouts[$('#layout .active').data('value')];
  }

  function changeLayout(value) {
    var layout = value ? layouts[value] : currentLayout();
    updateScale(layout);

    var t = svg.transition().duration(1000);
    t.selectAll(".entry")
      .delay(function(d, i) { return layout.coords.xMap[d.word] * 4; })
      .attr("transform", function(d) {
         return translate(d, layout.x(d), layout.y(d));
      });

    $('#backdrop').appendTo('#content');
    layoutFocus();
    t.attr('data-last-update', (new Date()).getTime()).each('end', function() {
      rebuildIndex();
      updateCursor();
      adjustCanvasSize();
    });
  }

  function layoutFocus() {
    var layout = currentLayout(),
      confusables = {t: [], r: [], b: [], l: [], identical: []},
      focus = $('#focus text').text();

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
    var bounds = {x: center.x, y: center.y, width: entryWidth, height: entryHeight};

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
        var each = {x: layout.x(d), y: layout.y(d), width: entryWidth, height: entryHeight},
          run = evade(bounds, each),
          evaded = move(each, {x: run.x * 1.2, y: run.y * 1.2});
        
        return translate(d, evaded.x, evaded.y);
      });
  }

  function layoutFocusRow(center, direction, confusables) {
    confusables.sort(function(a, b) { return a.text.localeCompare(b.text); });
    var centerIndex = confusables.indexOf(center.text),
      reverse = direction === 'l' || direction === 't',
      positions = [];
    for(i in confusables) {
      var each = reverse ? confusables[confusables.length - i - 1] : confusables[i],
        pos = layoutFocusEntry(center, direction, each, parseInt(i));
      if (pos)
        positions.push(pos, {x: pos.x + entryWidth, y: pos.y + entryHeight});
    }
    return positions;
  }

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
    
    var dx = center.x + entryWidth * direction.x * (distance + 1),
      dy = center.y + entryHeight * direction.y * (distance + 1);

    d3.select(each.el)
      .transition()
      .duration(1000)
      .delay(each.i * 4)
      .attr('transform', function(d) {
        return translate(d, dx, dy);
      });

    return {x: dx, y: dy};
  }

  function rebuildIndex() {
    rt = new RTree();
    nodes.forEach(function(n) {
      rt.insert({x: n.x, y: n.y, w: entryWidth, h: entryHeight}, n);
    });
  }

  function updateCursor() {
    var d;
    if (!cursor) {
      d = rt.search({x: 0, y: 0, h: 1, w: 1});
      d = (d && d.length) ? d[0] : nodes[0];
    } else {
      d = cursor.d;
    }
    moveCursor(d);
  }

  function moveCursor(d) {
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

  function mouseover() {
    moveCursor(d3.select(this).datum());
  }

  function mouseout() {
    //d3.selectAll("text").classed("active", false);
  }

  function unFocus() {
    d3.select('#focus').attr('id', null);
    d3.selectAll('.entry.focus').attr('class', 'entry');
  }

  $('#canvas').on('click', '.entry text, .entry rect', function() {
    unFocus();
    var $entry = $(this).parent(),
      focus = $entry.attr('id', 'focus').find('text').text();
    d3.selectAll('.entry').each(function() {
      var each = $(this).find('text').text(),
        conf = isConfusable(focus, each);
      if (conf) {
        var d = d3.select(this)
          .attr('class', 'entry focus ' + conf.type)
          .datum();
        d.focus_type = conf.type;
        d.diff_index = conf.type === 'singleletter' ? parseInt(conf.index) : null;
      }
    });
    changeLayout();
  });

  $('#backdrop').on('click', function() {
    unFocus();
    changeLayout();
  });

  $("#layout").on("change", function() {
    changeLayout($(this).find('.active').data('value'));
  });

  var areaCodes = {
    // left row
    lr: function(p, bounds) { return {x: bounds.x, y: p.y + 1, w: p.x - bounds.x - 1, h: entryHeight - 2}; },

    // left
    l: function(p, bounds) { return {x: bounds.x, y: bounds.y, w: p.x - 1 - bounds.x, h: bounds.h}; },

    // top column
    tc: function(p, bounds) { return {x: p.x + 1, y: bounds.y, w: entryWidth - 2, h: p.y - 1 - bounds.y}; },

    // top
    t: function(p, bounds) { return {x: bounds.x, y: bounds.y, w: bounds.w, h: p.y - 1 - bounds.y}; },

    // right row
    rr: function(p, bounds) { return {x: p.x + entryWidth + 1, y: p.y + 1, w: bounds.x + bounds.w - p.x - entryWidth - 1, h: entryHeight - 2}; },

    // right
    r: function(p, bounds) { return {x: p.x + entryWidth + 1, y: bounds.y, w: bounds.x + bounds.w - (p.x + entryWidth + 1), h: bounds.h}; },

    // bottom column
    bc: function(p, bounds) { return {x: p.x + 1, y: p.y + entryHeight + 1, w: entryWidth - 2, h: bounds.y + bounds.h - (p.y + entryHeight + 1)}; },

    // bottom
    b: function(p, bounds) { return {x: bounds.x, y: p.y + entryHeight + 1, w: bounds.w, h: bounds.h - (p.y + entryHeight + 1 - bounds.y)}; }
  };

  var drilldownCodes = {
    l: function(index) { return index.key(function(d) { return d.x; }).sortKeys(numericAscending); },
    t: function(index) { return index.key(function(d) { return d.y; }).sortKeys(numericAscending); },
    r: function(index) { return index.key(function(d) { return d.x; }).sortKeys(numericDescending); },
    b: function(index) { return index.key(function(d) { return d.y; }).sortKeys(numericDescending); }
  };

  function drilldownEntry(referencePoint, specs) {
    for(var i in specs) {
      var found = drilldownEntryEach(referencePoint, specs[i][0], specs[i][1]);
      if (found)
        return found;
    }
    return null;
  }

  function drilldownEntryEach(referencePoint, area, drilldowns) {
    var bounds = rt.get_tree(),
      nodes = rt.search(areaCodes[area](referencePoint, bounds));

    $.each(drilldowns, function(i, each) {
      if(nodes.length)
        nodes = drilldownCodes[each](d3.nest()).entries(nodes)[0].values;
    });

    return nodes[0];
  }

  function selectLeft() {
    var selected = drilldownEntry(cursor.d, [['lr', 'r'], ['t', 'br']]);
    if (selected)
      moveCursor(selected);
  }

  function selectRight() {
    var selected = drilldownEntry(cursor.d, [['rr', 'l'], ['b', 'tl']]);
    if (selected)
      moveCursor(selected);
  }

  function selectUp() {
    var selected = drilldownEntry(cursor.d, [['tc', 'b']]);
    if (selected)
      moveCursor(selected);
  }

  function selectDown() {
    var selected = drilldownEntry(cursor.d, [['bc', 't']]);
    if (selected)
      moveCursor(selected);
  }

  function panLeft() {
    panBy(-entryWidth * 0.5);
  }

  function panUp() {
    panBy(0, -entryHeight);
  }

  function panDown() {
    panBy(0, entryHeight);
  }

  function panRight() {
    panBy(entryWidth * 0.5);
  }

  function panBy(x, y) {
    pan.x += x || 0;
    adjustCanvasSize();
  }

  function panTo(p) {
    pan.x = -p.x;
    pan.y = -p.y;
    adjustCanvasSize();
  }

  function panToShow(d) {
    var viewport = getViewport();

    if (contains(viewport, {x: d.x, y: d.y, width: entryWidth, height: entryHeight})) {
      return;
    }

    var xMargin = viewport.width * 0.1,
      yMargin = viewport.height * 0.4;

    viewport.right = viewport.x + viewport.width;
    viewport.bottom = viewport.y + viewport.height;
    dRight = d.x + entryWidth;
    dBottom = d.y + entryHeight;

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

  function getViewport() {
    var $sheet = $('#cheatsheet');
    return {x: -pan.x, y: -pan.y, width: $sheet.width(), height: $sheet.height()};
  }

  function showSearchBox(e) {
    $('#search-box').show().find('input').focus();
    return false;
  }

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

  $('#search-next, #search-prev').on('click', function(e) {
    e.preventDefault();
    var $cur = $('#candidates .selected'),
      selectNext = $(e.target).is('#search-next'),
      $next = selectNext ? $cur.next('li') : $cur.prev('li');
    if(!$next.length)
      $next = $('#candidates li')[selectNext ? 'first' : 'last']();

    jumpToCandidate($next, $cur);
  });

  $('#search-box input').on('keyup', debounce(search, 100));

  Mousetrap
    .bind('h', selectLeft)
    .bind('j', selectDown)
    .bind('k', selectUp)
    .bind('l', selectRight)
    .bind('s', panLeft)
    .bind('d', panDown)
    .bind('f', panUp)
    .bind('g', panRight)
    .bind('/', showSearchBox);

  $('#layout button').each(function(i, each){
    var $each = $(each);
    Mousetrap.bind(i + 1 + '', function() {
      layoutButtonClicked($each);
    });
    $each.on('click', function() {
      layoutButtonClicked($each);
    });
  })

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

