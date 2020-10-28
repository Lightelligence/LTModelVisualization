package(default_visibility = ["//visibility:public"])

py_test(
    name = "test_tf_d3_graph",
    srcs = ["test_tf_d3_graph.py"],
    data = ["//graphs:tensorflow_inception_graph"],
    deps = [
        "//graph_visualization:tf_proto_to_json",
        "//graphs:sample_tf_graph",
    ],
)
