window.app = window.app || {}
app.facets = {}

class app.facets.CLLIndex
  constructor: (cll) ->
    @cll = cll
    @gcIndex = @calculateGrammarclassChapterIndex()

app.facets.CLLIndex:: =
  findChapter: (entry) ->
    unknown = [99, 0]
    return unknown  unless entry.grammarclass
    return unknown  if entry.type is 'experimental cmavo'

    gc = entry.grammarclass
    variants = [gc, gc.replace(/\*|\d$/g, ""), gc.replace(/\*|\d$|\d[a-z]/g, "")]
    keys = variants.filter((v) ->
      @cll[v]
    , this)
    return unknown  unless keys.length
    @cll[keys[0]][0]

  calculateGrammarclassChapterIndex: ->
    chapterGcs = {}
    seenGcs = {}
    for gc of @cll
      chapters = @cll[gc]
      section = chapters[0][1]
      chapter = chapters[0][0]
      chapterGcs[chapter] = []  unless chapterGcs[chapter]
      chapterGcs[chapter].push [section, gc]
    rv = {}
    max = 0
    for chapter of chapterGcs
      v = chapterGcs[chapter]
      v.sort()
      v.forEach (pair, i) ->
        gc = pair[1]
        rv[gc] = i
        max = Math.max(max, i)

    rv.maxIndex = max
    rv

class app.facets.SpatialIndex
  constructor: () ->
    @rt = new RTree()

app.facets.SpatialIndex:: =
  getBounds: ->
    @rt.get_tree()

  rebuildIndex: (nodes) ->
    @rt = new RTree()
    nodes.forEach ((n) ->
      @rt.insert
        x: n.x
        y: n.y
        w: app.C.entryWidth
        h: app.C.entryHeight
      , n
    ), this

  drilldown: (referencePoint, specs) ->
    for i of specs
      found = @drilldownEach(referencePoint, specs[i][0], specs[i][1])
      return found  if found
    null

  drilldownEach: (referencePoint, area, drilldowns) ->
    bounds = @rt.get_tree()
    nodes = @rt.search(@areaCodes[area](referencePoint, bounds))
    _.range(drilldowns.length).forEach (i) ->
      nodes = @drilldownCodes[drilldowns.charAt(i)](d3.nest()).entries(nodes)[0].values  if nodes.length
    , @

    nodes[0]

  areaCodes:

    # left row
    lr: (p, bounds) ->
      x: bounds.x
      y: p.y + 1
      w: p.x - bounds.x - 1
      h: app.C.entryHeight - 2


    # left
    l: (p, bounds) ->
      x: bounds.x
      y: bounds.y
      w: p.x - 1 - bounds.x
      h: bounds.h


    # top column
    tc: (p, bounds) ->
      x: p.x + 1
      y: bounds.y
      w: app.C.entryWidth - 2
      h: p.y - 1 - bounds.y


    # top
    t: (p, bounds) ->
      x: bounds.x
      y: bounds.y
      w: bounds.w
      h: p.y - 1 - bounds.y


    # right row
    rr: (p, bounds) ->
      x: p.x + app.C.entryWidth + 1
      y: p.y + 1
      w: bounds.x + bounds.w - p.x - app.C.entryWidth - 1
      h: app.C.entryHeight - 2


    # right
    r: (p, bounds) ->
      x: p.x + app.C.entryWidth + 1
      y: bounds.y
      w: bounds.x + bounds.w - (p.x + app.C.entryWidth + 1)
      h: bounds.h


    # bottom column
    bc: (p, bounds) ->
      x: p.x + 1
      y: p.y + app.C.entryHeight + 1
      w: app.C.entryWidth - 2
      h: bounds.y + bounds.h - (p.y + app.C.entryHeight + 1)


    # bottom
    b: (p, bounds) ->
      x: bounds.x
      y: p.y + app.C.entryHeight + 1
      w: bounds.w
      h: bounds.h - (p.y + app.C.entryHeight + 1 - bounds.y)

  drilldownCodes:
    l: (index) ->
      index.key((d) ->
        d.x
      ).sortKeys app.helper.numericAscending

    t: (index) ->
      index.key((d) ->
        d.y
      ).sortKeys app.helper.numericAscending

    r: (index) ->
      index.key((d) ->
        d.x
      ).sortKeys app.helper.numericDescending

    b: (index) ->
      index.key((d) ->
        d.y
      ).sortKeys app.helper.numericDescending
