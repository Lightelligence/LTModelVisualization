"""A setuptools based setup module.
See:
https://packaging.python.org/guides/distributing-packages-using-setuptools/
https://github.com/pypa/sampleproject
"""
import os
import pathlib

# Always prefer setuptools over distutils
from setuptools import find_packages, setup

req_path = "requirements.txt"
if os.path.exists(req_path):
    with open(req_path) as f:
        requirements = [r.strip() for r in f.readlines()]
else:
    requirements = []

here = pathlib.Path(__file__).parent.resolve()
long_description = (here / "README.md").read_text(encoding="utf-8")

setup(
    name="lightelligence-model-visualization",
    version=os.environ["PIP_VERSION"] if "PIP_VERSION" in os.environ else "9.9.9",
    author="Lightelligence",
    description="An easy and interactive graph visualization tool for ML models!!!",
    long_description=long_description,
    long_description_content_type="text/markdown",
    license="BSD",
    include_package_data=True,
    install_requires=requirements,
    packages=find_packages(),
    entry_points={
        "console_scripts": ["plot=graph_visualization.plot_graph:main",
                           ],
    },
    python_requires=">=3.6",
)
