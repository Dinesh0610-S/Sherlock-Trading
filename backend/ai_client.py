import os
import requests
import logging

logger = logging.getLogger(__name__)

# The API key provided by the user
AI_API_KEY = os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY") or "sk-5726a00b40ee4cb5bfe2b0a8cf4b1e01"

def call_llm(prompt: str, system_prompt: str = None, temperature: float = 0.7, timeout: int = 10) -> str:
    """
    Calls DeepSeek API if a key is available; otherwise falls back to local Ollama (llama3:8b).
    """
    if AI_API_KEY and not AI_API_KEY.startswith("your-key-here") and AI_API_KEY != "":
        # Try DeepSeek Chat completions
        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Authorization": f"Bearer {AI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Use system prompt if provided
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        else:
            messages.append({
                "role": "system", 
                "content": "You are Sherlock Holmes, the legendary observant detective, applying your cold, analytical deductive reasoning to financial market setups. Watson is your partner. Reply in character, with rigorous logical reasoning and Victorian flavor."
            })
        
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": temperature,
            "stream": False
        }
        try:
            logger.info("Calling DeepSeek Cloud API...")
            resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                result = resp.json()
                content = result["choices"][0]["message"]["content"].strip()
                logger.info("DeepSeek Cloud API call succeeded.")
                return content
            else:
                logger.warning(f"DeepSeek API returned error code {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"DeepSeek Cloud API request failed: {e}. Falling back to Ollama...")

    # Fallback to local Ollama llama3:8b
    try:
        logger.info("Attempting local Ollama API call...")
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": "llama3:8b",
            "prompt": prompt,
            "stream": False
        }
        if system_prompt:
            payload["system"] = system_prompt
            
        resp = requests.post(url, json=payload, timeout=timeout)
        if resp.status_code == 200:
            result = resp.json()
            content = result.get("response", "").strip()
            logger.info("Local Ollama API call succeeded.")
            return content
        else:
            logger.warning(f"Ollama returned status code {resp.status_code}")
    except Exception as e:
        logger.warning(f"Local Ollama API call failed: {e}")

    # If both fail, raise RuntimeError
    raise RuntimeError("Both DeepSeek API and local Ollama failed.")
