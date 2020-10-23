import networkx as nx
from tensorflow.compat import v1 as tf

tf.disable_v2_behavior()


def main(path_to_model, graph_pb_type="tf"):
    if graph_pb_type != "tf":
        raise KeyError("The type {} is not supported".format(graph_pb_type))
    list_of_links = []
    # Used to store i/p nodes that are input to the graph and are non-dummy nodes.
    node_set = set()

    # Simultaneously creating nx graph to get absolute node positions to space
    # them appropriately.
    nxGraph = nx.Graph()
    dummy_nodes_counter = 0

    with tf.gfile.GFile(path_to_model, "rb") as f:
        graph_def = tf.GraphDef()
        graph_def.ParseFromString(f.read())

    not_in_graph_node_to_dummy_map = {}
    with tf.Session(graph=tf.Graph()) as _:
        tf.import_graph_def(graph_def, name="")
        g = tf.get_default_graph()

        [graph_inputs, graph_outputs] = analyze_inputs_outputs(g)
        graph_inputs = [x.name for x in graph_inputs]
        graph_outputs = [x.name for x in graph_outputs]

        for node in g.as_graph_def().node:
            op = g.get_operation_by_name(node.name)

            for input_node_obj in op.inputs:
                [name, port] = get_node_name_and_port(input_node_obj.name)
                try:
                    g.get_operation_by_name(name)
                    source = name
                except Exception:
                    if name not in not_in_graph_node_to_dummy_map.keys():
                        source = "dummy" + str(dummy_nodes_counter)
                        not_in_graph_node_to_dummy_map[name] = source
                        dummy_nodes_counter += 1
                    else:
                        # do not update counter if node name is cached
                        source = not_in_graph_node_to_dummy_map[name]

                target = node.name  # op.name and node.name should be same ideally

                linkname = source + ":" + str(port)

                node_set.add(target)
                node_set.add(source)
                list_of_links.append((source, target, linkname))

            for ctrl_input_node_obj in op.control_inputs:
                try:
                    g.get_operation_by_name(ctrl_input_node_obj.name)
                except Exception:
                    print("Could not find control input {0} in the graph".format(
                        ctrl_input_node_obj.name))
                node_set.add(ctrl_input_node_obj.name)
                list_of_links.append((ctrl_input_node_obj.name, node.name, "ctrl_input"))

            for output_node_obj in op.outputs:
                [output_edge_name, port] = get_node_name_and_port(output_node_obj.name)
                try:
                    g.get_operation_by_name(output_edge_name)
                except Exception:
                    source = node.name
                    target = "Dummy" + dummy_nodes_counter
                    dummy_nodes_counter += 1
                    linkname = source + ":" + str(port)

                    list_of_links.append((source, target, linkname))
                    node_set.add(source)
                    node_set.add(target)

        # list provides a better layout than set
        list_of_nodes = list(node_set)

        for node in list_of_nodes:
            nxGraph.add_node(node)

        for link in list_of_links:
            nxGraph.add_edge(link[0], link[1])

        positions_dict = nx.spectral_layout(nxGraph)
        # get position from spectral layout which is faster than others.

        graph = {}
        graph["nodes"] = []
        graph["links"] = []
        graph["directories"] = ["Graph"]
        graph["workload"] = []
        graph["op_type"] = []
        graph["all_opu_type_names"] = []

        opu_type_set = set(["Dummy"])

        for index, node in enumerate(g.as_graph_def().node):
            group = -1
            hover_text = ""
            error_value = 0
            opu_type_name = g.get_operation_by_name(node.name).type
            opu_type_set.add(opu_type_name)

            graph["nodes"].append({
                "name": node.name,
                "node_info": opu_type_name,
                "group": group + 1,
                "hover_text": hover_text,
                "error": error_value
            })
            # Take position from the layout algorithm.
            graph["nodes"][index]["x"] = positions_dict[node.name][0]
            graph["nodes"][index]["y"] = positions_dict[node.name][1]

        graph["all_opu_type_names"] = list(opu_type_set)

        for link in list_of_links:
            port = int(get_node_name_and_port(
                link[2])[-1]) if not link[2].startswith("ctrl_input") else -1
            hover_text = ""
            if not link[0].startswith("Dummy") and port != -1:
                related_tensor = g.get_operation_by_name(link[0]).outputs[port]

                hover_text = "Shape:" + extract_shape(
                    related_tensor) + "<br> Dtype:" + related_tensor.dtype.name
            graph["links"].append({
                "source": link[0],
                "target": link[1],
                "linkname": link[0] + ":" + str(port),
                "hover_info": hover_text,
                "edge_hist_data": [],
                "port": port
            })

        graph["input_nodes"] = []
        for node in graph_inputs:
            graph["input_nodes"].append({"name": node})
        return graph


def extract_shape(tensor):
    if tensor.get_shape():
        int_list = tensor.get_shape().as_list()
        return ",".join([str(int_val) for int_val in int_list])
    return ""


def analyze_inputs_outputs(graph):
    ops = graph.get_operations()
    outputs_set = set(ops)
    inputs = []
    for op in ops:
        if len(op.inputs) == 0 and op.type != "Const":
            inputs.append(op)
        else:
            for input_tensor in op.inputs:
                if input_tensor.op in outputs_set:
                    outputs_set.remove(input_tensor.op)
    outputs = list(outputs_set)
    return [inputs, outputs]


def get_node_name_and_port(node_and_port):
    return node_and_port.split(":")


if __name__ == "__main__":
    main()
