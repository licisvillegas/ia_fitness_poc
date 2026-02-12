from pydantic import BaseModel
from typing import Optional

class MarkReadRequest(BaseModel):
    notification_id: Optional[str] = None
    all: Optional[bool] = False
