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

def send_v8():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    bot_id = "6a7a08c77d60b5f329092325"
    phone = "5541987771358"
    template_id = "6a7a09f89cb5c31a7307c9ed"
    
    # Listar contatos do bot para achar o ID correto
    print("--- Listing Contacts for Bot ---")
    url_list = f"https://api.sendpulse.com/whatsapp/contacts?bot_id={bot_id}"
    res_list = requests.get(url_list, headers=headers)
    contacts = res_list.json().get("data", [])
    
    contact_id = None
    for c in contacts:
        if c.get("phone") == phone or c.get("phone") == int(phone):
            contact_id = c["id"]
            break
            
    if not contact_id:
        print(f"Contact {phone} not found in the list.")
        # Se não achou na lista paginada, tentar buscar por telefone exato
        # A API as vezes retorna 400 'already exists' mas o search falha se não formatar
        print("Searching via direct phone endpoint...")
        # Note: some APIs use /whatsapp/contacts/by-phone/
        # Let's try to just use the one we might have found or iterate
        if not contacts:
            print("No contacts found at all.")
            return

    if contact_id:
        print(f"Found Contact ID: {contact_id}")
        # Enviar template
        url_send = "https://api.sendpulse.com/whatsapp/contacts/send"
        payload = {
            "contact_id": contact_id,
            "template_id": template_id
        }
        res_send = requests.post(url_send, json=payload, headers=headers)
        print(f"Status: {res_send.status_code}")
        print(res_send.text)
    else:
        print("Could not resolve contact ID.")

if __name__ == "__main__":
    send_v8()
