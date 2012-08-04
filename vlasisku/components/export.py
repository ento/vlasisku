
from flask import Module

from vlasisku.extensions import database
from vlasisku.utils import etag, jsonify
from vlasisku.database import TYPES


export = Module(__name__)
json_entries = None


@export.route('/entries.json')
@etag
def entries():
    global json_entries
    if not json_entries:
        json_entries = dict((t, []) for t, desc in TYPES)
        for e in database.root.entries.itervalues():
            json_entries[e.type].append(e.__json__())
    return jsonify(cll=database.root.cll, **json_entries)
