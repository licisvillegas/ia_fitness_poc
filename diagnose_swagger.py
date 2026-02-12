import requests
import json

try:
    print("--- Fetching apispec.json ---")
    r = requests.get('http://localhost:5000/apispec.json')
    data = r.json()
    print(f"Keys: {list(data.keys())}")
    if 'swagger' in data:
        print(f"FOUND swagger: {data['swagger']}")
    if 'openapi' in data:
        print(f"FOUND openapi: {data['openapi']}")
    
    print("\n--- Fetching apidocs content ---")
    r = requests.get('http://localhost:5000/apidocs/')
    content = r.text
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if "None" in line:
            print(f"Line {i+1} (HAS NONE): {line.strip()}")
    
    print("\n--- Lines around 103 ---")
    for i in range(98, 108):
        if i < len(lines):
            print(f"Line {i+1}: {lines[i].strip()}")

except Exception as e:
    print(e)
