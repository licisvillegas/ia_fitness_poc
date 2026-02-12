from pydantic import BaseModel, Field
from typing import List, Optional

class RoutineAssignmentRequest(BaseModel):
    user_id: str
    routine_id: str
    valid_days: int = Field(..., ge=1)

class RoutineItem(BaseModel):
    exercise_id: str
    series: int = Field(..., ge=1)
    reps: str
    rest: Optional[int] = 0
    notes: Optional[str] = ""

class RoutineSaveRequest(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1)
    description: Optional[str] = ""
    routine_day: Optional[str] = ""
    routine_body_parts: List[str] = []
    items: List[dict] = [] # Manual items structure is complex, using dict for now
