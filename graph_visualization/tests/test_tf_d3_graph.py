import os
import shutil
import tempfile
import unittest

from graph_visualization import tf_proto_to_json
from graphs import sample_tf_graph


class test_tf_d3_graph(unittest.TestCase):

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp_dir)

    def _import_sample_tf_graph(self):
        return sample_tf_graph.create_sample_tf_model(self.tmp_dir)

    def test_tf_d3_graph(self):
        sample_graph_path = self._import_sample_tf_graph()
        self.assertTrue(os.path.exists(sample_graph_path))
        tf_proto_to_json.main(sample_graph_path)

    def test_tf_graph_with_ctrl_inputs(self):
        graph_path = os.path.join("graphs", "tensorflow_inception_graph.pb")
        self.assertTrue(os.path.exists(graph_path))
        tf_proto_to_json.main(graph_path)


if __name__ == "__main__":
    unittest.main()
