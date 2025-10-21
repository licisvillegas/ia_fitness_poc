#!/usr/bin/env python
"""
Herramienta CLI para validar que el endpoint /get_progress/<user_id> responda con datos correctos.

Ejemplos:
    python scripts/validate_progress_api.py --user usr_001
    python scripts/validate_progress_api.py --base-url http://localhost:5001 --user usr_002
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, Iterable
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


REQUIRED_KEYS = ("date", "weight_kg", "body_fat", "performance", "nutrition_adherence")


def fetch_progress(base_url: str, user_id: str) -> Iterable[Dict[str, Any]]:
    """Realiza la petición GET al backend y devuelve la respuesta parseada."""
    url = f"{base_url.rstrip('/')}/get_progress/{user_id}"
    try:
        with urlopen(url, timeout=10) as resp:
            data = json.load(resp)
            return data
    except HTTPError as exc:
        raise RuntimeError(f"El servidor devolvió un error HTTP {exc.code}: {exc.reason}") from exc
    except URLError as exc:
        raise RuntimeError(f"No se pudo conectar al backend en {url}: {exc.reason}") from exc


def validate_record(record: Dict[str, Any]) -> None:
    """Valida la estructura mínima de cada registro."""
    missing = [key for key in REQUIRED_KEYS if key not in record]
    if missing:
        raise ValueError(f"Faltan campos obligatorios {missing} en el registro: {record}")

    if not isinstance(record["date"], str):
        raise ValueError(f"El campo 'date' debe ser string, recibido {type(record['date'])}")
    for numeric_key in ("weight_kg", "body_fat", "performance", "nutrition_adherence"):
        if not isinstance(record[numeric_key], (int, float)):
            raise ValueError(
                f"El campo '{numeric_key}' debe ser numérico, recibido {record[numeric_key]!r}"
            )


def summarize(records: Iterable[Dict[str, Any]]) -> str:
    """Genera un resumen simple de los datos recuperados."""
    records = list(records)
    if not records:
        return "Sin registros disponibles."
    last = records[-1]
    resumen = (
        f"{len(records)} registros. Último: fecha={last['date']}, "
        f"peso={last['weight_kg']}kg, grasa={last['body_fat']}%, "
        f"rendimiento={last['performance']}%, adherencia={last['nutrition_adherence']}%"
    )
    return resumen


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Valida la respuesta del endpoint /get_progress/<user_id>."
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("AI_FITNESS_BASE_URL", "http://127.0.0.1:5000"),
        help="URL base del backend Flask (por defecto http://127.0.0.1:5000 o variable AI_FITNESS_BASE_URL).",
    )
    parser.add_argument("--user", required=True, help="ID de usuario a consultar, ej. usr_001.")
    args = parser.parse_args()

    try:
        records = fetch_progress(args.base_url, args.user)
        for record in records:
            validate_record(record)

        print(f"[OK] Progreso para {args.user}: {summarize(records)}")
        return 0
    except Exception as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

