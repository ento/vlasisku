function numericAscending(a, b) {
  return d3.ascending(parseFloat(a), parseFloat(b));
}

function numericDescending(a, b) {
  return -numericAscending(a, b);
}

function scrollTopTween(scrollTop) {
  return function() {
    var $this = $(this),
      i = d3.interpolateNumber($this.scrollTop(), scrollTop);
    return function(t) { $this.scrollTop(i(t)); };
  };
}

function scrollLeftTween(scrollTop) {
  return function() {
    var $this = $(this),
      i = d3.interpolateNumber($this.scrollLeft(), scrollTop);
    return function(t) { $this.scrollLeft(i(t)); };
  };
}
