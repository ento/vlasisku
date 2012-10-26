function numericAscending(a, b) {
  return d3.ascending(parseFloat(a), parseFloat(b));
}

function numericDescending(a, b) {
  return -numericAscending(a, b);
}
