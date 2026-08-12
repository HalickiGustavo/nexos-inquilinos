import os
import requests
import json

def get_token():
    client_id = os.environ.get("SENDPULSE_CLIENT_ID")
    client_secret = os.environ.get("SENDPULSE_CLIENT_SECRET")
    url = "https://api.sendpulse.com/oauth/access_token"
    payload = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}
    response = requests.post(url, json=payload)
    return response.json().get("access_token")

def send_v6():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    bot_id = "6a7a08c77d60b5f329092325"
    phone = "5541987771358"
    template_id = "6a7a09f89cb5c31a7307c9ed"
    
    # Endpoint correto baseado na doc para templates: /whatsapp/campaigns/send
    url = "https://api.sendpulse.com/whatsapp/campaigns/send"
    payload = {
        "bot_id": bot_id,
        "phone": phone,
        "template_id": template_id
    }
    
    print(f"Attempting to send via /whatsapp/campaigns/send...")
    res = requests.post(url, json=payload, headers=headers)
    print(f"Status: {res.status_code}")
    print(res.text)

if __name__ == "__main__":
    send_v6()
