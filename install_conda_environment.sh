#!/bin/bash

eval "$(conda shell.bash hook)"

if [[ "$1" == "update" ]]
then
    # Update the environment
    conda env update -f environment.yml --prune

else
    if [[ "$1" == "clean" ]]
    then
        # Remove if already exists
        conda remove --name lt-model-vis --all
    fi
    # Install conda environment
    conda env create -f environment.yml
fi

# Install npm dependencies
conda activate lt-model-vis
npm_deps=("prettier@1.19.1")

for package in ${npm_deps[@]}; do
    npm install -g $package;
done
