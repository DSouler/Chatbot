from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_id: int
    position_id: int
    role: str

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None 