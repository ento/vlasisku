window.app = window.app || {}
app.models = {}

app.models.Field = Backbone.Model.extend
  drilldown: ->
    spatial = @get('spatial')
    spatial.drilldown.apply spatial, arguments

  getAnyNode: ->
    d = @get('spatial').rt.search
      x: 0
      y: 0
      h: 1
      w: 1
    d = (if (d and d.length) then d[0] else @get('nodes')[0])
    d

  getNode: (target) ->
    @_d3select(target).datum()

  getNodeBounds: ->
    @get('spatial').getBounds()

  focus: (target) ->
    # TODO: looks like an accessor method, but has side-effects
    targetDatum = undefined
    @get('nodes').forEach (d) ->
      d.confusable = @_calculateConfusability(target, d.word)
      targetDatum = d  if d.word is target
    , @

    targetDatum

  rebuildIndex: () ->
    @get('spatial').rebuildIndex @get('nodes')

  search: (q) ->
    # TODO: looks like an accessor method, but has side-effects
    candidates = []
    @get('nodes').forEach (d) ->
      if q and q.length and app.helper.startsWith(d.word, q)
        d.searchHit = [q, d.word.slice(q.length)]
        candidates.push d
      else
        d.searchHit = null

    candidates

  _calculateConfusability: (a, b) ->
    return null  if not a or not b
    return type: "identical"  if a is b

    #a = a.replace("'", '');
    #b = b.replace("'", '');
    if a.length isnt b.length
      longer = (if a.length > b.length then a else b)
      shorter = (if a.length > b.length then b else a)
      for i of longer
        withApostrophe = shorter.substring(0, i) + "'" + shorter.substring(i)
        return type: "yhy"  if withApostrophe is longer
      return null
    diffs = 0
    diffIndex = undefined
    for i of a
      if a[i] isnt b[i]
        diffs += 1
        diffIndex = i
    if diffs is 1
      return (
        type: "singleletter"
        index: parseInt(diffIndex)
      )
    null

  _d3select: (d) ->
    word = (if d.word then d.word else d)
    d3.select "#" + app.helper.slugify(word)
