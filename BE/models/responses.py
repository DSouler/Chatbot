from pydantic import BaseModel
from typing import Dict, List, Optional, Any


class QueryResponse(BaseModel):
    answer: str
    sources: Optional[List[Dict[str, Any]]] = None



