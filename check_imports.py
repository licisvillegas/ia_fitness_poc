
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("Attempting to import Flask-Limiter...")
    import flask_limiter
    print(f"Flask-Limiter imported: {flask_limiter.__version__}")
except ImportError as e:
    print(f"FAIL: Flask-Limiter not found: {e}")

try:
    print("Attempting to import extensions...")
    import extensions
    print("SUCCESS: extensions imported.")
except ImportError as e:
    print(f"FAIL: extensions import failed: {e}")
except Exception as e:
    print(f"FAIL: extensions raised exception: {e}")

try:
    print("Attempting to import app...")
    from app import create_app
    print("SUCCESS: app imported.")
except ImportError as e:
    print(f"FAIL: app import failed: {e}")
except Exception as e:
    print(f"FAIL: app raised exception: {e}")
