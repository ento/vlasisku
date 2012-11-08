window.app = window.app || {}
app.helper = app.helper || {}

app.helper.startsWith = (hay, needle) ->
    hay.slice(0, needle.length) is needle

app.helper.zeroFill = (number, width) ->
  width -= number.toString().length
  return new Array(width + ((if /\./.test(number) then 2 else 1))).join("0") + number  if width > 0
  number + "" # always return a string

app.helper.slugify = (word) ->
  word.replace "'", "h"

app.helper.numericAscending = (a, b) ->
  d3.ascending parseFloat(a), parseFloat(b)

app.helper.numericDescending = (a, b) ->
  -app.helper.numericAscending(a, b)

app.helper.scrollTopTween = (scrollTop) ->
  ->
    $this = $(this)
    i = d3.interpolateNumber($this.scrollTop(), scrollTop)
    (t) ->
      $this.scrollTop i(t)

app.helper.scrollLeftTween = (scrollTop) ->
  ->
    $this = $(this)
    i = d3.interpolateNumber($this.scrollLeft(), scrollTop)
    (t) ->
      $this.scrollLeft i(t)
