window.app = window.app || {}

globalStates = ["layout", "inspector", "focus", "search", "app"]
globalStates.forEach (state) ->
  globalStates[state] = state

app.globalStates = globalStates
app.statechart = statechart = Stativus.createStatechart()

# layout
layoutState =
  globalConcurrentState: globalStates.layout
  enterState: ->
    app.layoutChanged.dispatch()
    app.serializer.routeChanged.dispatch()

  changeLayout: (name) ->
    @goToState name

  panChanged: ->
    app.panChanged.dispatch()

statechart.addState "alphabet", layoutState
statechart.addState "length", layoutState
statechart.addState "chapter", layoutState

# inspector
inspectorState =
  globalConcurrentState: globalStates.inspector
  inspect: (target, reveal) ->
    inspectingState = @statechart.getState("inspecting", @globalConcurrentState)
    inspectingState.setData "target", (if target.word then target.word else target)
    inspectingState.setData "reveal", reveal
    if @name is "inspecting"
      @goToState "reInspecting"
    else
      @goToState "inspecting"

  unInspect: ->
    @statechart.getState("inspecting", @globalConcurrentState).setData "target", null
    @goToState "notInspecting"

statechart.addState "inspecting",
  enterState: ->
    target = @getData("target")
    reveal = @getData("reveal")
    throw "Inconsistent state"  unless target

    d = app.field.getNode target
    app.inspectorTargetChanged.dispatch d,
      reveal: reveal
      animate: if app.isRunning() then false else true
    app.serializer.routeChanged.dispatch()
, inspectorState

statechart.addState "reInspecting",
  enterState: ->
    @goToState "inspecting"
, inspectorState

statechart.addState "notInspecting", inspectorState

# focus
focusState =
  globalConcurrentState: globalStates.focus
  focus: (target) ->
    @statechart.getState("focused", @globalConcurrentState).setData "target", target
    if @name is "focused"
      @goToState "reFocusing"
    else
      @goToState "focused"

  blur: ->
    @statechart.getState("focused", @globalConcurrentState).setData "target", null
    @goToState "notFocused"

statechart.addState "focused",
  enterState: ->
    d = app.field.focus @getData "target"
    app.layoutChanged.dispatch
      panToShow: d

    app.serializer.routeChanged.dispatch()
, focusState

statechart.addState "reFocusing",
  enterState: ->
    @goToState "focused"
, focusState

statechart.addState "notFocused",
  enterState: ->
    app.field.focus null
    app.layoutChanged.dispatch()
    app.serializer.routeChanged.dispatch()
, focusState

# search
searchState =
  globalConcurrentState: globalStates.search
  search: (target) ->
    @statechart.getState("searching", @globalConcurrentState).setData "target", target
    if @name is "searching"
      @goToState "reSearching"
    else
      @goToState "searching"

  clearSearch: ->
    @goToState "notSearhcing"

statechart.addState "searching",
  enterState: ->
    target = @getData("target")
    app.searchQueryChanged.dispatch target

    results = app.field.search(target)
    app.searchResultChanged.dispatch results

    app.serializer.routeChanged.dispatch()
, searchState

statechart.addState "reSearching",
  enterState: ->
    @goToState "searching"
, searchState

statechart.addState "notSearching",
  enterState: ->
    @statechart.getState("searching", @globalConcurrentState).setData "target", null
, searchState

# app

appState =
  globalConcurrentState: globalStates.app

statechart.addState "initializing",
  initialized: ->
    @goToState "running"
, appState

statechart.addState "running", appState