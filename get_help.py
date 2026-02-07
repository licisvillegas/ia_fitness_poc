import subprocess

with open("mcp_help_full.txt", "w", encoding="utf-8") as f:
    subprocess.run(["uv", "tool", "run", "notebooklm-mcp", "--help"], stdout=f, stderr=subprocess.STDOUT)
