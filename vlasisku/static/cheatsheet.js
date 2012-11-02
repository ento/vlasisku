
function Serializer() {
  this._top = null;
  this._ops = [];
  this.routeChanged = new signals.Signal();
}
Serializer.prototype = {
  state: function(tree) {
    this._top = new this.Op(tree);
    this._ops.push(this._top);
    return this;
  },

  data: function(name) {
    if (!this._top)
      throw 'Data of which state? Call Serializer.state() first.';
    this._top._datas.push(name);
    return this;
  },

  Op: function(tree) {
    this.tree = tree;
    this._datas = [];
  },

  asRoute: function(sc) {
    return this._serialize(sc);
  },

  asRoutePattern: function() {
    return new RegExp(this._serialize(null, {
      key: function(key) {
        return '(' + key + '\/';
      },
      value: function(key, value) {
        return '([^/]*)\/?)?';
      },
      sep: ''}));
  },

  normalizeParams: function(req, vals) {
    return [_.map(_.range(1, vals.vals_.length, 2), function(i) {
      return vals[i];
    })];
  },

  unserialize: function(sc, params) {
    var self = this,
      states = {},
      initStates = {},
      initDatas = [];

    this._walk(function(i, type, stateKey, dataKey) {
      var value = params[i];
      if (!value)
        return;

      var currentStates = sc.currentState(stateKey);

      if (type === 'state') {
        states[stateKey] = value;
        if (!currentStates || !currentStates.length) {
          initStates[stateKey] = value;
        } else {
          // TODO
          if (stateKey === 'layout')
            sc.sendEvent('changeLayout', value);
        }
      } else if (type === 'data') {
        if (!currentStates || !currentStates.length)
          initDatas.push([stateKey, states[stateKey], dataKey, value]);
        else
          currentStates[0].setData(dataKey, value);
      }
    });

    initDatas.forEach(function(each) {
      sc.getState(each[1], each[0]).setData(each[2], each[3]);
    });

    if (d3.keys(initStates).length) {
      self.routeChanged.active = false;
      sc.initStates(initStates);
      sc.sendEvent('initState');
      self.routeChanged.active = true;
    }

  },

  _nullState: [{
    name: null,
    getData: function() { return null; }
  }],

  _serialize: function(sc, transformers) {
    var self = this,
      parts = [];

    if (!transformers)
      transformers = {};
    if (!transformers.key)
      transformers.key = function(key) { return key; }
    if (!transformers.value)
      transformers.value = function(key, value) { return value; }
    if (typeof(transformers.sep) === 'undefined')
      transformers.sep = '/';

    this._walk(function(i, type, stateKey, dataKey) {
      var states = sc ? sc.currentState(stateKey) : self._nullState;
      if (!states || !states.length) return;

      var state = states[0];

      if (type === 'state')
        parts.push(transformers.key(stateKey), transformers.value(stateKey, state.name));
      else if (type === 'data')
        parts.push(transformers.key(dataKey), transformers.value(dataKey, state.getData(dataKey) || ''));
    });
    return parts.join(transformers.sep);
  },

  _walk: function(callback) {
    var i = 0;
    this._ops.forEach(function(op) {
      callback(i, 'state', op.tree);
      i += 1;
      op._datas.forEach(function(name) {
        callback(i, 'data', op.tree, name);
        i += 1;
      });
    }, this);
  }
};

function App() {
  this.serializer = new Serializer();
  this.serializer
    .state('layout')
    .state('search').data('target')
    .state('focus').data('target')
    .state('inspector').data('target');
}
App.prototype = {
  C: {
    colSize: 15,
    entryWidth: 54,
    entryHeight: 20,
    entryPadding: 0.2
  },

  init: function(root) {
    var self =  this;
  
    this.serializer.routeChanged.add(function() {
      self.setHashSilently(self.serializer.asRoute(self.statechart));
    });
  
    //setup crossroads
    crossroads.normalizeFn = this.serializer.normalizeParams;
    crossroads.addRoute(this.serializer.asRoutePattern(), function(params) {
      self.serializer.unserialize(self.statechart, params);
    });
    //setup hasher
    function parseHash(newHash, oldHash){
      crossroads.parse(newHash);
    }
    hasher.initialized.add(parseHash); //parse initial hash
    hasher.changed.add(parseHash); //parse hash changes

    this.cll = new app.Facets.CLLIndex(root.cll);
    this.spatial = new app.Facets.SpatialIndex(),
    this.nodes = app.Models.makeNodes(root.cmavo.concat(root['experimental cmavo'])),

    // Precompute the orders.
    this.layouts = {
      alphabet: new app.Layouts.ABCLayout(this.nodes, this.cll),
      chapter: new app.Layouts.ChapterLayout(this.nodes, this.cll),
      length: new app.Layouts.LengthLayout(this.nodes, this.cll)
    };
  
    this.nodesWidget = new app.Widgets.NodesWidget('#cheatsheet');
    this.nodesWidget.init(this.nodes, this.cll).listen();

    this.inspectorWidget = new app.Widgets.InspectorWidget('#inspector');
    this.searchWidget = new app.Widgets.SearchWidget();
    this.searchWidget.listen();
    this.layoutWidget = new app.Widgets.LayoutWidget('#layout');
    this.layoutWidget.listen();
  },

  run: function(defaultHash) {
    hasher.init(); //start listening for history change
    if (!hasher.getHash().length)
      hasher.setHash(defaultHash);

    var inspectorState = this.statechart.currentState(this.globalStates.inspector)[0];

    if (inspectorState.name === 'notInspecting')
      this.nodesWidget.inspectAnything();
    else
      this.nodesWidget.cameraWidget.panToShow(this.nodes.d3select(inspectorState.getData('target')).datum());
  },

  getCurrentLayout: function() {
    return this.layouts[this.statechart.currentState(this.globalStates.layout)[0].name];
  },

  setHashSilently: function(hash) {
    hasher.changed.active = false; //disable changed signal
    hasher.setHash(hash); //set hash without dispatching changed signal
    hasher.changed.active = true; //re-enable signal
  }
}

var app = new App();
