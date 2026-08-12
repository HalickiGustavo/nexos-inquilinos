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

def send_v7():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    bot_id = "6a7a08c77d60b5f329092325"
    phone = "5541987771358"
    template_id = "6a7a09f89cb5c31a7307c9ed"
    
    # Tentando via /whatsapp/contacts/send
    url = "https://api.sendpulse.com/whatsapp/contacts/send"
    
    # Primeiro, garantir que o contato existe ou buscar o contact_id
    search_url = f"https://api.sendpulse.com/whatsapp/contacts/search?bot_id={bot_id}&phone={phone}"
    search_res = requests.get(search_url, headers=headers)
    search_data = search_res.json()
    
    contact_id = None
    if search_data.get("success") and search_data.get("data"):
        contact_id = search_data["data"]["id"]
        print(f"Found existing contact: {contact_id}")
    else:
        # Criar contato
        print("Contact not found, creating...")
        create_url = "https://api.sendpulse.com/whatsapp/contacts"
        create_payload = {"bot_id": bot_id, "phone": phone}
        create_res = requests.post(create_url, json=create_payload, headers=headers)
        create_data = create_res.json()
        if create_data.get("success"):
            contact_id = create_data["data"]["id"]
            print(f"Created contact: {contact_id}")
        else:
            print(f"Failed to create contact: {create_res.text}")
            return

    # Agora sim, enviar template usando o contact_id
    payload = {
        "contact_id": contact_id,
        "template_id": template_id
    }
    
    print(f"Sending template via /whatsapp/contacts/send...")
    res = requests.post(url, json=payload, headers=headers)
    print(f"Status: {res.status_code}")
    print(res.text)

if __name__ == "__main__":
    send_v7()
