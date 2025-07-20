from pydantic import BaseModel
from uuid import UUID


class FileUpload(BaseModel):
    org_name: str
    cwd: str