from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, LoginResponse, TokenData, RegisterRequest
from app.services.ldap_auth import LDAPAuth
from app.models.user import User
# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    def __init__(self, db: Session, user_repository: UserRepository, ldap_auth: LDAPAuth):
        self.db = db
        self.user_repository = user_repository
        self.ldap_auth = ldap_auth
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash password"""
        return pwd_context.hash(password)
    
    def authenticate_user_ldap(self, username: str, password: str):
        """Authenticate user with LDAP and sync to local database"""
        try:
            # Authenticate with LDAP
            ldap_user_data = self.ldap_auth.authenticate(username, password)
            
            if not ldap_user_data:
                return None
            
            # Create or update user in local database
            user = self.user_repository.create_or_update_ldap_user(ldap_user_data)
            
            return user
            
        except Exception as e:
            # Log the error but don't expose LDAP details to client
            print(f"LDAP authentication error: {e}")
            return None
    
    def authenticate_user_local(self, username: str, password: str):
        """Authenticate user against local database password hash"""
        user = self.user_repository.get_user_by_username(username)
        if not user or not user.password_hash:
            return None
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    def authenticate_user(self, username: str, password: str):
        """Main authentication method - tries LDAP first, then local database"""
        user = self.authenticate_user_ldap(username, password)
        if user:
            return user
        return self.authenticate_user_local(username, password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify JWT token and return token data"""
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            username: str = payload.get("sub")
            user_id: int = payload.get("user_id")
            
            if username is None or user_id is None:
                return None
            
            return TokenData(username=username, user_id=user_id)
        except JWTError:
            return None
    
    def login(self, login_request: LoginRequest) -> LoginResponse:
        """Handle user login with LDAP or local authentication"""
        user = self.authenticate_user(login_request.username, login_request.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Update last login timestamp
        self.user_repository.update_last_login(user.id)
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = self.create_access_token(
            data={"sub": user.username, "user_id": user.id}, 
            expires_delta=access_token_expires
        )
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            department_id=user.department_id,
            position_id=user.position_id,
            role=user.role
        ) 
    
    def get_user_by_id(self, user_id: int) -> User:
        """Get user by ID"""
        return self.user_repository.get_user_by_id(user_id)

    def register_user(self, register_request: RegisterRequest) -> User:
        """Register a new local user"""
        if self.user_repository.get_user_by_username(register_request.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên tài khoản đã tồn tại"
            )
        if register_request.email and self.user_repository.get_user_by_email(register_request.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã được sử dụng"
            )
        password_hash = self.get_password_hash(register_request.password)
        return self.user_repository.create_local_user(
            username=register_request.username,
            password_hash=password_hash,
            email=register_request.email
        )