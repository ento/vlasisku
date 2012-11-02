(function(app) {
var globalStates = ['layout', 'inspector', 'focus', 'search'];
globalStates.forEach(function(state) { globalStates[state] = state; });
// TODO
app.globalStates = globalStates;

var statechart = Stativus.createStatechart();

/* layout */

var layoutState = {
  globalConcurrentState: globalStates.layout,
  enterState: function() {
    var layoutName = this.statechart.currentState(globalStates.layout)[0].name;
    app.nodesWidget.updateMainView(layoutName);
    app.layoutWidget.updateActiveButton(layoutName);
    app.serializer.routeChanged.dispatch();
  },
  changeLayout: function(name) {
    this.goToState(name);
  },
  panChanged: function() {
    app.nodesWidget.updateCanvasPan();
  }
};

statechart.addState('alphabet', layoutState);
statechart.addState('length', layoutState);
statechart.addState('chapter', layoutState);

/* inspector */

var inspectorState = {
  globalConcurrentState: globalStates.inspector,
  inspect: function(target, reveal) {
    var inspectingState = this.statechart.getState("inspecting", this.globalConcurrentState);
    inspectingState.setData('target', target.word ? target.word : target);
    inspectingState.setData('reveal', reveal);

    if (this.name === 'inspecting')
      this.goToState('reInspecting');
    else
      this.goToState('inspecting');
  },
  unInspect: function() {
    this.statechart.getState("inspecting", this.globalConcurrentState).setData('target', null);
    this.goToState('notInspecting');
  }
};

statechart.addState('inspecting', {
  enterState: function() {
    var target = this.getData('target');

    if (!target)
      throw 'Inconsistent state';

    var d = app.nodes.d3select(target).datum();
    app.inspectorWidget.updateInspector(d.word);
    app.nodesWidget.updateCursor(d);
    if (this.getData('reveal'))
      app.nodesWidget.cameraWidget.panToShow(d);
    app.searchWidget.updateCandidateSelection(d.word);
    app.serializer.routeChanged.dispatch();
  }
}, inspectorState);

statechart.addState('reInspecting', {
  enterState: function() {
    this.goToState('inspecting');
  }
}, inspectorState);

statechart.addState('notInspecting', inspectorState);

/* focus */

var focusState = {
  globalConcurrentState: globalStates.focus,
  focus: function(target) {
    this.statechart.getState("focused", this.globalConcurrentState).setData('target', target);
    if (this.name === 'focused')
      this.goToState('reFocusing');
    else
      this.goToState('focused');
  },
  blur: function() {
    this.statechart.getState("focused", this.globalConcurrentState).setData('target', null);
    this.goToState('notFocused');
  }
};

statechart.addState('focused', {
  enterState: function() {
    var d = app.nodes.focus(this.getData('target'));
    app.nodesWidget.updateMainView(null, {panToShow: d});
    app.serializer.routeChanged.dispatch();
  }
}, focusState);

statechart.addState('reFocusing', {
  enterState: function() {
    this.goToState('focused');
  }
}, focusState);

statechart.addState('notFocused', {
  enterState: function() {
    app.nodes.focus(null);
    if (!self._transitionLock)
      app.nodesWidget.updateMainView();
    app.serializer.routeChanged.dispatch();
  }
}, focusState);

/* search */

var searchState = {
  globalConcurrentState: globalStates.search,
  search: function(target) {
    this.statechart.getState("searching", this.globalConcurrentState).setData('target', target);
    if (this.name === 'searching')
      this.goToState('reSearching');
    else
      this.goToState('searching');
  },
  clearSearch: function() {
    this.goToState('notSearhcing');
  }
};

statechart.addState('searching', {
  enterState: function() {
    var target= this.getData('target'),
      candidates = app.nodes.search(target),
      inspected = this.statechart.getState('inspecting', app.globalStates.inspector).getData('target');
    app.nodesWidget.highlightSearchHits();
    app.searchWidget.updateSearchCandidates(candidates);
    app.searchWidget.updateCandidateSelection(inspected);
    app.searchWidget.inspectAnyCandidate();

    app.serializer.routeChanged.dispatch();
  }
}, searchState);

statechart.addState('reSearching', {
  enterState: function() {
    this.goToState('searching');
  }
}, searchState);

statechart.addState('notSearching', {
  enterState: function() {
    this.statechart.getState('searching', this.globalConcurrentState).setData('target', null);
  }
}, searchState);

app.statechart = statechart;

})(app);
