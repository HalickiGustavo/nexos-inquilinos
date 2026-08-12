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

def send_v9():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    bot_id = "6a7a08c77d60b5f329092325"
    phone = "5541987771358"
    template_id = "6a7a09f89cb5c31a7307c9ed"
    
    # Tentativa final: usar o nome do template em vez do ID se o ID falha
    # E tentar o endpoint de texto livre, apenas para ver se a janela de 24h existe
    print("Checking 24h window with text message...")
    url_text = "https://api.sendpulse.com/whatsapp/messages/sendText"
    payload_text = {
        "bot_id": bot_id,
        "phone": phone,
        "text": "Teste de conexão Nexo"
    }
    res_text = requests.post(url_text, json=payload_text, headers=headers)
    print(f"Text Message Status: {res_text.status_code}")
    print(res_text.text)

    # Se a resposta do search de contatos falhou antes, vamos tentar buscar por telefone
    # sem bot_id para ver se ele está órfão ou em outro bot
    print("\nSearching contact globally...")
    res_glob = requests.get(f"https://api.sendpulse.com/whatsapp/contacts/search?phone={phone}", headers=headers)
    print(res_glob.text)

if __name__ == "__main__":
    send_v9()
