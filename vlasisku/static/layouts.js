(function(app) {

app.Layouts = {};

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

function Layout(nodes, cll) {
  this.coords = calculateCategoricalCoords(nodes, cll, this);
  this.scales = {
    x: d3.scale.linear().domain([0, app.C.colSize]).range([0, app.C.colSize * app.C.entryWidth]),
    y: d3.scale.linear().domain([0, this.coords.yMax]).range([0, this.coords.yMax * app.C.entryHeight])
  };
}

Layout.prototype = {
  letters: 'abcdefgijklmnoprstuvxyz',

  applyBaseLayout: function(nodes) {
    nodes.forEach(function(d) {
      updateXY(d, this.x(d), this.y(d));
    }, this);
  },

  categorize: function() {
    throw 'Not implemented';
  },

  x: function(d) {
    return this.scales.x(this.coords.xMap[d.word] % app.C.colSize);
  },

  y: function(d) {
    var cat = this.coords.cMap[d.word];
    return this.scales.y(this.coords.yMap[cat]) + Math.floor(this.coords.xMap[d.word] / app.C.colSize) * app.C.entryHeight;
  },

  applyFocusLayout: function(nodes, focus) {
    var rows = {t: [], r: [], b: [], l: [], identical: []};

    nodes.forEach(function(d, i) {
      if (!d.confusable)
        return;

      var each = d.word,
        conf = d.confusable,
        type = conf.type + (typeof conf.index === 'number' ? '-' + conf.index : ''),
        row;
      if (type === 'yhy' || type === 'singleletter-1')
        row = rows.t;
      else if (type === 'singleletter-2' || type === 'singleletter-3')
        row = rows.b;
      else if (type === 'singleletter-0')
        row = (each < focus) ? rows.l : rows.r;
      else if (type === 'identical')
        row = rows.identical;
      row.push(d);
    });

    var center = rows.identical[0];
    if (center) {
      var bounds = {x: this.x(center), y: this.y(center), width: app.C.entryWidth, height: app.C.entryHeight};
  
      for(direction in rows) {
        if (direction === 'identical')
          continue;
        var row = rows[direction],
          plots = this.layoutFocusRow(center, direction, row);
        _.each(plots, function(pos) { growRectangle(bounds, pos); });
      }
    }

    nodes.forEach(function(d) {
      if (d.confusable)
        return;

      var rect = {x: this.x(d), y: this.y(d), width: app.C.entryWidth, height: app.C.entryHeight};

      if (!center || !contains(bounds, rect)) {
        updateXY(d, this.x(d), this.y(d));
        return;
      }

      var run = evade(bounds, rect),
        evaded = move(rect, {x: run.x * 1.2, y: run.y * 1.2});

      updateXY(d, evaded.x, evaded.y);
    }, this);
  },

  directionMap: {
    't': {x: 0, y: -1},
    'l': {x: -1, y: 0},
    'b': {x: 0, y: 1},
    'r': {x: 1, y: 0}
  },

  // model -> view
  layoutFocusRow: function(center, direction, row) {
    row.sort(function(a, b) { return a.word.localeCompare(b.word); });

    var reverse = direction === 'l' || direction === 't',
      plots = [];
    _.range(row.length).forEach(function(i) {
      var each = reverse ? row[row.length - i - 1] : row[i],
        pos = this.layoutFocusEntry(center, direction, each, i);
      if (pos)
        plots.push(pos, {x: pos.x + app.C.entryWidth, y: pos.y + app.C.entryHeight});
    }, this);
    return plots;
  },

  layoutFocusEntry: function(center, direction, d, distance) {
    var uv = this.directionMap[direction];

    if (!uv)
      return null;
    
    var x = center.x + app.C.entryWidth * uv.x * (distance + 1),
      y = center.y + app.C.entryHeight * uv.y * (distance + 1);

    updateXY(d, x, y);
    return d;
  }
};

app.Layouts.ABCLayout = function() {
  this.superType.apply(this, arguments);
}

app.Layouts.ABCLayout.prototype = extend(Layout, {
  categorize: function(d) {
    return {
      mainIndex: this.letters.indexOf(d.word[0]),
      subIndex: d.word.length - 1
    };
  }
});

app.Layouts.LengthLayout = function() {
  this.superType.apply(this, arguments);
}

app.Layouts.LengthLayout.prototype = extend(Layout, {
  categorize: function(d) {
    return {
      mainIndex: d.word.length,
      subIndex: this.letters.indexOf(d.word[0])
    };
  }
});

app.Layouts.ChapterLayout = function() {
  this.superType.apply(this, arguments);
}

app.Layouts.ChapterLayout.prototype = extend(Layout, {
  categorize: function(d, cll) {
    var chapter = cll.findChapter(d);
    return {
      mainIndex: chapter[0],
      subIndex: chapter[1]
    };
  }
});

function calculateCategoricalCoords(nodes, cll, layout) {
  var yMap = {},
    xMap = {},
    cMap = {},
    y = 0,
    index = d3.nest()
    .key(function(d) { return zeroFill(layout.categorize(d, cll).mainIndex, 2); })
    .sortKeys(d3.ascending)
    .key(function(d) { return zeroFill(layout.categorize(d, cll).subIndex, 2); })
    .sortKeys(d3.ascending)
    .sortValues(function(a, b) { return d3.ascending(a.word, b.word); })
    .entries(nodes);

  index.forEach(function(maingroup) {
    maingroup.values.forEach(function(subgroup) {
      subgroup.height = Math.ceil(subgroup.values.length / app.C.colSize);
      subgroup.y = y;

      var key = [parseInt(maingroup.key, 10), parseInt(subgroup.key, 10)];
      yMap[key] = subgroup.y;
      subgroup.values.forEach(function(entry, i) {
        xMap[entry.word] = i;
        cMap[entry.word] = key;
      });
      y = y + subgroup.height;
    });
    y += 1;
  });
  return {xMap: xMap, yMap: yMap, cMap: cMap, yMax: y};
}

/* private funcs */
function updateXY(d, x, y) {
  if (typeof(x) !== 'undefined')
    d.x = x;
  if (typeof(y) !== 'undefined')
    d.y = y;

  return d;
}

})(app);
