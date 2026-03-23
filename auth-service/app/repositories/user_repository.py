from sqlalchemy.orm import Session
from app.models.user import User, Department, Company, Position
from typing import Optional
from datetime import datetime
import re

class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.db.query(User).filter(User.username == username).first()
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_user_by_ldap_dn(self, ldap_dn: str) -> Optional[User]:
        """Get user by LDAP DN"""
        return self.db.query(User).filter(User.ldap_dn == ldap_dn).first()
    
    def get_company_by_name(self, company_name: str) -> Optional[Company]:
        """Get company by name"""
        return self.db.query(Company).filter(Company.company_name == company_name).first()
    
    def get_department_by_name(self, department_name: str) -> Optional[Department]:
        """Get department by name"""
        return self.db.query(Department).filter(Department.department_name == department_name).first()
    
    def create_user(self, user: User) -> User:
        """Create new user"""
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def update_user(self, user: User) -> User:
        """Update existing user"""
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_profile(self, user_id: int, first_name: str, last_name: str) -> Optional[User]:
        """Update user display name"""
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        user.first_name = first_name
        user.last_name = last_name
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_password(self, user_id: int, new_password_hash: str) -> Optional[User]:
        """Update user password hash"""
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        user.password_hash = new_password_hash
        user.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def update_last_login(self, user_id: int) -> None:
        """Update user's last login timestamp"""
        user = self.get_user_by_id(user_id)
        if user:
            user.last_login = datetime.utcnow()
            self.db.commit()
    
    def extract_company_and_department(self, common_name: str) -> tuple[str, str]:
        """Extract company and department from common name like 'THANG Nguyen Duc 1 (VTI.D3)'"""
        # Extract text inside parentheses
        match = re.search(r'\(([^)]+)\)', common_name)
        if match:
            company_dept = match.group(1)  # 'VTI.D3'
            # Split by dot to get company and department
            parts = company_dept.split('.')
            if len(parts) >= 2:
                company_name = parts[0]  # 'VTI'
                department_name = '.'.join(parts[1:])  # 'D3'
                return company_name, department_name
        return None, None
    
    def get_or_create_company(self, company_name: str) -> Company:
        """Get existing company or create new one"""
        company = self.get_company_by_name(company_name)
        if not company:
            # Create new company
            company = Company(
                company_name=company_name,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.db.add(company)
            self.db.commit()
            self.db.refresh(company)
        return company
    
    def get_or_create_department(self, department_name: str, company_id: int) -> Department:
        """Get existing department or create new one"""
        department = self.get_department_by_name(department_name)
        if not department:
            # Create new department
            department = Department(
                department_name=department_name,
                company_id=company_id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.db.add(department)
            self.db.commit()
            self.db.refresh(department)
        return department
    
    def create_or_update_ldap_user(self, ldap_user_data: dict) -> User:
        """Create new LDAP user or update existing one"""

        # Try to find existing user by LDAP DN first

        user = self.get_user_by_email(ldap_user_data.get('email'))
        
        if user:
            # Update existing user with LDAP information
            user.is_ldap_user = True
            user.ldap_dn = ldap_user_data.get('dn')
            user.first_name = ldap_user_data.get('common_name', '').split()[0] if ldap_user_data.get('common_name') else user.first_name
            user.last_name = ' '.join(ldap_user_data.get('common_name', '').split()[1:]) if ldap_user_data.get('common_name') and len(ldap_user_data.get('common_name', '').split()) > 1 else user.last_name
            user.last_login = datetime.utcnow()
            self.update_user(user)
        else:
            # Create new LDAP user
            # Extract company and department from common_name
            common_name = ldap_user_data.get('common_name', '')
            company_name, department_name = self.extract_company_and_department(common_name)
            
            # Get or create company
            company = None
            if company_name:
                company = self.get_or_create_company(company_name)
                print(f"Company: {company}")
            
            # Get or create department
            department = None
            if department_name and company:
                department = self.get_or_create_department(department_name, company.company_id)
                print(f"Department: {department}")
            
            
            position_id = 2  # Default là Nhân viên chính thức, lúc phân quyền thì admin phân lại
            
            print(f"Creating user with company: {company_name}, department: {department_name}")
            print(f"Company ID: {company.company_id if company else None}, Department ID: {department.department_id if department else None}")
            
            user = User(
                username=ldap_user_data.get('username'),
                email=ldap_user_data.get('email'),
                role="USER",
                ldap_dn=ldap_user_data.get('dn'),
                is_ldap_user=True,
                first_name=ldap_user_data.get('common_name', '').split()[0] if ldap_user_data.get('common_name') else '',
                last_name=' '.join(ldap_user_data.get('common_name', '').split()[1:]) if ldap_user_data.get('common_name') and len(ldap_user_data.get('common_name', '').split()) > 1 else '',
                department_id=department.department_id,
                position_id=position_id,
                last_login=datetime.utcnow()
            )
            self.create_user(user)
        
        return user

    def get_or_create_default_position(self) -> Position:
        """Get first position or create a default 'User' position"""
        position = self.db.query(Position).first()
        if not position:
            position = Position(position_name="User", level=1)
            self.db.add(position)
            self.db.commit()
            self.db.refresh(position)
        return position

    def create_local_user(self, username: str, password_hash: str, email: Optional[str] = None) -> User:
        """Create a new local (non-LDAP) user"""
        position = self.get_or_create_default_position()
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            role="USER",
            is_ldap_user=False,
            position_id=position.id,
        )
        return self.create_user(user)