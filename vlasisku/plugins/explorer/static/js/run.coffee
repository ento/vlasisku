d3.json "/explore/entries.json?group_by=type", (root) ->
  app.init root
  $ ->
    app.run "layout/alphabet/search/notSearching/focus/notFocused/inspector/notInspecting"
