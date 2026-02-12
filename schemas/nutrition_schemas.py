from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class GenerateMealPlanRequest(BaseModel):
    user_id: str
    meals_per_day: Optional[int] = Field(None, ge=3, le=6)
    preferences: Optional[str] = ""

class SaveMealPlanRequest(BaseModel):
    user_id: str
    output: Dict[str, Any]
    input: Optional[Dict[str, Any]] = {}
    backend: Optional[str] = "unknown"

class EditMealPlanRequest(BaseModel):
    notes: Optional[str] = None
    output: Optional[Dict[str, Any]] = None
    input: Optional[Dict[str, Any]] = None
    plan_id: Optional[str] = None
