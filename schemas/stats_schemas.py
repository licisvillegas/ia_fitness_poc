from pydantic import BaseModel, Field
from typing import List, Optional

class SaveRMRecordRequest(BaseModel):
    weight: float = Field(..., gt=0)
    reps: int = Field(..., gt=0)
    exercise: str = Field(..., min_length=1)
    date: str
    one_rm: float
    unit: Optional[str] = ""
    formulas: List[str] = []

class SaveAdherenceConfigRequest(BaseModel):
    target_frequency: int = Field(..., ge=1, le=7)
