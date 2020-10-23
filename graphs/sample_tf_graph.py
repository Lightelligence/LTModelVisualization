import argparse
import os

from tensorflow.compat import v1 as tf

tf.disable_v2_behavior()


def create_sample_tf_model(saved_model_dir):
    const = tf.constant(2.0, name="const")

    # create TensorFlow variables
    b = tf.Variable(2.0, name="b")
    c = tf.Variable(1.0, name="c")
    d = tf.add(b, c, name="d")
    e = tf.add(c, const, name="e")
    a = tf.multiply(d, e, name="a")
    init_op = tf.global_variables_initializer()
    graph = tf.get_default_graph()
    graph_path = ""
    with tf.Session(graph=graph) as sess:
        # initialise the variables
        sess.run(init_op)
        # compute the output of the graph
        sess.run(a)
        graph_path = os.path.join(saved_model_dir, "saved_model.pb")
        file = open(graph_path, "wb")
        graph_proto = graph.as_graph_def()
        file.write(graph_proto.SerializeToString())
        file.close()
    return graph_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--saved_model_dir",
                        default="/tmp",
                        type=str,
                        help="dir for saved model.")
    args = parser.parse_args()
    create_sample_tf_model(args.saved_model_dir)
