def test_home_page(client):
    """Test that the home page loads."""
    response = client.get('/', follow_redirects=True)
    assert response.status_code == 200
    # The home page likely serves the auth/login UI
    assert b"Synapse Fit" in response.data or b"Login" in response.data

def test_dashboard_page(client):
    """Test that the dashboard page redirects if unauthenticated."""
    response = client.get('/dashboard')
    assert response.status_code == 302
    assert response.headers['Location'] == '/'
    
def test_health_check(client):
    """Test health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'ok'
