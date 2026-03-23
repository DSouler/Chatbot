from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import AuthService
from app.services.ldap_auth import LDAPAuth
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenData

security = HTTPBearer()

# Dependency for UserRepository
def get_user_repository(db: Session = Depends(get_db)) -> UserRepository:
    """Get UserRepository instance"""
    return UserRepository(db)

# Dependency for LDAPAuth (singleton)
_ldap_auth_instance = None

def get_ldap_auth() -> LDAPAuth:
    """Get LDAPAuth singleton instance"""
    global _ldap_auth_instance
    if _ldap_auth_instance is None:
        _ldap_auth_instance = LDAPAuth()
    return _ldap_auth_instance

# Dependency for AuthService
def get_auth_service(
    db: Session = Depends(get_db),
    user_repository: UserRepository = Depends(get_user_repository),
    ldap_auth: LDAPAuth = Depends(get_ldap_auth)
) -> AuthService:
    """Get AuthService instance with dependencies"""
    return AuthService(db, user_repository, ldap_auth)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenData:
    """Get current authenticated user from JWT token"""
    token_data = auth_service.verify_token(credentials.credentials)
    
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token_data 