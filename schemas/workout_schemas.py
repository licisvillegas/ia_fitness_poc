from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class StartSessionRequest(BaseModel):
    routine_id: str

class UpdateProgressRequest(BaseModel):
    cursor: int = Field(0, ge=0)
    session_log: List[dict] = []
    unit: Optional[str] = "lb"

class WorkoutSet(BaseModel):
    exercise_id: str
    weight: float = 0.0
    reps: int = 0
    rest: int = 0

class SaveSessionRequest(BaseModel):
    routine_id: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    sets: List[dict] = [] # Structure can be complex, using dict for now
