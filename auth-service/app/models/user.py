from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    department_id = Column(BigInteger, ForeignKey("departments.department_id"), nullable=True)
    position_id = Column(BigInteger, ForeignKey("positions.id"), nullable=False)
    first_name = Column(Text)
    last_name = Column(Text)
    username = Column(Text, unique=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(Text, nullable=True)
    role = Column(Text, nullable=True)
    ldap_dn = Column(Text, nullable=True)
    is_ldap_user = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    department = relationship("Department", back_populates="users")
    position = relationship("Position", back_populates="users")

class Department(Base):
    __tablename__ = "departments"
    
    department_id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    department_name = Column(Text, nullable=False)
    company_id = Column(BigInteger, ForeignKey("companies.company_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="department")
    company = relationship("Company", back_populates="departments")

class Position(Base):
    __tablename__ = "positions"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    position_name = Column(Text)
    level = Column(BigInteger)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="position")

class Company(Base):
    __tablename__ = "companies"
    
    company_id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    company_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    departments = relationship("Department", back_populates="company") 