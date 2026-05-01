import bcrypt
from database.config import supabase


def get_user_by_username(username: str) -> dict | None:
    resp = supabase.table("users").select("*").eq("username", username).execute()
    return resp.data[0] if resp.data else None


def username_exists(username: str) -> bool:
    resp = supabase.table("users").select("user_id").eq("username", username).execute()
    return len(resp.data) > 0


def email_exists(email: str) -> bool:
    resp = supabase.table("users").select("user_id").eq("email", email).execute()
    return len(resp.data) > 0


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_user(username: str, email: str, password: str) -> dict | None:
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    try:
        resp = supabase.table("users").insert({
            "username":      username,
            "email":         email,
            "password_hash": hashed,
            "enrolled":      False,
        }).execute()
        return resp.data[0] if resp.data else None
    except Exception as e:
        err = str(e)
        if "users_username_key" in err or ("duplicate key" in err and "username" in err):
            raise ValueError("Username already taken.")
        elif "users_email" in err or ("duplicate key" in err and "email" in err):
            raise ValueError("Email already registered.")
        else:
            raise RuntimeError(f"Registration error: {err}")


def mark_enrolled(user_id: str) -> None:
    supabase.table("users").update({"enrolled": True}).eq("user_id", user_id).execute()
