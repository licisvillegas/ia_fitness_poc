"""
Script de prueba para el agente de razonamiento.

Qué hace:
- Carga `progress.json` en la raíz del repo como contexto de ejemplo.
- Llama al `ReasoningAgent` y muestra por consola el JSON de salida con
  los ajustes recomendados y el razonamiento resumido.

Configuración:
- Si existe `OPENAI_API_KEY` (y opcionalmente `OPENAI_MODEL`), el agente intentará
  usar OpenAI. Si no hay red o falla la llamada, hace fallback al mock local.
- El mock local no requiere internet y es ideal para tests rápidos.

Uso:
- `python scripts/test_agent.py`
- Alternativamente, vía API Flask: `GET /ai/reason/sample` o `POST /ai/reason`.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(__file__))
# Insertamos al inicio para que el paquete local 'agents' tenga prioridad
# sobre cualquier paquete global con el mismo nombre.
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from ai_agents.reasoning_agent import ReasoningAgent  # noqa: E402


def main() -> None:
    # Carga el archivo de progreso que sirve como contexto de entrada.
    sample_path = os.path.join(ROOT, "progress.json")
    if not os.path.exists(sample_path):
        print("progress.json no encontrado en la raíz del repo.")
        sys.exit(1)

    with open(sample_path, "r", encoding="utf-8") as f:
        progress = json.load(f)

    payload = {"progress": progress}
    # Instancia el agente. Si no hay `OPENAI_API_KEY`, usará el backend mock.
    agent = ReasoningAgent()
    print(f"Backend activo: {agent.backend()}")
    result = agent.run(payload)
    print(json.dumps({"input": payload, "output": result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
