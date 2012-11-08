window.app = window.app || {}
app.views = {}
app.views.helper = {}

app.views.helper.getTransformation = (d) ->
  "translate(" + d.x + "," + d.y + ")"

app.views.NodesView = Backbone.View.extend
  initialize: () ->
    @initializeNodes()
    @camera = new app.views.Camera

    app.layoutChanged.add _.bind @updateMainView, @
    app.panChanged.add _.bind @updateCanvasPan, @
    app.inspectorTargetChanged.add _.bind @updateCursor, @
    app.searchResultChanged.add _.bind @highlightSearchHits, @

    Mousetrap
      .bind("h", _.bind @inspectLeft, @)
      .bind("j", _.bind @inspectDown, @)
      .bind("k", _.bind @inspectUp, @)
      .bind("l", _.bind @inspectRight, @)
      .bind "esc", ->
        app.sendEvent "blur"

  initializeNodes: ->
    @svg = d3.select(@el)
      .append("svg")
      .attr("id", "canvas")
      .append("g")
      .attr("id", "content")
      .attr("transform", "translate(10, 10)")
    @svg.append("g")
      .attr("id", "cursor")
      .attr("transform", "translate(0,-10000)")
      .append("rect")
      .attr("width", app.C.entryWidth)
      .attr("height", app.C.entryHeight)
      .attr "transform", "translate(0,-3)"
    @svg.append("g")
      .attr("id", "backdrop")
      .append("rect")
      .attr("width", 1000)
      .attr "height", 1000

    entries = @svg.selectAll(".entry")
      .data(@model.get('nodes'))
      .enter()
      .append("g")
      .attr("class", "entry")
      .attr("id", (d) ->
        app.helper.slugify d.word
      )
      .attr("transform", "translate(0,-10000)")

    crestWidth = 5
    fontHeight = 11
    crestGap = fontHeight - crestWidth * 2

    mainColorScale = d3.scale.category20b().domain(d3.range(20))
    subColorScale = d3.scale.category10().domain(d3.range(@model.get('cll').gcIndex.maxIndex))
    model = @model

    entries
      .append("rect")
      .attr("width", crestWidth)
      .attr("height", crestWidth)
      .attr "fill", (d) ->
        mainColorScale model.get('cll').findChapter(d)[0]

    entries
      .append("rect")
      .attr("width", crestWidth)
      .attr("height", crestWidth)
      .attr("transform", "translate(0," + (crestWidth + crestGap) + ")")
      .attr "fill", (d) ->
        subColorScale model.get('cll').gcIndex[d.grammarclass]

    entries
      .append("text")
      .attr("x", crestWidth + 1)
      .attr("y", 0)
      .attr("width", app.C.entryWidth)
      .attr("height", app.C.entryHeight * (1.0 - app.C.entryPadding))
      .attr("text-anchor", "start")
      .on("mouseover", @mouseover)
      .text (d) ->
        d.word

  events:
    "click #canvas .entry text, #canvas .entry rect": (e) ->
      app.sendEvent "focus", d3.select(e.target).datum().word
      false

    "click #canvas, #backdrop": ->
      app.sendEvent "blur"

  revealInspectorTarget: ->
    @camera.panToShow app.getInspectorTarget()

  inspectLeft: ->
    @_inspectByDrilldownCode [["lr", "r"], ["t", "br"]]

  inspectRight: ->
    @_inspectByDrilldownCode [["rr", "l"], ["b", "tl"]]

  inspectUp: ->
    @_inspectByDrilldownCode [["tc", "b"]]

  inspectDown: ->
    @_inspectByDrilldownCode [["bc", "t"]]

  _inspectByDrilldownCode: (codes) ->
    target = @model.drilldown @cursor, codes
    app.sendEvent "inspect", target  if target

  mouseover: ->
    app.sendEvent "inspect", d3.select(this).datum()

  updateCanvasSize: ->
    bounds = @model.getNodeBounds()
    canvasWidth = bounds.w
    canvasHeight = bounds.h + app.C.inspectorHeight

    d3.select("#canvas")
      .transition()
      .duration(1000)
      .attr("width", canvasWidth)
      .attr("height", canvasHeight)

    d3.select("#backdrop rect")
      .transition()
      .duration(1000)
      .attr("width", canvasWidth)
      .attr("height", canvasHeight)

  updateCanvasPan: ->
    d3.select(@el)
      .transition()
      .duration(1000)
      .tween("scrollLeft", app.helper.scrollLeftTween -@camera.pan.x)
      .tween "scrollTop", app.helper.scrollTopTween -@camera.pan.y

  updateMainView: (options) ->
    layout = app.getCurrentLayout()
    options = _.extend(
      panToShow: false
    , options)

    # TODO
    layout.applyBaseLayout app.field.get('nodes')
    focus = app.statechart.getState("focused", app.globalStates.focus).getData("target")
    layout.applyFocusLayout app.field.get('nodes'), focus

    @svg.transition().duration(1000).selectAll(".entry").delay((d, i) ->
      layout.coords.xMap[d.word] * 4
    ).attr "transform", app.views.helper.getTransformation

    # move backdrop to the very end
    $("#backdrop").appendTo "#content"
    # place focused entries on top of the backdrop
    @layoutFocus focus

    @updateCursor null
      animate: true

    app.field.rebuildIndex()
    @updateCanvasSize()

    if options.panToShow
      @camera.panToShow options.panToShow
    else
      @updateCanvasPan()

  resetFocus: ->
    d3.select(".focus-center").classed "focus-center", false
    d3.selectAll(".entry.focus").classed "focus", false

  layoutFocus: (focus) ->
    @resetFocus()
    unless focus
      d3.select("#backdrop").attr "class", ""
      @svg.classed "focused", false
      return
    else
      d3.select("#backdrop").attr "class", "in"
      @svg.classed "focused", true

    d3.selectAll(".entry").each (d, i) ->
      conf = d.confusable
      return  unless conf
      selection = d3.select(this)
      selection.classed("focus", true).classed conf.type, true
      selection.classed "focus-center", true  if conf.type is "identical"
      $(this).insertAfter "#backdrop"

  updateCursor: (target, options) ->
    hovered = d3.select(".entry.hover")
    hoveredNode = if hovered.empty() then null else hovered.datum()
    @cursor = target  if target

    updateHoverState = not (hoveredNode and @cursor and hoveredNode.word == @cursor.word)

    hovered.classed "hover", false  if updateHoverState
    if @cursor
      updateHover = ->
      updateHover = _.bind(->
        d3.select("#" + app.helper.slugify(@cursor.word)).classed "hover", true
      , @) if updateHoverState
      t = d3.select("#cursor")
      t = t.transition().duration(1000) if options.animate
      t.attr "transform", app.views.helper.getTransformation(@cursor)

      if options.animate
        t.each "end", updateHover
      else
        updateHover()

    @revealInspectorTarget()  if options.reveal

  highlightSearchHits: ->
    d3.selectAll(".entry").each (d) ->
      textElem = d3.select(this).select("text")
      if d.searchHit
        textElem.text ""
        textElem.append("tspan").attr("class", "highlight").text d.searchHit[0]
        textElem.append("tspan").text d.searchHit[1]
      else
        textElem.text d.word


app.views.InspectorView = Backbone.View.extend
  initialize: ->
    app.inspectorTargetChanged.add _.bind @render, @

  render: (d) ->
    unless d
      @$el.html ""
      return

    hasDefinition = if d.textdefinition then true else false
    # TODO: textdefinition can be too long to fit
    text = [
      '<span class="word">',
      d.word,
      '</span><span class="grammarclass">',
      d.grammarclass,
      '</span><span class="description">',
      (if hasDefinition then d.textdefinition else "Failed to load description"),
      "</span>"]

    classOp = if hasDefinition then "removeClass" else "addClass"
    @$el[classOp]("error").html text.join(" ")


app.views.SearchView = Backbone.View.extend
  initialize: ->
    app.inspectorTargetChanged.add _.bind @updateResultSelection, @
    app.searchResultChanged.add _.bind @updateSearchResult, @
    app.searchQueryChanged.add _.bind @updateSearchQuery, @

    Mousetrap.bind "/", @focusSearchBox

  events:
    "click #search-next, #search-prev": (e) ->
      e.preventDefault()
      $cur = $("#results .selected")
      selectNext = $(e.target).is("#search-next")
      $next = (if selectNext then $cur.next("li") else $cur.prev("li"))
      $next = $("#results li")[(if selectNext then "first" else "last")]()  unless $next.length
      @inspectResult d3.select($next.get()[0]).datum() if $next.length

    "keyup #search-box input": _.debounce(->
      app.sendEvent "search", $("#q").val()
    , 100)

  inspectAnyResult: ->
    $("#search-next").trigger "click" unless $("#results .selected").length

  inspectResult: (d) ->
    app.sendEvent "inspect", d, true

  focusSearchBox: ->
    $("#search-box input").focus()
    false

  updateResultSelection: (d) ->
    d = d || app.getInspectorTarget()
    $("#results .selected").removeClass "selected"
    d3.selectAll("#results li").each (each) ->
      $(this).addClass "selected"  if each.word is d.word

  updateSearchResult: (results) ->
    self = this
    li = d3.select("#results").selectAll("li").data(results)
    oldSelection = d3.select "#results .selected"
    li.enter().append "li"
    li.text (d) ->
      d.word

    li.exit().remove()
    li.on "click", (d) ->
      self.inspectResult d

    @updateResultSelection()

    if app.isRunning()
      @inspectAnyResult()

  updateSearchQuery: (target) ->
    @$("#q").val target


app.views.LayoutView = Backbone.View.extend
  initialize: ->
    self = this
    app.layoutChanged.add _.bind @updateActiveButton, @
    @$el.find("button").each (i, each) ->
      $each = $(each)
      Mousetrap.bind i + 1 + "", ->
        self.layoutButtonClicked $each

      $each.on "click", ->
        self.layoutButtonClicked $each

  layoutButtonClicked: ($button) ->
    app.sendEvent "changeLayout", $button.data("value")

  updateActiveButton: (options) ->
    @$el.find(".active")
      .removeClass("active")
      .end()
      .find('[data-value="' + app.getCurrentLayoutName() + '"]')
      .button "toggle"


# TODO: not really a view
class app.views.Camera
  constructor: () ->
    @pan =
      x: 0
      y: 0

    Mousetrap
      .bind("s", @panLeft)
      .bind("d", @panDown)
      .bind("f", @panUp)
      .bind("g", @panRight)

  panLeft: ->
    @panBy -app.C.entryWidth * 0.5

  panUp: ->
    @panBy 0, -app.C.entryHeight

  panDown: ->
    @panBy 0, app.C.entryHeight

  panRight: ->
    @panBy app.C.entryWidth * 0.5

  panBy: (x, y) ->
    @pan.x += x or 0
    @pan.y += y or 0
    app.sendEvent "panChanged"

  panTo: (p) ->
    @pan.x = -p.x
    @pan.y = -p.y
    app.sendEvent "panChanged"

  panToShow: (d) ->
    viewport = app.getViewport()
    return  if app.Rect.contains(viewport,
      x: d.x
      y: d.y
      width: app.C.entryWidth
      height: app.C.entryHeight
    )
    xMargin = viewport.width * 0.1
    yMargin = viewport.height * 0.4
    viewport.right = viewport.x + viewport.width
    viewport.bottom = viewport.y + viewport.height
    dRight = d.x + app.C.entryWidth
    dBottom = d.y + app.C.entryHeight
    @pan.x = -d.x + xMargin  if d.x < viewport.x
    @pan.x = -(dRight - viewport.width) - xMargin  if viewport.right < dRight
    @pan.y = -d.y + yMargin  if d.y < viewport.y
    @pan.y = -(dBottom - viewport.height) - yMargin  if viewport.bottom < dBottom
    app.sendEvent "panChanged"