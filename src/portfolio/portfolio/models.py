"""Request models for PortfolioFn."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

Goal = Annotated[str, Field(min_length=1, max_length=200)]


class Profile(BaseModel):
    age: int = Field(ge=13, le=120)
    horizon: Literal["short", "medium", "long"]
    goals: list[Goal] = Field(default_factory=list, max_length=10)
    riskTolerance: Literal["low", "medium", "high"]


class ExchangeRequest(BaseModel):
    publicToken: str = Field(min_length=1)
