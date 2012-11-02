(function(app) {

app.Facets = {};

app.Facets.CLLIndex = function(cll) {
  this.cll = cll;
  this.gcIndex = this.calculateGrammarclassChapterIndex();
}
app.Facets.CLLIndex.prototype = {
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

app.Facets.SpatialIndex = function() {
  this.rt = new RTree();
}
app.Facets.SpatialIndex.prototype = {
  getBounds: function() {
    return this.rt.get_tree();
  },

  rebuildIndex: function(nodes) {
    this.rt = new RTree();
    nodes.forEach(function(n) {
      this.rt.insert({x: n.x, y: n.y, w: app.C.entryWidth, h: app.C.entryHeight}, n);
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
    lr: function(p, bounds) { return {x: bounds.x, y: p.y + 1, w: p.x - bounds.x - 1, h: app.C.entryHeight - 2}; },

    // left
    l: function(p, bounds) { return {x: bounds.x, y: bounds.y, w: p.x - 1 - bounds.x, h: bounds.h}; },

    // top column
    tc: function(p, bounds) { return {x: p.x + 1, y: bounds.y, w: app.C.entryWidth - 2, h: p.y - 1 - bounds.y}; },
 
    // top
    t: function(p, bounds) { return {x: bounds.x, y: bounds.y, w: bounds.w, h: p.y - 1 - bounds.y}; },

    // right row
    rr: function(p, bounds) { return {x: p.x + app.C.entryWidth + 1, y: p.y + 1, w: bounds.x + bounds.w - p.x - app.C.entryWidth - 1, h: app.C.entryHeight - 2}; },

    // right
    r: function(p, bounds) { return {x: p.x + app.C.entryWidth + 1, y: bounds.y, w: bounds.x + bounds.w - (p.x + app.C.entryWidth + 1), h: bounds.h}; },

    // bottom column
    bc: function(p, bounds) { return {x: p.x + 1, y: p.y + app.C.entryHeight + 1, w: app.C.entryWidth - 2, h: bounds.y + bounds.h - (p.y + app.C.entryHeight + 1)}; },

    // bottom
    b: function(p, bounds) { return {x: bounds.x, y: p.y + app.C.entryHeight + 1, w: bounds.w, h: bounds.h - (p.y + app.C.entryHeight + 1 - bounds.y)}; }
  },

  drilldownCodes: {
    l: function(index) { return index.key(function(d) { return d.x; }).sortKeys(numericAscending); },
    t: function(index) { return index.key(function(d) { return d.y; }).sortKeys(numericAscending); },
    r: function(index) { return index.key(function(d) { return d.x; }).sortKeys(numericDescending); },
    b: function(index) { return index.key(function(d) { return d.y; }).sortKeys(numericDescending); }
  }
};


})(app);
