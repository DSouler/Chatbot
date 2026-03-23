# Auth Service

FastAPI authentication service với kiến trúc 3-layer (Controller-Service-Repository) và tích hợp LDAP authentication.

## Cấu trúc dự án

```
auth-service/
├── app/
│   ├── controllers/          # Controllers (Routers) - Định nghĩa endpoints
│   │   ├── __init__.py
│   │   └── auth_controller.py
│   ├── services/             # Services - Xử lý logic nghiệp vụ
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   └── ldap_auth.py
│   ├── repositories/         # Repositories - Tương tác với database
│   │   ├── __init__.py
│   │   └── user_repository.py
│   ├── models/               # SQLAlchemy models
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/              # Pydantic schemas
│   │   ├── __init__.py
│   │   └── auth.py
│   ├── __init__.py
│   ├── config.py             # Cấu hình ứng dụng
│   ├── database.py           # Cấu hình database
│   └── dependencies.py       # Dependencies chung
├── main.py                   # Entry point
├── requirements.txt          # Dependencies
├── init.sql                  # Database schema
└── env.example               # Environment variables example
```

## Cài đặt

1. Cài đặt dependencies:
```bash
pip install -r requirements.txt
```

2. Tạo file `.env` từ `env.example`:
```bash
cp env.example .env
```

3. Cấu hình database và LDAP trong file `.env`

4. Chạy database migrations (nếu cần):
```bash
# Tạo database và chạy init.sql
```

## Chạy ứng dụng

```bash
# Development
uvicorn main:app --reload

# Production
python main.py
```

## API Endpoints

### Authentication

#### POST /login
Đăng nhập và nhận JWT token (hỗ trợ cả LDAP và local authentication)

**Request Body:**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user_id": 1,
  "username": "your_username",
  "first_name": "John",
  "last_name": "Doe",
  "department_id": 1,
  "position_id": 1
}
```

### Health Check

#### GET /
Kiểm tra trạng thái service

#### GET /health
Health check endpoint

## Luồng Authentication

### 1. LDAP Authentication (Ưu tiên)
1. User gửi username/password
2. Hệ thống tìm kiếm user trong LDAP directory
3. Xác thực credentials với LDAP server
4. Nếu thành công:
   - Tạo hoặc cập nhật user trong local database
   - Lưu thông tin LDAP (DN, email, groups, etc.)
   - Tạo JWT token
5. Nếu thất bại: Chuyển sang local authentication

### 2. Local Authentication (Fallback)
1. Tìm user trong local database
2. Xác thực password (cho non-LDAP users)
3. Tạo JWT token

## Kiến trúc 3-Layer

### 1. Controllers (Routers)
- Định nghĩa các HTTP endpoints
- Xử lý request/response
- Validation input data
- Gọi services để xử lý logic

### 2. Services
- **AuthService**: Xử lý authentication logic, JWT tokens
- **LDAPAuth**: Tương tác với LDAP server
- Chứa business logic
- Gọi repositories để truy xuất data

### 3. Repositories
- Tương tác trực tiếp với database
- CRUD operations
- User synchronization với LDAP
- Query optimization

## JWT Authentication

Service sử dụng JWT (JSON Web Tokens) cho authentication:

- **Secret Key**: Cấu hình trong `.env`
- **Algorithm**: HS256
- **Expiration**: 30 phút (có thể cấu hình)

## Database Schema

Sử dụng PostgreSQL với schema từ `init.sql`. Các bảng chính:
- `users`: Thông tin người dùng (bao gồm LDAP info)
- `departments`: Phòng ban
- `positions`: Chức vụ
- `companies`: Công ty

### User Model Extensions
- `email`: Email từ LDAP
- `ldap_dn`: LDAP Distinguished Name
- `is_ldap_user`: Flag xác định user từ LDAP
- `last_login`: Timestamp lần đăng nhập cuối

## LDAP Configuration

Cấu hình LDAP trong file `.env`:

```env
LDAP_SERVER_URL=ldap://your-ldap-server.com:389
LDAP_BASE_DN=dc=example,dc=com
LDAP_USER_SEARCH_BASE=ou=users,dc=example,dc=com
LDAP_BIND_DN=cn=service_account,ou=service_accounts,dc=example,dc=com
LDAP_BIND_PASSWORD=your-service-account-password
LDAP_AUTH_TYPE=SIMPLE
LDAP_USE_SSL=false
```

## Development

### Thêm endpoint mới

1. Tạo schema trong `app/schemas/`
2. Tạo repository method trong `app/repositories/`
3. Tạo service method trong `app/services/`
4. Tạo controller endpoint trong `app/controllers/`
5. Include router trong `main.py`

### Testing

```bash
# Test với curl
curl -X POST "http://localhost:8000/login" \
     -H "Content-Type: application/json" \
     -d '{"username": "test_user", "password": "password123"}'
```

## Notes

- LDAP authentication được ưu tiên trước local authentication
- User từ LDAP sẽ được tự động tạo/cập nhật trong local database
- JWT token được tạo dựa trên thông tin từ local database
- Cần cấu hình đúng LDAP settings trước khi sử dụng
- Có thể mở rộng để sync thêm thông tin từ LDAP (groups, roles, etc.)
