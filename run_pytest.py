
import subprocess
import sys
import os

# Ensure CWD is in path
sys.path.insert(0, os.getcwd())

print(f"Running pytest from {os.getcwd()}...")

try:
    args = sys.argv[1:] if len(sys.argv) > 1 else []
    base_cmd = [sys.executable, "-m", "pytest"]
    cmd = base_cmd + args
    
    result = subprocess.run(
        cmd,
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
