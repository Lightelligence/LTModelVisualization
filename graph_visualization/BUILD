load("@rules_python//python:defs.bzl", "py_binary", "py_library")

package(
    default_visibility = ["//visibility:public"],
)

py_binary(
    name = "plot_graph",
    srcs = ["plot_graph.py"],
    main = "plot_graph.py",
    deps = [
        ":create_flask_app",
        ":tf_proto_to_json",
    ],
)

py_library(
    name = "tf_proto_to_json",
    srcs = ["tf_proto_to_json.py"],
    deps = [
    ],
)

py_library(
    name = "create_flask_app",
    srcs = ["create_flask_app.py"],
    data = [
        "//graph_visualization/templates:d3_graph",
    ],
)
