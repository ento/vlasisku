window.app = window.app || {}
window.app.Rect = Rect = {}

Rect.unionOfPoint = (rect, point) ->
  union = _.clone rect
  if point.x < rect.x
    union.width += rect.x - point.x
    union.x = point.x
  else union.width += point.x - (rect.x + rect.width)  if (rect.x + rect.width) < point.x
  if point.y < rect.y
    union.height += rect.y - point.y
    union.y = point.y
  else union.height += point.y - (rect.y + rect.height)  if (rect.y + rect.height) < point.y

  union

Rect.contains = (aRect, bRect) ->
  bx_lt_ax = bRect.x < aRect.x
  ar_lt_br = (aRect.x + aRect.width) < (bRect.x + (bRect.width or 0))
  return false  if bx_lt_ax or ar_lt_br
  by_lt_ay = bRect.y < aRect.y
  ab_lt_bb = (aRect.y + aRect.height) < (bRect.y + (bRect.height or 0))
  return false  if by_lt_ay or ab_lt_bb
  true

Rect.evade = (victim, danger) ->
  dangerCenter = Rect.centerPoint(danger)
  victimCenter = Rect.centerPoint(victim)
  dx = undefined
  dy = undefined
  if victimCenter.x < dangerCenter.x
    dx = danger.x - (victim.x + victim.width)
  else
    dx = danger.x + danger.width - victim.x
  if victimCenter.y < dangerCenter.y
    dy = danger.y - (victim.y + victim.height)
  else
    dy = danger.y + danger.height - victim.y
  evadeAlongX = Math.abs(dx) < Math.abs(dy)
  x: ((if evadeAlongX then dx else 0))
  y: ((if evadeAlongX then 0 else dy))

Rect.centerPoint = (rect) ->
  x: rect.x + rect.width * 0.5
  y: rect.y + rect.height * 0.5

Rect.move = (rect, diff) ->
  x: rect.x + diff.x
  y: rect.y + diff.y
  width: rect.width
  height: rect.height
