from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class RegisterResponse(BaseModel):
    message: str
    username: str
    user_id: int

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_id: Optional[int] = None
    position_id: Optional[int] = None
    role: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None

class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password: str