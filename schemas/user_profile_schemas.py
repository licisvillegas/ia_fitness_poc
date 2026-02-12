from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class ProfileSaveRequest(BaseModel):
    name: Optional[str] = None
    sex: Optional[Literal["male", "female", "other"]] = None
    birth_date: Optional[str] = None
    phone: Optional[str] = None

class SimulatePaymentRequest(BaseModel):
    product: Optional[str] = None
    plan: Optional[str] = None
