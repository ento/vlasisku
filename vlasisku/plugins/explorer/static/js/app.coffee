class Serializer
  constructor: ->
    @_top = null
    @_ops = []
    @routeChanged = new signals.Signal

  state: (tree) ->
    @_top = new @Op(tree)
    @_ops.push @_top
    this

  data: (name) ->
    throw "Data of which state? Call Serializer.state() first."  unless @_top
    @_top._datas.push name
    this

  Op: (tree) ->
    @tree = tree
    @_datas = []
    @

  asRoute: (sc) ->
    @_serialize sc

  asRoutePattern: ->
    new RegExp(@_serialize(null,
      key: (key) ->
        "(" + key + "/"

      value: (key, value) ->
        "([^/]*)/?)?"

      sep: ""
    ))

  normalizeParams: (req, vals) ->
    [_.map(_.range(1, vals.vals_.length, 2), (i) ->
      vals[i]
    )]

  unserialize: (sc, params) ->
    self = this
    states = {}
    initStates = {}
    initDatas = []
    @_walk (i, type, stateKey, dataKey) ->
      value = params[i]
      return  unless value
      currentStates = sc.currentState(stateKey)
      if type is "state"
        states[stateKey] = value
        if not currentStates or not currentStates.length
          initStates[stateKey] = value
        else
          sc.sendEvent "changeLayout", value  if stateKey is "layout"
      else if type is "data"
        if not currentStates or not currentStates.length
          initDatas.push [stateKey, states[stateKey], dataKey, value]
        else
          currentStates[0].setData dataKey, value

    initDatas.forEach (each) ->
      sc.getState(each[1], each[0]).setData each[2], each[3]

    if d3.keys(initStates).length
      self.routeChanged.active = false
      sc.initStates initStates
      self.routeChanged.active = true

  _nullState: [
    name: null
    getData: ->
      null
  ]

  _serialize: (sc, transformers) ->
    self = this
    parts = []
    transformers = {}  unless transformers
    unless transformers.key
      transformers.key = (key) ->
        key
    unless transformers.value
      transformers.value = (key, value) ->
        value
    transformers.sep = "/"  if typeof (transformers.sep) is "undefined"
    @_walk (i, type, stateKey, dataKey) ->
      states = (if sc then sc.currentState(stateKey) else self._nullState)
      return  if not states or not states.length
      state = states[0]
      if type is "state"
        parts.push transformers.key(stateKey), transformers.value(stateKey, state.name)
      else parts.push transformers.key(dataKey), transformers.value(dataKey, state.getData(dataKey) or "")  if type is "data"

    parts.join transformers.sep

  _walk: (callback) ->
    i = 0
    @_ops.forEach ((op) ->
      callback i, "state", op.tree
      i += 1
      op._datas.forEach (name) ->
        callback i, "data", op.tree, name
        i += 1

    ), this

class App
  constructor: () ->
    @serializer = new Serializer()
    @serializer
      .state("layout")
      .state("search")
      .data("target")
      .state("focus")
      .data("target")
      .state("inspector")
      .data("target")

    @layoutChanged = new signals.Signal
    @panChanged = new signals.Signal
    @inspectorTargetChanged = new signals.Signal
    @searchResultChanged = new signals.Signal
    @searchQueryChanged = new signals.Signal

App:: =
  C:
    colSize: 15
    entryWidth: 54
    entryHeight: 20
    entryPadding: 0.2
    inspectorHeight: 50
    contentMargin: 10

  init: (root) ->
    @initializeRouting()
    initStates = {}
    initStates[@globalStates.app] = 'initializing'
    @statechart.initStates initStates

    @field = new app.models.Field
      nodes: root.cmavo.concat(root["experimental cmavo"])
      cll: new app.facets.CLLIndex(root.cll)
      spatial: new app.facets.SpatialIndex()

    # Precompute the orders.
    @layouts =
      alphabet: new app.layouts.ABCLayout(@field)
      chapter: new app.layouts.ChapterLayout(@field)
      length: new app.layouts.LengthLayout(@field)

    @nodesView = new app.views.NodesView
      el: $("#main")
      model: @field
    @inspectorView = new app.views.InspectorView
      el: $("#inspector")
    @searchView = new app.views.SearchView
      el: $("#search-box")
    @layoutView = new app.views.LayoutView
      el: $("#layout")
      model: @field

  initializeRouting: ->
    #setup hasher
    parseHash = (newHash, oldHash) ->
      crossroads.parse newHash
    self = this
    @serializer.routeChanged.add ->
      self.setHashSilently self.serializer.asRoute(self.statechart)

    #setup crossroads
    crossroads.normalizeFn = @serializer.normalizeParams
    crossroads.addRoute @serializer.asRoutePattern(), (params) ->
      self.serializer.unserialize self.statechart, params

    hasher.initialized.add parseHash #parse initial hash
    hasher.changed.add parseHash #parse hash changes

  isFocused: ->
    @getCurrentStateName(@globalStates.focus) is "focused"

  isRunning: ->
    @getCurrentStateName(@globalStates.app) is "running"

  run: (defaultHash) ->
    hasher.init() #start listening for history change
    hasher.setHash defaultHash  unless hasher.getHash().length

    @sendEvent "initialized"

    if @getCurrentStateName(@globalStates.inspector) is "notInspecting"
      @sendEvent "inspect", @field.getAnyNode()
    else
      @nodesView.revealInspectorTarget()

  getCurrentLayout: ->
    @layouts[@getCurrentLayoutName()]

  getCurrentLayoutName: ->
    @getCurrentState(@globalStates.layout).name

  getCurrentState: (globalState) ->
    states = @statechart.currentState globalState
    return states[0] if states and states.length
    return null

  getCurrentStateName: (globalState) ->
    state = @getCurrentState globalState
    return state.name if state
    return null

  getInspectorTarget: ->
    inspected = @statechart.getState("inspecting", @globalStates.inspector).getData("target")
    return @field.getNode inspected

  getViewport: ->
    x: -@nodesView.camera.pan.x
    y: -@nodesView.camera.pan.y
    width: @nodesView.$el.width()
    height: @nodesView.$el.height()

  sendEvent: ->
    @statechart.sendEvent.apply @statechart, arguments

  setHashSilently: (hash) ->
    hasher.changed.active = false #disable changed signal
    hasher.setHash hash #set hash without dispatching changed signal
    hasher.changed.active = true #re-enable signal

window.app = new App()
