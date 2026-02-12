from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal

class ExerciseSearchQuery(BaseModel):
    q: Optional[str] = ""
    limit: Optional[int] = Field(50, ge=1, le=1000)
    page: Optional[int] = Field(1, ge=1)
    body_part: Optional[str] = ""
    equipment: Optional[str] = ""
    type: Optional[str] = ""
    sort: Optional[str] = "name"
    order: Optional[Literal["asc", "desc"]] = "asc"
    incomplete: Optional[bool] = False
    section: Optional[str] = None
    group: Optional[str] = None
    muscle: Optional[str] = None

    @field_validator('incomplete', mode='before')
    @classmethod
    def parse_bool(cls, v):
        if isinstance(v, str):
            return v.lower() == 'true'
        return v

class ExerciseFilterQuery(BaseModel):
    muscles: Optional[str] = ""
    equipment: Optional[str] = ""
    q: Optional[str] = ""
    limit: Optional[int] = Field(50, ge=1, le=200)
