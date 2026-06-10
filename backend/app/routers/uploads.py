"""Local object storage for images / receipts / design references.
Files are saved under DATA_DIR/uploads and served at /uploads/<name>."""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from .. import config
from ..auth import require_active

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", status_code=201)
async def upload(file: UploadFile, user=Depends(require_active)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in config.ALLOWED_UPLOAD_EXT:
        raise HTTPException(422, f"File type {ext or '(none)'} not allowed")
    data = await file.read()
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File larger than {config.MAX_UPLOAD_MB}MB")
    name = f"{user.id}-{uuid.uuid4().hex}{ext}"
    (config.UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"/uploads/{name}", "filename": file.filename}
