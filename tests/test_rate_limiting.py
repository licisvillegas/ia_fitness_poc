import pytest
from app import create_app
from extensions import limiter

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['RATELIMIT_ENABLED'] = True
    # Ensure fresh limits for tests
    limiter.reset()
    
    with app.test_client() as client:
        yield client

def test_login_rate_limit(client):
    """Test that login endpoint is rate limited to 5 per minute"""
    # Make 5 successful requests
    for _ in range(5):
        response = client.post('/auth/login', json={
            "email": "test@test.com",
            "password": "password"
        })
        # We expect 400 or 401 or 503 depending on DB state, but NOT 429
        assert response.status_code != 429

    # The 6th request should be rate limited
    response = client.post('/auth/login', json={
        "email": "test@test.com",
        "password": "password"
    })
    
    # Debug info
    if response.status_code != 429:
        print(f"FAILED: Expected 429, got {response.status_code}")
        print(response.get_json())
        
    assert response.status_code == 429
    assert b"429 Too Many Requests" in response.data or b"Too Many Requests" in response.data

def test_register_rate_limit(client):
    """Test that register endpoint is rate limited to 3 per 10 minutes"""
    # 3 requests pass
    for _ in range(3):
        response = client.post('/auth/register', json={
            "email": "test@test.com",
            "password": "password",
            "username": "testuser",
            "name": "Test User"
        })
        assert response.status_code != 429

    # The 4th request should be rate limited
    response = client.post('/auth/register', json={
        "email": "test@test.com",
        "password": "password",
        "username": "testuser",
        "name": "Test User"
    })
    assert response.status_code == 429
