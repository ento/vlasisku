function zeroFill(number, width) {
  width -= number.toString().length;
  if ( width > 0 ) {
    return new Array( width + (/\./.test( number ) ? 2 : 1) ).join( '0' ) + number;
  }
  return number + ""; // always return a string
}

function slugify(word) {
  return word.replace("'", "h");
}

function isConfusable(a, b) {
  if (a === b)
    return {type: 'identical'};

  //a = a.replace("'", '');
  //b = b.replace("'", '');

  if (a.length !== b.length) {
    var longer = a.length > b.length ? a : b;
    var shorter = a.length > b.length ? b : a;
    for (i in longer) {
      var withApostrophe = shorter.substring(0, i) + "'" + shorter.substring(i);
      if (withApostrophe === longer)
         return {type: 'yhy'};
    }
    return null;
  }

  var diffs = 0, diffIndex;
  for (i in a) {
    if (a[i] !== b[i]) {
       diffs += 1;
       diffIndex = i;
    }
  }

  if (diffs === 1)
    return {type: 'singleletter', index: diffIndex};

  return null;
}
