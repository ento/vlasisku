from collections import defaultdict

from flask import Module, request, json

from vlasisku.extensions import database
from vlasisku.utils import etag, jsonify
from vlasisku.database import TYPES


export = Module(__name__)
_json_entries = None
_json_entries_lite = None


@export.route('/entries.json')
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
    return dict((k, v) for k, v in entry_json.iteritems() if k not in ('db', 'definition', 'notes', 'textdefinition', 'textnotes'))
