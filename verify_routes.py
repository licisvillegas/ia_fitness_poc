from app import create_app

app = create_app()
with open("routes.txt", "w") as f:
    for rule in app.url_map.iter_rules():
        f.write(f"{rule} -> {rule.endpoint}\n")

