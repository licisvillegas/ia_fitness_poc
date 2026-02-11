
import subprocess
import sys
import os

# Ensure CWD is in path
sys.path.insert(0, os.getcwd())

print(f"Running pytest from {os.getcwd()}...")

try:
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_rate_limiting.py"],
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace'
    )
    print("=== STDOUT ===")
    print(result.stdout)
    print("=== STDERR ===")
    print(result.stderr)
    print(f"Exit Code: {result.returncode}")
except Exception as e:
    print(f"Error running pytest: {e}")
