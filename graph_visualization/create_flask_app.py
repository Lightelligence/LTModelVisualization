import os

from flask import Flask, jsonify, render_template

app = Flask(__name__,
            template_folder=os.path.join(os.path.dirname(__file__),
                                         "templates"))


@app.route("/")
def home():
    """A template is rendered as Python flask searches for all html files
     in 'templates'folder, which is also why all
     HTML files are placed in that directory."""
    return render_template("d3_graph.html")


@app.route("/graph.json")
def graph():
    """ Serves a graph which is converted to JSON format."""
    return jsonify(app.config["jsonified"])


def run_flask(port, json_object):
    app.config["jsonified"] = json_object
    app.run(debug=True, host="0.0.0.0", port=port)
