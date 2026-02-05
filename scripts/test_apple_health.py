import requests
import json

url = "http://127.0.0.1:5000/api/integrations/apple-health"

# ID de usuario simulado (usamos uno existente del proyecto si es posible, o uno fake)
# De los logs anteriores vi: user_id=6931cf1adeba6b26a5fb524e
user_id = "6931cf1adeba6b26a5fb524e" 

payload = {
    "user_id": user_id,
    "metrics": {
        "steps": 5432,
        "active_energy": 320.5,
        "heart_rate_avg": 80
    },
    "source": "apple_health_shortcut_test"
}

try:
    print(f"Enviando datos a {url}...")
    response = requests.post(url, json=payload)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
    
    if response.status_code == 201:
        print("✅ Prueba Exitosa!")
    else:
        print("❌ Prueba Fallida")

except Exception as e:
    print(f"❌ Error de conexión: {e}")
