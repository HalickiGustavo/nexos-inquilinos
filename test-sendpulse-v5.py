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

def list_and_send():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Listar bots para pegar o ID correto (sender)
    print("--- Listing Bots ---")
    bots_res = requests.get("https://api.sendpulse.com/whatsapp/bots", headers=headers)
    print(bots_res.text)
    bots_data = bots_res.json()
    
    if not bots_data.get("data"):
        print("No bots found.")
        return

    bot_id = bots_data["data"][0]["id"]
    print(f"\nUsing Bot ID: {bot_id}")

    # 2. Tentar enviar via endpoint de templates oficial
    url = "https://api.sendpulse.com/whatsapp/messages/send"
    payload = {
        "address": "5541987771358",
        "sender": bot_id,
        "template": {
            "id": "6a7a09f89cb5c31a7307c9ed"
        }
    }
    
    print(f"\n--- Sending Template ---")
    res = requests.post(url, json=payload, headers=headers)
    print(f"Status: {res.status_code}")
    print(res.text)

if __name__ == "__main__":
    list_and_send()
