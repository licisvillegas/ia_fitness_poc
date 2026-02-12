from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Any, Dict

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscription(BaseModel):
    endpoint: str = Field(..., min_length=1)
    keys: PushSubscriptionKeys

class SubscribeRequest(BaseModel):
    subscription: Optional[PushSubscription] = None
    endpoint: Optional[str] = None
    keys: Optional[PushSubscriptionKeys] = None

class UnsubscribeRequest(BaseModel):
    subscription: Optional[Dict[str, Any]] = None
    endpoint: Optional[str] = None

class SendPushRequest(BaseModel):
    title: Optional[str] = "Synapse Fit"
    body: str = ""
    url: str = "/"
    context: Optional[str] = None

class SchedulePushRequest(BaseModel):
    delay: float = Field(..., gt=0)
    title: str = "Timer Finished"
    body: str = "Time is up!"
    url: str = "/"
    context: Optional[str] = None
    visibility: Optional[str] = None
    display_mode: Optional[str] = None

class CancelPushRequest(BaseModel):
    task_id: str

class ClientLogRequest(BaseModel):
    message: str = "No message"
    level: str = "INFO"
