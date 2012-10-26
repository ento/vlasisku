function growRectangle(rect, point) {
  if (point.x < rect.x) {
    rect.width += rect.x - point.x;
    rect.x = point.x;
  } else if ((rect.x + rect.width) < point.x) {
    rect.width += point.x - (rect.x + rect.width);
  }
  if (point.y < rect.y) {
    rect.height += rect.y - point.y;
    rect.y = point.y;
  } else if ((rect.y + rect.height) < point.y) {
    rect.height += point.y - (rect.y + rect.height);
  }
}

function contains(aRect, bRect) {
  var bx_lt_ax = bRect.x < aRect.x,
    ar_lt_br = (aRect.x + aRect.width) < (bRect.x + (bRect.width || 0));
  if (bx_lt_ax || ar_lt_br)
    return false;
  var by_lt_ay = bRect.y < aRect.y,
    ab_lt_bb = (aRect.y + aRect.height) < (bRect.y + (bRect.height || 0));
  if (by_lt_ay || ab_lt_bb)
    return false;
  return true;
}

function evade(danger, victim) {
  var dangerCenter = center(danger),
    victimCenter = center(victim),
    dx, dy;
  if (victimCenter.x < dangerCenter.x) {
    dx = danger.x - (victim.x + victim.width);
  } else {
    dx = danger.x + danger.width - victim.x;
  }
  if (victimCenter.y < dangerCenter.y) {
    dy = danger.y - (victim.y + victim.height);
  } else {
    dy = danger.y + danger.height - victim.y;
  }
  var evadeToX = Math.abs(dx) < Math.abs(dy);
  return {x: (evadeToX ? dx : 0), y: (evadeToX ? 0 : dy)};
}

function center(rect) {
  return {x: rect.x + rect.width * 0.5, y: rect.y + rect.height * 0.5};
}

function move(rect, diff) {
  return {x: rect.x + diff.x, y: rect.y + diff.y, width: rect.width, height: rect.height};
}
