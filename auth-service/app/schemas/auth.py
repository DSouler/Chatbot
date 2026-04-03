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


# ── Admin schemas ──

class AdminUserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    position_id: Optional[int] = None
    position_name: Optional[str] = None
    role: Optional[str] = None
    status: str = 'active'
    is_ldap_user: bool = False
    last_login: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class AdminCreateUserRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "USER"


class AdminUpdateUserRequest(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None


class AdminUpdateStatusRequest(BaseModel):
    status: str  # 'active' | 'blocked'