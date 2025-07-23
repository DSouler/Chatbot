import aisuite as ai
import json
import os
import google.auth
import google.auth.transport.requests
from google.oauth2 import service_account
import openai
import json

# Valid provider list and corresponding environment variable names
PROVIDER_KEY_MAP = {
    "OPENAI": "OPENAI_API_KEY",
    "ANTHROPIC": "ANTHROPIC_API_KEY",
    "GOOGLE": ["GOOGLE_PROJECT_ID", "GOOGLE_REGION", "GOOGLE_APPLICATION_CREDENTIALS"],
    "AZURE": ["AZURE_API_KEY", "AZURE_BASE_URL", "AZURE_API_VERSION"]
}

def get_client(provider, **keys):
    """Initialize AI client for specified provider and api key"""
    if provider.lower() == "google":
        application_credentials = keys.get("application_credentials")

        project_id = keys.get("project_id")
        location = keys.get("region")
        
        # Programmatically get an access token
        credentials = service_account.Credentials.from_service_account_info(
            application_credentials,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        credentials.refresh(google.auth.transport.requests.Request())
        
        # OpenAI Client
        client = openai.OpenAI(
            base_url=f"https://{location}-aiplatform.googleapis.com/v1/projects/{project_id}/locations/{location}/endpoints/openapi",
            api_key=credentials.token,
        )
        return client
            
    key_names = PROVIDER_KEY_MAP[provider.upper()]
    key_names = key_names if isinstance(key_names, list) else [key_names]
    
    config = {}
    config[provider.lower()] = {}
    for key_name in key_names:
        key_name_lower = key_name.split("_", 1)[-1].lower()
        config[provider.lower()][key_name_lower] = keys.get(key_name_lower, "")

    # Check if any required keys are missing
    if any(not value for value in next(iter(config.values())).values()):
        try:
            client = ai.Client()
            return client
        except:
            raise Exception("One or more provider keys are missing or empty.")
    
    client = ai.Client(config)
    return client
