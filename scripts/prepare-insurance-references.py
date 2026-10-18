"""Compatibility entry point: prepares the reviewed insurance subset only."""
import runpy
import sys
from pathlib import Path

sys.argv = [str(Path(__file__).with_name("prepare-kaggle-references.py")), "--domain", "insurance"]
runpy.run_path(sys.argv[0], run_name="__main__")
