load("//:rules.bzl", "lt_html_library")

package(
    default_visibility = ["//visibility:public"],
)

lt_html_library(
    name = "d3_graph",
    srcs = ["d3_graph.html"],
    deps = [
        "//graph_visualization/static:d3_graph_js",
    ],
)
