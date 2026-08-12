import os
import requests
import json
import time

def get_token():
    client_id = os.environ.get("SENDPULSE_CLIENT_ID")
    client_secret = os.environ.get("SENDPULSE_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("Missing SendPulse credentials")
        return None
        
    url = "https://api.sendpulse.com/oauth/access_token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json().get("access_token")
    except Exception as e:
        print(f"Error getting token: {e}")
        return None

def send_template_v4():
    token = get_token()
    if not token:
        return
        
    sender_id = os.environ.get("SENDPULSE_SENDER_ID", "").strip()
    phone = "5541987771358"
    template_id = "6a7a09f89cb5c31a7307c9ed" # template 'test'
    
    # Tentando o endpoint /whatsapp/messages/send
    url = "https://api.sendpulse.com/whatsapp/messages/send"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "address": phone,
        "sender": sender_id,
        "template": {
            "id": template_id,
            "check_status": True
        }
    }
    
    print(f"Attempting to send template {template_id} to {phone} using sender {sender_id}...")
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    send_template_v4()
