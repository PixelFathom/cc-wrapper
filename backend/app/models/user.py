from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from app.models.base import BaseModel


class UserBase(SQLModel):
    """Base user model with shared attributes"""
    username: str = Field(unique=True, index=True, min_length=3, max_length=50)
    email: Optional[str] = Field(default=None, unique=True, index=True)
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)


class User(UserBase, BaseModel, table=True):
    """User database model"""
    __tablename__ = "users"
    
    hashed_password: str = Field(min_length=1)
    last_login: Optional[datetime] = Field(default=None)


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(min_length=4, max_length=100)


class UserRead(UserBase):
    """Schema for reading user data"""
    id: str
    created_at: datetime
    last_login: Optional[datetime] = None


class UserUpdate(SQLModel):
    """Schema for updating user data"""
    email: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=4, max_length=100)