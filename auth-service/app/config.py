from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/auth_db"
    
    # JWT
    secret_key: str = "your-secret-key-here"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # LDAP Configuration
    ldap_server_url: str = ""
    ldap_base_dn: str = ""
    ldap_user_search_base: str = ""
    ldap_bind_dn: str = ""
    ldap_bind_password: str = ""
    ldap_auth_type: str = "SIMPLE"
    ldap_use_ssl: bool = False
    
    # App
    app_name: str = "Auth Service"
    debug: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings() 