from pydantic import BaseModel, Field
from typing import Optional, Literal

class UpdateRoleRequest(BaseModel):
    user_id: str
    role: Literal['admin', 'coach', 'user']

class UpdateStatusRequest(BaseModel):
    user_id: str
    status: Literal['active', 'pending', 'inactive', 'suspended']
    observation: Optional[str] = Field(None, max_length=200)

class ImpersonateRequest(BaseModel):
    user_id: str

class UserSearchQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    search: str = ""
    status: Optional[str] = None
    filter_coach_id: Optional[str] = None

class CreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=5)
    username: str = Field(..., min_length=3)
    password: Optional[str] = None
    role: Optional[str] = "user"
    status: Optional[str] = "active"
    validity_days: Optional[int] = None
    validity_date: Optional[str] = None

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    validity_days: Optional[int] = None
    validity_date: Optional[str] = None
    generate_code: Optional[bool] = None
    own_referral_code: Optional[str] = None
    coach_id: Optional[str] = None
