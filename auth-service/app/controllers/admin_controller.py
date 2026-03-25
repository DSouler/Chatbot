from fastapi import APIRouter, Depends
from app.services.auth_service import AuthService
from app.schemas.auth import (
    TokenData, AdminUserResponse, AdminCreateUserRequest,
    AdminUpdateUserRequest,
)
from app.dependencies import require_admin, get_auth_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _user_to_response(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "department_id": user.department_id,
        "department_name": user.department.department_name if user.department else None,
        "position_id": user.position_id,
        "position_name": user.position.position_name if user.position else None,
        "role": user.role,
        "is_ldap_user": user.is_ldap_user or False,
        "last_login": str(user.last_login) if user.last_login else None,
        "created_at": str(user.created_at) if user.created_at else None,
    }


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    _admin: TokenData = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
):
    """List all users (admin only)"""
    users = auth_service.get_all_users()
    return [_user_to_response(u) for u in users]


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: int,
    _admin: TokenData = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Get a single user by ID (admin only)"""
    user = auth_service.get_user_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return _user_to_response(user)


@router.post("/users", response_model=AdminUserResponse, status_code=201)
def create_user(
    req: AdminCreateUserRequest,
    _admin: TokenData = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Create a new user (admin only)"""
    user = auth_service.admin_create_user(req)
    return _user_to_response(user)


@router.put("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: int,
    req: AdminUpdateUserRequest,
    _admin: TokenData = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Update a user (admin only)"""
    user = auth_service.admin_update_user(user_id, req)
    return _user_to_response(user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    _admin: TokenData = Depends(require_admin),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Delete a user (admin only)"""
    auth_service.admin_delete_user(user_id)
    return {"message": "Xóa người dùng thành công"}
