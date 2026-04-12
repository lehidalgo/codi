import sys
from pathlib import Path

# Add skill root to sys.path so test files can import from scripts/python/
# conftest.py is at: tests/python/conftest.py
# parents[2]      is: <skill-root>/
sys.path.insert(0, str(Path(__file__).parents[2]))
