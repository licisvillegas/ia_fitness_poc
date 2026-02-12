from pydantic import BaseModel
from typing import Dict, Any, Optional

class BodyAssessmentRecordRequest(BaseModel):
    input: Dict[str, Any]
    output: Dict[str, Any]
    backend: Optional[str] = "unknown"
