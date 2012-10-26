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

function Layout(scales, nodes, cll) {
  this.coords = calculateCoords(nodes, cll, this);
  this.scales = scales;
}

Layout.prototype = {
  letters: 'abcdefgijklmnoprstuvxyz',

  categorize: function() {
    throw 'Not implemented';
  },

  x: function(d) {
    return this.scales.x(this.coords.xMap[d.word] % C.colSize);
  },

  y: function(d) {
    var cat = this.categorize(d);
    return this.scales.y(this.coords.yMap[[cat.mainIndex, cat.subIndex]]) + Math.floor(this.coords.xMap[d.word] / C.colSize) * C.entryHeight;
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
  categorize: function(d, cll) {
    var chapter = cll.findChapter(d);
    return {
      mainIndex: chapter[0],
      subIndex: chapter[1]
    };
  }
});

function calculateCoords(nodes, cll, layout) {
  var yMap = {},
    xMap = {},
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
      subgroup.height = Math.ceil(subgroup.values.length / C.colSize);
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
