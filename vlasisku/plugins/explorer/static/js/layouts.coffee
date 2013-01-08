window.app = window.app || {}
app.layouts = {}

class Layout
  constructor: (field) ->
    @coords = calculateCategoricalCoords(field.get('nodes'), field.get('cll'), this)
    @scales =
      x: d3.scale.linear().domain([0, app.C.colSize]).range([0, app.C.colSize * app.C.entryWidth])
      y: d3.scale.linear().domain([0, @coords.yMax]).range([0, @coords.yMax * app.C.entryHeight])

  letters: "abcdefgijklmnoprstuvxyz"
  applyBaseLayout: (nodes) ->
    nodes.forEach ((d) ->
      updateXY d, @x(d), @y(d)
    ), this

  categorize: ->
    throw "Not implemented"

  x: (d) ->
    @scales.x @coords.xMap[d.word] % app.C.colSize

  y: (d) ->
    cat = @coords.cMap[d.word]
    @scales.y(@coords.yMap[cat]) + Math.floor(@coords.xMap[d.word] / app.C.colSize) * app.C.entryHeight

  applyFocusLayout: (nodes, focusWord) ->
    rows =
      t: []
      r: []
      b: []
      l: []
      identical: []

    nodes.forEach (d, i) ->
      return  unless d.confusable
      each = d.word
      conf = d.confusable
      type = conf.type + ((if typeof conf.index is "number" then "-" + conf.index else ""))
      row = undefined
      if type is "yhy" or type is "singleletter-1"
        row = rows.t
      else if type is "singleletter-2" or type is "singleletter-3"
        row = rows.b
      else if type is "singleletter-0"
        row = (if (each < focusWord) then rows.l else rows.r)
      else row = rows.identical  if type is "identical"
      row.push d

    focus = rows.identical[0]
    if focus
      bounds =
        x: @x(focus)
        y: @y(focus)
        width: app.C.entryWidth
        height: app.C.entryHeight

      for direction of rows
        continue  if direction is "identical"
        row = rows[direction]
        plots = @layoutFocusRow(focus, direction, row)
        _.each plots, (pos) ->
          bounds = app.Rect.unionOfPoint bounds, pos

    nodes.forEach ((d) ->
      return  if d.confusable
      rect =
        x: @x(d)
        y: @y(d)
        width: app.C.entryWidth
        height: app.C.entryHeight

      if not focus or not app.Rect.contains(bounds, rect)
        updateXY d, rect.x, rect.y
        return
      run = app.Rect.evade(rect, bounds)
      evaded = app.Rect.move(rect,
        x: run.x * 1.5
        y: run.y * 1.5
      )
      updateXY d, evaded.x, evaded.y
    ), this

  directionMap:
    t:
      x: 0
      y: -1

    l:
      x: -1
      y: 0

    b:
      x: 0
      y: 1

    r:
      x: 1
      y: 0

  layoutFocusRow: (center, direction, row) ->
    row.sort (a, b) ->
      a.word.localeCompare b.word

    reverse = direction is "l" or direction is "t"
    plots = []
    _.range(row.length).forEach ((i) ->
      each = (if reverse then row[row.length - i - 1] else row[i])
      pos = @layoutFocusEntry(center, direction, each, i)
      if pos
        plots.push pos,
          x: pos.x + app.C.entryWidth
          y: pos.y + app.C.entryHeight

    ), this
    plots

  layoutFocusEntry: (center, direction, d, distance) ->
    uv = @directionMap[direction]
    return null  unless uv
    x = center.x + app.C.entryWidth * uv.x * (distance + 1)
    y = center.y + app.C.entryHeight * uv.y * (distance + 1)
    updateXY d, x, y
    d

# model -> view
calculateCategoricalCoords = (nodes, cll, layout) ->
  yMap = {}
  xMap = {}
  cMap = {}
  y = 0
  index = d3.nest().key((d) ->
    app.helper.zeroFill layout.categorize(d, cll).mainIndex, 2
  ).sortKeys(d3.ascending).key((d) ->
    app.helper.zeroFill layout.categorize(d, cll).subIndex, 2
  ).sortKeys(d3.ascending).sortValues((a, b) ->
    d3.ascending a.word, b.word
  ).entries(nodes)
  index.forEach (maingroup) ->
    maingroup.values.forEach (subgroup) ->
      subgroup.height = Math.ceil(subgroup.values.length / app.C.colSize)
      subgroup.y = y
      key = [parseInt(maingroup.key, 10), parseInt(subgroup.key, 10)]
      yMap[key] = subgroup.y
      subgroup.values.forEach (entry, i) ->
        xMap[entry.word] = i
        cMap[entry.word] = key

      y = y + subgroup.height

    y += 1

  xMap: xMap
  yMap: yMap
  cMap: cMap
  yMax: y

# private funcs
updateXY = (d, x, y) ->
  d.x = x  if typeof (x) isnt "undefined"
  d.y = y  if typeof (y) isnt "undefined"
  d

class app.layouts.ABCLayout extends Layout

app.layouts.ABCLayout::categorize = (d) ->
    mainIndex: @letters.indexOf(d.word[0])
    subIndex: d.word.length - 1

class app.layouts.LengthLayout extends Layout

app.layouts.LengthLayout::categorize = (d) ->
    yhy = d.word.match(/\'/g) or []
    mainIndex: d.word.length * 2 - yhy.length
    subIndex: @letters.indexOf(d.word[0])

class app.layouts.ChapterLayout extends Layout

app.layouts.ChapterLayout::categorize = (d, cll) ->
    chapter = cll.findChapter(d)
    mainIndex: chapter[0]
    subIndex: cll.gcIndex[d.grammarclass] or 0
