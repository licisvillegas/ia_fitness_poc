
import secrets

print("🔑 Nueva SECRET_KEY generada:")
print(secrets.token_hex(32))
print("\nAgrega esta línea a tu .env:")
print(f"SECRET_KEY={secrets.token_hex(32)}")
