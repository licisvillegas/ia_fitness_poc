import os
from enum import Enum

class AIProvider(Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    MOCK = "mock"

class AIConfig:
    @staticmethod
    def get_provider() -> AIProvider:
        # Default to OpenAI if key exists, else Mock. 
        # But if specifically set to Gemini via env var, use that.
        provider_env = os.getenv("AI_PROVIDER", "openai").lower()
        
        if provider_env == "gemini":
            return AIProvider.GEMINI
        if provider_env == "openai":
            return AIProvider.OPENAI
        return AIProvider.MOCK

    @staticmethod
    def get_model(provider: AIProvider = None) -> str:
        if not provider:
            provider = AIConfig.get_provider()
            
        if provider == AIProvider.OPENAI:
            # User mentioned "5.2", defaulting to gpt-4o as standard for "newest"
            return os.getenv("OPENAI_MODEL", "gpt-4o")
        if provider == AIProvider.GEMINI:
             # gemini-1.5-flash is a good default for speed/cost
            return os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        
        return "mock-model"

    @staticmethod
    def get_api_key(provider: AIProvider = None) -> str:
         if not provider:
            provider = AIConfig.get_provider()
            
         if provider == AIProvider.OPENAI:
             return os.getenv("OPENAI_API_KEY", "")
         if provider == AIProvider.GEMINI:
             return os.getenv("GEMINI_API_KEY", "")
         return ""
