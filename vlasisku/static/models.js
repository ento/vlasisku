(function(app) {
app.Models = {};

app.Models.makeNodes = function(nodes) {
  _.extend(nodes, Nodes);
  return nodes;
};

var Nodes = {
  focus: function(target) {
    var targetDatum;
    this.forEach(function(d) {
      d.confusable = isConfusable(target, d.word);
      if (d.word === target)
        targetDatum = d;
    });
    return targetDatum;
  },

  search: function(q) {
    var candidates = [];
    this.forEach(function(d) {
      if (q && q.length && d.word.startsWith(q)) {
        d.searchHit = [q, d.word.slice(q.length)];
        candidates.push(d);
      } else {
        d.searchHit = null;
      }
    });
    return candidates;
  },

  d3select: function(d) {
    var word = d.word ? d.word : d;
    return d3.select('#' + slugify(word));
  }
};

})(app);
