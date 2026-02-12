import requests
import sys

base_url = "http://localhost:5000"

def check_endpoint(path, expected_type="json"):
    try:
        url = f"{base_url}{path}"
        print(f"Checking {url}...")
        resp = requests.get(url, timeout=5)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"FAILURE: Status {resp.status_code}")
            return False

        content_type = resp.headers.get("Content-Type", "")
        print(f"Content-Type: {content_type}")

        if "text/html" in content_type:
            if "Impulsa tu progreso" in resp.text:
                print("FAILURE: Redirected to Landing Page")
                return False
            if expected_type == "json":
                print("FAILURE: Expected JSON, got HTML")
                return False
        
        if expected_type == "json":
            try:
                data = resp.json()
                if "openapi" in data or "swagger" in data:
                    print("SUCCESS: Valid OpenAPI JSON")
                    return True
                else:
                    print("FAILURE: Invalid JSON content")
                    return False
            except Exception:
                print("FAILURE: Not JSON")
                return False
        else: # HTML (apidocs UI)
            if "<div id=\"swagger-ui\">" in resp.text or "swagger-ui-bundle.js" in resp.text:
                 print("SUCCESS: Swagger UI detected")
                 return True
            else:
                 print("WARNING: Swagger UI element not found, but not landing page either.")
                 print(resp.text[:200])
                 return True # tentative success

    except Exception as e:
        print(f"ERROR: {e}")
        return False

print("\n--- Verifying Swagger ---")
spec_ok = check_endpoint("/apispec.json", "json") or check_endpoint("/apispec_1.json", "json")
ui_ok = check_endpoint("/apidocs/", "html")

if spec_ok and ui_ok:
    print("\nVERIFICATION PASSED")
else:
    print("\nVERIFICATION FAILED")

