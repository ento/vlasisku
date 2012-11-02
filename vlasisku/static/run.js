d3.json("/entries.json?group_by=type", function(root) {
  app.init(root);

  $(function() {
    app.run('layout/alphabet/search/notSearching/focus/notFocused/inspector/notInspecting');
  });
});
