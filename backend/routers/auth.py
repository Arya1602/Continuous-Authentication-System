from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from database.db import (
    get_user_by_username, create_user,
    verify_password, username_exists, email_exists,
)

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    email:    str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(req: RegisterRequest):
    username = req.username.strip().lower()
    email    = req.email.strip().lower()

    if len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters.")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if username_exists(username):
        raise HTTPException(409, "Username already taken.")
    if email_exists(email):
        raise HTTPException(409, "Email already registered.")

    try:
        user = create_user(username, email, req.password)
    except ValueError as e:
        raise HTTPException(409, str(e))
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    return {
        "user_id":  user["user_id"],
        "username": user["username"],
        "enrolled": user["enrolled"],
    }


@router.post("/login")
def login(req: LoginRequest):
    username = req.username.strip().lower()
    user     = get_user_by_username(username)

    if not user:
        raise HTTPException(401, "Invalid username or password.")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password.")

    return {
        "user_id":  user["user_id"],
        "username": user["username"],
        "enrolled": user["enrolled"],
    }
