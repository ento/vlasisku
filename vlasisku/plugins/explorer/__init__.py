from collections import defaultdict

from flask import Blueprint, request, json, render_template
from flask.ext.assets import Environment, Bundle

from vlasisku.extensions import database
from vlasisku.utils import etag, jsonify
from vlasisku.database import TYPES


__prefix__ = '/explore'

explorer = Blueprint('explorer', __name__, template_folder='templates', static_folder='static')
_json_entries = None
_json_entries_lite = None


js_app_assets = Bundle(
    'explorer/js/app.coffee',
    'explorer/js/rect.coffee',
    'explorer/js/helper.coffee',
    'explorer/js/models.coffee',
    'explorer/js/facets.coffee',
    'explorer/js/layouts.coffee',
    'explorer/js/states.coffee',
    'explorer/js/views.coffee',
    'explorer/js/run.coffee',
    filters='coffeescript',
    output='explorer/js/gen/app.js'
    )
js_lib_assets_flat = Bundle(
    'explorer/js/libs/rtree.js',
    'explorer/js/libs/jquery-1.7.1.js',
    filters='jsmin',
    )
js_lib_assets = Bundle(
    js_lib_assets_flat,
    'explorer/js/libs/d3.v2.min.js',
    'explorer/js/libs/underscore-min.js',
    'explorer/js/libs/hasher.min.js',
    'explorer/js/libs/crossroads.min.js',
    'explorer/js/libs/stativus-min.js',
    'explorer/js/libs/mousetrap.min.js',
    output='explorer/js/gen/libs.js',
    )
css_app_assets = Bundle(
    'explorer/css/explorer.less',
    filters='less',
    output='explorer/css/gen/explorer.css',
    )


@explorer.record_once
def register_assets(s):
    assets = Environment(s.app)
    assets.register('js_lib', js_lib_assets)
    assets.register('js_app', js_app_assets)
    assets.register('css_app', css_app_assets)
    assets.config['coffee_no_bare'] = True


@explorer.route('/cmavo')
@etag
def cmavo():
    return render_template('explorer/cmavo.html')


@explorer.route('/entries.json')
@etag
def entries():
    json_entries = get_json_entries(request.args.get('lite', '1') != '0')
    group_by = request.args.get('group_by')
    if group_by:
        grouped = defaultdict(list)
        for e in json_entries.itervalues():
            group_value = e.get(group_by)
            grouped[group_value or ''].append(e)
        return jsonify(cll=database.root.cll, **grouped)

    word = request.args.get('word')
    if word:
        return jsonify(word=json_entries[word])

    return jsonify(cll=database.root.cll, **json_entries)


def get_json_entries(lite=False):
    global _json_entries, _json_entries_lite
    if _json_entries is None:
        _json_entries = dict()
        for e in database.root.entries.itervalues():
            _json_entries[e.word] = e.__json__()
    if lite and _json_entries_lite is None:
        _json_entries_lite = dict((k, make_lite_entry(v)) for k, v in _json_entries.iteritems())
        
    return _json_entries_lite if lite else _json_entries


def make_lite_entry(entry_json):
    return dict((k, v) for k, v in entry_json.iteritems() if k not in ('db', 'definition', 'notes', 'textnotes'))
