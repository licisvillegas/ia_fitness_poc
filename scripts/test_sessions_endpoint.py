"""
Test directo del endpoint /api/workout/sessions
"""
import requests

# Test 1: Sin autenticación
print("=" * 60)
print("TEST 1: Llamada sin cookies (debería devolver [])")
print("=" * 60)
try:
    response = requests.get("http://localhost:5000/api/workout/sessions")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Con user_id en query params
print("\n" + "=" * 60)
print("TEST 2: Con user_id en query params")
print("=" * 60)
try:
    # Usar el user_id que vimos en los logs
    response = requests.get("http://localhost:5000/api/workout/sessions?user_id=6931cf1adeba6b26a5")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")

# Test 3: Verificar que la ruta existe
print("\n" + "=" * 60)
print("TEST 3: Listar todas las rutas registradas")
print("=" * 60)
try:
    # Esto solo funcionará si agregamos un endpoint de debug
    response = requests.get("http://localhost:5000/")
    print(f"Homepage Status: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
