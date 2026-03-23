from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import LoginRequest, LoginResponse, TokenData, RegisterRequest, RegisterResponse
from app.dependencies import get_current_user, get_auth_service

router = APIRouter(tags=["authentication"])

@router.post("/login", response_model=LoginResponse)
def login(
    login_request: LoginRequest, 
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Login endpoint
    
    - **username**: User's username
    - **password**: User's password
    
    Returns JWT access token and user information
    """
    return auth_service.login(login_request)

@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(
    register_request: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Register a new local user account

    - **username**: Desired username (must be unique)
    - **password**: Password (will be hashed)
    - **email**: Optional email address
    """
    user = auth_service.register_user(register_request)
    return RegisterResponse(message="Tài khoản đã được tạo thành công", username=user.username, user_id=user.id)

@router.get("/me")
def get_current_user_info(
    current_user: TokenData = Depends(get_current_user), 
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Get current authenticated user information
    
    Requires valid JWT token in Authorization header
    """
    user = auth_service.get_user_by_id(current_user.user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "department_id": user.department_id,
        "position_id": user.position_id,
        "is_ldap_user": user.is_ldap_user,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "role": user.role
    }

@router.get("/verify")
def verify_token(current_user: TokenData = Depends(get_current_user)):
    """
    Verify JWT token validity
    
    Returns token information if valid
    """
    return {
        "valid": True,
        "user_id": current_user.user_id,
        "username": current_user.username,
        "message": "Token is valid"
    } 