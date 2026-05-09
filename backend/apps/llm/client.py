"""
LLM provider abstraction — Ollama (local/primary) + OpenAI/Mistral (cloud fallback).

Settings keys:
  LLM_PROVIDER   'ollama' | 'openai' | 'mistral'   (default: 'ollama')
  LLM_MODEL      model identifier                    (provider-dependent default)
  LLM_BASE_URL   Ollama API base URL                 (default: http://localhost:11434)
  LLM_API_KEY    key for OpenAI or Mistral           (default: '')
  LLM_MAX_TOKENS maximum tokens in response          (default: 800)
  LLM_TIMEOUT    HTTP timeout in seconds             (default: 60)
"""

import logging
import requests as _requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _s(key, default=None):
    return getattr(settings, key, default)


class LLMError(Exception):
    pass


class OllamaClient:
    def __init__(self):
        self.base_url = _s('LLM_BASE_URL', 'http://localhost:11434').rstrip('/')
        self.model = _s('LLM_MODEL', 'qwen2:1.5b')
        self.timeout = _s('LLM_TIMEOUT', 60)

    @property
    def provider_name(self):
        return f'ollama/{self.model}'

    def generate(self, prompt: str, max_tokens: int = None) -> str:
        payload = {'model': self.model, 'prompt': prompt, 'stream': False}
        if max_tokens:
            payload['options'] = {'num_predict': max_tokens}
        try:
            resp = _requests.post(
                f'{self.base_url}/api/generate',
                json=payload,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return resp.json()['response'].strip()
        except Exception as exc:
            raise LLMError(f'Ollama error: {exc}') from exc


class OpenAICompatibleClient:
    """Handles both OpenAI and Mistral (Mistral's API is OpenAI-compatible)."""

    def __init__(self):
        try:
            import openai
        except ImportError as exc:
            raise LLMError(
                'openai package not installed. Run: pip install openai'
            ) from exc

        provider = _s('LLM_PROVIDER', 'openai')
        if provider == 'mistral':
            self.model = _s('LLM_MODEL', 'mistral-small-latest')
            base_url = 'https://api.mistral.ai/v1'
        elif provider == 'deepseek':
            self.model = _s('LLM_MODEL', 'deepseek-chat')
            base_url = 'https://api.deepseek.com'
        else:
            self.model = _s('LLM_MODEL', 'gpt-3.5-turbo')
            base_url = None

        self._client = openai.OpenAI(
            api_key=_s('LLM_API_KEY', ''),
            base_url=base_url,
        )
        self._provider = provider

    @property
    def provider_name(self):
        return f'{self._provider}/{self.model}'

    def generate(self, prompt: str, max_tokens: int = None) -> str:
        try:
            resp = self._client.chat.completions.create(
                model=self.model,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=max_tokens or _s('LLM_MAX_TOKENS', 800),
            )
            return resp.choices[0].message.content.strip()
        except Exception as exc:
            raise LLMError(f'{self._provider} error: {exc}') from exc


def get_llm_client():
    provider = _s('LLM_PROVIDER', 'ollama')
    if provider == 'ollama':
        return OllamaClient()
    return OpenAICompatibleClient()

