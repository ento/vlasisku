(function(app) {

app.Widgets = {};

app.Widgets.NodesWidget = function(selector) {
  this.$el = $(selector);
  var svg = d3.select(selector).append("svg")
      .attr("id", "canvas")
    .append("g")
      .attr("id", "content");
  
  svg.append("g")
    .attr("id", "cursor")
    .append("rect")
    .attr("width", app.C.entryWidth)
    .attr("height", app.C.entryHeight)
    .attr("transform", "translate(0,-3)");
  
  svg.append("g")
    .attr("id", "backdrop")
    .append("rect")
    .attr("width", 1000)
    .attr("height", 1000);

  this.svg = svg;
  this.cameraWidget = new app.Widgets.Camera(selector);
  this.cameraWidget.listen();
}

app.Widgets.NodesWidget.prototype = {
  init: function(nodes, cll) {
    var entries = this.svg.selectAll(".entry")
        .data(nodes)
      .enter().append("g")
        .attr("class", "entry")
        .attr("id", function(d) { return slugify(d.word); })
        .attr("transform", "translate(0,-10000)"),
      crestWidth = 5,
      crestOffset = 0,
      fontHeight = 14 - 3,
      crestGap = (fontHeight - crestOffset) - crestWidth * 2,
      c = d3.scale.category20b().domain(d3.range(20)),
      gc = d3.scale.category10().domain(d3.range(cll.gcIndex.maxIndex));
  
    entries.append("rect")
        .attr("width", crestWidth)
        .attr("height", crestWidth)
        .attr("transform", "translate(0," + crestOffset + ")")
        .attr("fill", function(d) { return c(cll.findChapter(d)[0]); });
  
    entries.append("rect")
        .attr("width", crestWidth)
        .attr("height", crestWidth)
        .attr("transform", "translate(0," + (crestOffset + crestWidth + crestGap) + ")")
        .attr("fill", function(d) { return gc(cll.gcIndex[d.grammarclass]); });
  
    entries.append("text")
        .attr("x", 6)
        .attr("y", 0)
        .attr("width", app.C.entryWidth)
        .attr("height", app.C.entryHeight * (1.0 - app.C.entryPadding))
        .attr("text-anchor", "start")
        .on("mouseover", this.mouseover)
        .text(function(d) { return d.word; });
    return this;
  },

  listen: function() {
    $('#canvas').on('click', '.entry text, .entry rect', function() {
      app._transitionLock = true;
      app.statechart.sendEvent('focus', d3.select(this).datum().word);
      app._transitionLock = false;
    });

    $('#backdrop').on('click', function() {
      app.statechart.sendEvent('blur');
    });

    Mousetrap
      .bind('h', this.selectLeft)
      .bind('j', this.selectDown)
      .bind('k', this.selectUp)
      .bind('l', this.selectRight);
  },

  inspectAnything: function() {
    var d;
    if (!this.cursor) {
      d = app.spatial.rt.search({x: 0, y: 0, h: 1, w: 1});
      d = (d && d.length) ? d[0] : app.nodes[0];
    } else {
      d = this.cursor;
    }
    app.statechart.sendEvent('inspect', d);
  },

  selectLeft: function() {
    var selected = app.spatial.drilldown(this.cursor, [['lr', 'r'], ['t', 'br']]);
    if (selected)
      app.statechart.sendEvent('inspect', selected);
  },

  selectRight: function() {
    var selected = app.spatial.drilldown(this.cursor, [['rr', 'l'], ['b', 'tl']]);
    if (selected)
      app.statechart.sendEvent('inspect', selected);
  },

  selectUp: function() {
    var selected = app.spatial.drilldown(this.cursor, [['tc', 'b']]);
    if (selected)
      app.statechart.sendEvent('inspect', selected);
  },

  selectDown: function() {
    var selected = app.spatial.drilldown(this.cursor, [['bc', 't']]);
    if (selected)
      app.statechart.sendEvent('inspect', selected);
  },

  mouseover: function() {
    app.statechart.sendEvent('inspect', d3.select(this).datum());
  },

  highlightSearchHits: function() {
    d3.selectAll('.entry').each(function(d) {
      var textElem = d3.select(this).select('text');
      if (d.searchHit) {
        textElem.text('');
        textElem.append('tspan').attr('class', 'highlight').text(d.searchHit[0]);
        textElem.append('tspan').text(d.searchHit[1]);
      } else {
        textElem.text(d.word);
      }
    });
  },

  resetFocus: function() {
    d3.select('.focus-center').classed('focus-center', false);
    d3.selectAll('.entry.focus').attr('class', 'entry');
  },

  updateCanvasSize: function() {
    var bounds = app.spatial.getBounds(),
      canvasWidth = bounds.w,
      canvasHeight = bounds.h + 50;

    d3.select('#canvas').transition().duration(1000)
      .attr("width", canvasWidth)
      .attr("height", canvasHeight);
    d3.select('#backdrop rect').transition().duration(1000)
      .attr("width", canvasWidth)
      .attr("height", canvasHeight);
  },

  updateCanvasPan: function() {
    d3.select('#cheatsheet').transition()
      .duration(1000)
      .tween("scrollLeft", scrollLeftTween(-this.cameraWidget.pan.x))
      .tween("scrollTop", scrollTopTween(-this.cameraWidget.pan.y));
  },

  updateMainView: function(value, options) {
    var layout = value ? app.layouts[value] : app.getCurrentLayout(),
      options = _.extend({panToShow: false}, options);

    // TODO
    layout.applyBaseLayout(app.nodes);
    var focus = app.statechart.getState('focused', app.globalStates.focus).getData('target');
    layout.applyFocusLayout(app.nodes, focus);

    this.svg.transition().duration(1000)
      .selectAll(".entry")
      .delay(function(d, i) { return layout.coords.xMap[d.word] * 4; })
      .attr("transform", getTransformation);

    // move backdrop to the very end
    $('#backdrop').appendTo('#content');
    // place focused entries on top of the backdrop
    this.layoutFocus(focus);

    this.updateCursor(null, /*animate=*/true);

    app.spatial.rebuildIndex(app.nodes);

    // inspectAnything depends on spatial index
    //this.inspectAnything();
    this.updateCanvasSize();

    if (options.panToShow)
      this.cameraWidget.panToShow(options.panToShow);
    else
      this.updateCanvasPan();
  },

  layoutFocus: function(focus) {
    this.resetFocus();

    if (!focus) {
      d3.select('#backdrop').attr('class', '');
      return;
    } else {
      d3.select('#backdrop').attr('class', 'in');
    }

    d3.selectAll(".entry").each(function(d, i) {
      var conf = d.confusable;

      if (!conf)
        return;

      var selection = d3.select(this);
      selection
        .classed('focus', true)
        .classed(conf.type, true);
      if (conf.type === 'identical')
        selection.classed('focus-center', true);

      $(this).insertAfter('#backdrop');
    });
  },

  updateCursor: function(target, animate) {
    if (target) {
      this.cursor = target;
    }

    d3.select('.entry.hover').classed('hover', false);

    if (this.cursor) {
      d3.select('#' + slugify(this.cursor.word)).classed('hover', true);

      var t = d3.select('#cursor');
      if (animate)
        t = t.transition().duration(1000);

      t.attr('transform', getTransformation(this.cursor));
    }
  }
};

app.Widgets.InspectorWidget = function(selector) {
  this.$el = $(selector);
};

app.Widgets.InspectorWidget.prototype = {
  updateInspector: function(word) {
    if (!word) {
      this.$el.html('');
      return;
    }

    var self = this;
    d3.json("/entries.json?lite=0&word=" + word, function(response) {
      var text = ['<span class="word">', response.word.word, '</span><span class="grammarclass">', response.word.grammarclass, '</span><span class="description">'],
        classOp = 'removeClass';
      if (response) {
        text.push(response.word.textdefinition);
      } else {
        classOp = 'addClass';
        text.push('Failed to load description');
      }
      text.push('</span>');
      self.$el[classOp]('error').html(text.join(' '))
    });
  }

};

app.Widgets.SearchWidget = function(selector) {
  this.$el = $(selector);
};

app.Widgets.SearchWidget.prototype = {
  listen: function() {
    var self = this;
    $('#search-next, #search-prev').on('click', function(e) {
      e.preventDefault();
      var $cur = $('#candidates .selected'),
        selectNext = $(e.target).is('#search-next'),
        $next = selectNext ? $cur.next('li') : $cur.prev('li');

      if(!$next.length)
        $next = $('#candidates li')[selectNext ? 'first' : 'last']();
  
      if($next.length)
        self.inspectCandidate(d3.select($next.get()[0]).datum());
    });

    $('#search-box input').on('keyup', _.debounce(function() {
      app.statechart.sendEvent('search', $('#q').val());
    }, 100));

    Mousetrap
      .bind('/', this.focusSearchBox);
  },

  inspectAnyCandidate: function() {
    if (!$('#candidates .selected').length)
      $('#search-next').trigger('click');
  },

  inspectCandidate: function(d) {
    app.statechart.sendEvent('inspect', d, /*reveal=*/true);
  },

  focusSearchBox: function() {
    $('#search-box input').focus();
    return false;
  },

  updateSearchCandidates: function(candidates) {
    var self = this,
      li = d3.select('#candidates').selectAll('li').data(candidates),
      oldSelection = d3.select('#candidates .selected');
    li
      .enter()
      .append('li');
    li
      .text(function(d){ return d.word; });
    li
      .exit().remove();
    li
      .on('click', function(d) {
        self.inspectCandidate(d);
      });
  },

  updateCandidateSelection: function(target) {
    $('#candidates .selected').removeClass('selected');
    d3.selectAll('#candidates li').each(function(d){
      if (d.word === target)
        $(this).addClass('selected');
    });
  }

};

app.Widgets.LayoutWidget = function(selector) {
  this.$el = $(selector);
}

app.Widgets.LayoutWidget.prototype = {
  listen: function() {
    var self = this;
    this.$el.find('button').each(function(i, each){
      var $each = $(each);
      Mousetrap.bind(i + 1 + '', function() {
        self.layoutButtonClicked($each);
      });
      $each.on('click', function() {
        self.layoutButtonClicked($each);
      });
    })

  },

  layoutButtonClicked: function($button) {
    app.statechart.sendEvent('changeLayout', $button.data('value'));
  },

  updateActiveButton: function(layoutName) {
    this.$el.find('.active').removeClass('active').end()
      .find('[data-value="' + layoutName + '"]').button('toggle');
  }
};

app.Widgets.Camera = function(selector) {
  this.$el = $(selector);
  this.pan = {x: 0, y: 0};
}

app.Widgets.Camera.prototype = {
  listen: function() {
    Mousetrap
      .bind('s', this.panLeft)
      .bind('d', this.panDown)
      .bind('f', this.panUp)
      .bind('g', this.panRight)
    return this;
  },

  getViewport: function() {
    return {x: -this.pan.x, y: -this.pan.y, width: this.$el.width(), height: this.$el.height()};
  },

  panLeft: function() {
    this.panBy(-app.C.entryWidth * 0.5);
  },

  panUp: function() {
    this.panBy(0, -app.C.entryHeight);
  },

  panDown: function() {
    this.panBy(0, app.C.entryHeight);
  },

  panRight: function() {
    this.panBy(app.C.entryWidth * 0.5);
  },

  panBy: function(x, y) {
    this.pan.x += x || 0;
    this.pan.y += y || 0;
    app.statechart.sendEvent('panChanged');
  },

  panTo: function(p) {
    this.pan.x = -p.x;
    this.pan.y = -p.y;
    app.statechart.sendEvent('panChanged');
  },

  panToShow: function(d) {
    var viewport = this.getViewport();

    if (contains(viewport, {x: d.x, y: d.y, width: app.C.entryWidth, height: app.C.entryHeight})) {
      return;
    }

    var xMargin = viewport.width * 0.1,
      yMargin = viewport.height * 0.4;

    viewport.right = viewport.x + viewport.width;
    viewport.bottom = viewport.y + viewport.height;
    dRight = d.x + app.C.entryWidth;
    dBottom = d.y + app.C.entryHeight;

    // d | viewport |
    if (d.x < viewport.x)
      this.pan.x = -d.x + xMargin;

    //   | viewport | d
    if (viewport.right < dRight)
      this.pan.x = -(dRight - viewport.width) - xMargin;

    if (d.y < viewport.y)
      this.pan.y = -d.y + yMargin;

    if (viewport.bottom < dBottom)
      this.pan.y = -(dBottom - viewport.height) - yMargin;

    app.statechart.sendEvent('panChanged');
  }
};

/* private funcs */

function getTransformation(d) {
  return 'translate(' + d.x + ',' + d.y + ')';
}

})(app);
