#!/bin/bash

# Set the directory where your test files are located
if [ -z "$1" ]; then
  test_directory="./test"
else
  test_directory="$1"
fi

# Iterate through each test file in the directory
for file in "$test_directory"/*.js; do
  if [ -f "$file" ]; then
    echo "Running Test file: $file"
    # Run yarn jest for each test file
    yarn hardhat test "$file"
  fi
done