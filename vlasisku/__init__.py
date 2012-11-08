
from flask import Flask

from vlasisku.extensions import genshi, database
from vlasisku import components
from vlasisku import plugins


app = Flask(__name__)
genshi.init_app(app)
database.init_app(app)

ETAG = database.root.etag

app.config.from_object(__name__)

app.register_module(components.app)
app.register_module(components.general)
app.register_module(components.opensearch)
app.register_module(components.pages, url_prefix='/page')

plugins.init_app(app)
