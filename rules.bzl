def lt_nodejs_library(
        name,
        srcs = [],
        deps = [],
        data = []):
    for src in srcs:
        if not src.endswith(".js"):
            fail("sources must be .js files")

    native.filegroup(
        name = name,
        srcs = srcs,
        data = deps + data,
    )

def lt_html_library(
        name,
        srcs = [],
        deps = [],
        data = []):
    for src in srcs:
        if not src.endswith(".html"):
            fail("sources must be .html files")

    native.filegroup(
        name = name,
        srcs = srcs,
        data = deps + data,
    )