import argparse

from graph_visualization import create_flask_app, tf_proto_to_json


def main():
    """ Runs a web server based on flask, specifying port is optional
    (defaulted to 5000) """
    parser = argparse.ArgumentParser()
    parser.add_argument("--port",
                        type=int,
                        help="port number (default 5000)",
                        default=5000)
    parser.add_argument("--pb_graph_path", type=str, help="path to a pb graph file")
    parser.add_argument("--graph_pb_type",
                        default="tf",
                        type=str,
                        help=("Currently defaulted to \"tf\" , Other" +
                              "supported types in future releases are \"onnx\""))
    args = parser.parse_args()

    json_object = tf_proto_to_json.main(args.pb_graph_path,
                                        graph_pb_type=args.graph_pb_type)

    create_flask_app.run_flask(args.port, json_object)


if __name__ == "__main__":
    main()
