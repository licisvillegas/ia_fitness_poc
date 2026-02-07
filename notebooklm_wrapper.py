import os
import sys
import io

# set environment variables to suppress banner and logs
os.environ["FASTMCP_DISABLE_BANNER"] = "TRUE"
os.environ["LOG_LEVEL"] = "ERROR"
os.environ["LOGURU_LEVEL"] = "ERROR"

# Redirect stdout to capture initialization noise
real_stdout = sys.stdout
sys.stdout = sys.stderr

try:
    # Attempt to patch rich.console to stop it from printing to stdout
    import rich.console
    
    # Save original init
    original_console_init = rich.console.Console.__init__
    
    def patched_console_init(self, *args, **kwargs):
        # Force all rich console output to stderr
        kwargs['file'] = sys.stderr
        original_console_init(self, *args, **kwargs)
        
    rich.console.Console.__init__ = patched_console_init

    # Import the main CLI entry point
    from notebooklm_mcp.cli import main

except ImportError:
    # Fallback if dependencies aren't found (should be run with 'uv run --with ...')
    sys.stdout = real_stdout
    print("Error: Could not import notebooklm_mcp. Run with 'uv run --with notebooklm-mcp-server ...'", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    # Restore stdout *just* before running, but keep rich patched
    # Note: If FastMCP writes to stdout directly during init, we might still leak.
    # But usually it uses rich or print.
    
    # We keep sys.stdout pointing to stderr during imports to catch any module-level prints
    # verify if we need to restore logic. The server needs stdout to communicate.
    
    # Restore stdout for the actual communication
    sys.stdout = real_stdout
    
    try:
        main()
    except Exception as e:
        # Last resort error logging
        sys.stderr.write(f"Wrapper caught exception: {e}\n")
        sys.exit(1)
