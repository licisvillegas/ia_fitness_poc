from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from enum import Enum

class FitnessGoal(str, Enum):
    FAT_LOSS = "fat_loss"
    MUSCLE_GAIN = "muscle_gain"
    MAINTENANCE = "maintenance"
    STRENGTH = "strength"

class ExperienceLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

class TrainingLocation(str, Enum):
    GYM = "gym"
    HOME_BASIC = "home_basic"
    HOME_BODYWEIGHT = "home_bodyweight"
    PARK = "park"

class SessionDuration(str, Enum):
    MIN_30 = "30_min"
    MIN_45 = "45_min"
    MIN_60 = "60_min"
    MIN_90 = "90_min"

class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHTLY_ACTIVE = "lightly_active"
    MODERATELY_ACTIVE = "moderately_active"
    VERY_ACTIVE = "very_active"
    EXTRA_ACTIVE = "extra_active"

class InjuryType(str, Enum):
    NONE = "none"
    KNEE = "knee"
    LOWER_BACK = "lower_back"
    SHOULDER = "shoulder"
    WRIST = "wrist"
    OTHER = "other"

class OnboardingSubmission(BaseModel):
    fitness_goal: FitnessGoal
    experience_level: ExperienceLevel
    training_location: TrainingLocation
    days_available: int = Field(..., ge=1, le=7)
    session_duration: SessionDuration
    preferred_time: Optional[str] = None
    activity_level: ActivityLevel
    injuries: List[InjuryType] = Field(default_factory=lambda: [InjuryType.NONE])
    injuries_details: Optional[str] = None
    habits: Optional[List[str]] = []
    meals_per_day: int = Field(..., ge=2, le=6) 
    allergies_intolerances: Optional[List[str]] = []
    disliked_foods: Optional[List[str]] = []

    @field_validator('injuries_details')
    @classmethod
    def validate_injuries_details(cls, v, info):
        injuries = info.data.get('injuries', [])
        if InjuryType.OTHER in injuries and not v:
            raise ValueError('Debes especificar los detalles de tu lesión si seleccionaste "Otra".')
        return v

    class Config:
        use_enum_values = True

class ParQResponse(BaseModel):
    q_id: int
    answer: bool

class ParQSubmission(BaseModel):
    responses: List[ParQResponse]
