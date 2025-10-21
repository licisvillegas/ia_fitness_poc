#!/usr/bin/env python
"""
Utility to validate whether an email or username is already registered in MongoDB.

Usage:
    python scripts/validate_user.py --email someone@example.com
    python scripts/validate_user.py --username myuser
    python scripts/validate_user.py --email someone@example.com --username myuser
"""

import argparse
import os
import sys

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient


def get_database():
    """Create a MongoDB client using environment variables and return the database."""
    load_dotenv()

    mongo_uri = os.getenv("MONGO_URI")
    mongo_db = os.getenv("MONGO_DB")

    if not mongo_uri or not mongo_db:
        raise RuntimeError(
            "Variables de entorno MONGO_URI y MONGO_DB son requeridas para la conexión."
        )

    client = MongoClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=20000,
    )
    return client[mongo_db]


def check_availability(db, email=None, username=None, verbose=False):
    """Return availability status for the provided email/username."""
    result = {}

    if email:
        email_norm = email.strip().lower()
        exists = db.users.find_one({"email": email_norm}, {"user_id": 1})
        result["email"] = {
            "value": email_norm,
            "available": exists is None,
        }
        if verbose and exists:
            result["email"]["message"] = "El correo ya está registrado."

    if username:
        username_norm = username.strip()
        exists = db.users.find_one({"username_lower": username_norm.lower()}, {"user_id": 1})
        result["username"] = {
            "value": username_norm,
            "available": exists is None,
        }
        if verbose and exists:
            result["username"]["message"] = "El usuario ya está en uso."

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Valida disponibilidad de email y/o usuario en MongoDB."
    )
    parser.add_argument("--email", help="Correo a validar.")
    parser.add_argument("--username", help="Usuario a validar.")
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Muestra mensajes adicionales cuando ya existen registros.",
    )
    args = parser.parse_args()

    if not args.email and not args.username:
        parser.error("Debes proporcionar --email, --username o ambos.")

    try:
        db = get_database()
    except Exception as exc:
        print(f"[ERROR] No se pudo conectar a MongoDB: {exc}", file=sys.stderr)
        return 1

    availability = check_availability(db, args.email, args.username, verbose=args.verbose)

    for key, info in availability.items():
        status = "disponible" if info["available"] else "NO disponible"
        line = f"{key.capitalize()}: {info['value']} -> {status}"
        if args.verbose and "message" in info:
            line += f" | {info['message']}"
        print(line)

    return 0


if __name__ == "__main__":
    sys.exit(main())

