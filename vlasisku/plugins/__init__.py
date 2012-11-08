
import os
import imp


def init_app(app):
    for plugin, prefix in find_plugins():
        app.register_blueprint(plugin, url_prefix=prefix)


def find_plugins():
    plugins_dir = os.path.dirname(__file__)
    for name in os.listdir(plugins_dir):
      plugin_dir = os.path.join(plugins_dir, name)
      init_py = os.path.join(plugin_dir, '__init__.py')
      if not os.path.isdir(plugin_dir) or not os.path.isfile(init_py):
          continue

      mod = imp.load_module('__init__', *imp.find_module('__init__', [plugin_dir]))

      if not hasattr(mod, name):
          continue

      yield getattr(mod, name), getattr(mod, '__prefix__', None)
