import subprocess
import json
import sys
import os

def run_verification():
    print("Starting NotebookLM MCP Server verification...")
    
    # Command to run the MCP server
    cmd = "uv tool run -q notebooklm-mcp server"
    
    try:
        # Start the server process
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=True
        )
        
        # 1. Initialize
        f = os.getcwd()
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05", # Using a recent version
                "capabilities": {},
                "clientInfo": {"name": "manual-verifier", "version": "1.0"},
                "rootUri": f"file:///{f.replace(os.sep, '/')}"
            }
        }
        
        print("Sending initialize request...")
        process.stdin.write(json.dumps(init_request) + "\n")
        process.stdin.flush()
        
        # Read response
        response_line = process.stdout.readline()
        if not response_line:
            print("Error: No response from server during initialization")
            stderr_output = process.stderr.read()
            print(f"STDERR:\n{stderr_output}")
            return
            
        print(f"Initialize response: {response_line[:100]}...")
        
        # 2. Initialized notification
        initialized_notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        process.stdin.write(json.dumps(initialized_notification) + "\n")
        process.stdin.flush()

        # 3. List Tools (to see if we can list notebooks via a tool or resource)
        list_tools_request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        print("Sending tools/list request...")
        process.stdin.write(json.dumps(list_tools_request) + "\n")
        process.stdin.flush()
        
        response_line = process.stdout.readline()
        if not response_line:
            print("Error: No response from server for tools/list")
            return
            
        tools_response = json.loads(response_line)
        print("Tools available:")
        tools = tools_response.get("result", {}).get("tools", [])
        for tool in tools:
            print(f"- {tool['name']}")
            
        # 4. List Resources
        list_resources_request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "resources/list",
            "params": {}
        }
        
        print("Sending resources/list request...")
        process.stdin.write(json.dumps(list_resources_request) + "\n")
        process.stdin.flush()
        
        response_line = process.stdout.readline()
        if not response_line:
            print("Error: No response from server for resources/list")
            return
            
        resources_response = json.loads(response_line)
        print("Resources available (Notebooks):")
        resources = resources_response.get("result", {}).get("resources", [])
        for resource in resources:
            print(f"- {resource['name']} ({resource['uri']})")

        # Terminate
        process.terminate()
        print("\nVerification successful!")
        
    except Exception as e:
        print(f"Verification failed: {e}")

if __name__ == "__main__":
    run_verification()
