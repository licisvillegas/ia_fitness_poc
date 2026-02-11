import pytest
import sys
import os
from app import create_app
from extensions import limiter

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@pytest.fixture
def app():
    """Create application for testing."""
    app = create_app()
    app.config.update({
        'TESTING': True,
        'RATELIMIT_ENABLED': True,
        'WTF_CSRF_ENABLED': False
    })
    
    # Ensure fresh limits for tests
    with app.app_context():
        limiter.reset()

    yield app

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """A test runner for the app's CLI commands."""
    return app.test_cli_runner()
