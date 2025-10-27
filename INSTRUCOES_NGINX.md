# Instruções para Recarregar Nginx

## 🔧 Problema
A imagem está dando 404 porque o nginx precisa ser recarregado para aplicar a nova configuração do `/uploads/`.

## ✅ Solução

### Passo 1: Conectar ao servidor
```bash
ssh root@162.240.227.159
```

### Passo 2: Recarregar o nginx
```bash
systemctl reload nginx
```

### Passo 3: Verificar se funcionou
```bash
curl -I https://rouparia.textilecolav.com/uploads/1760121701742-t0zjx9rqu19.jpg | grep HTTP
```

**Resultado esperado:** `HTTP/1.1 200 OK`

---

## 🎯 O que foi corrigido

A configuração do nginx foi atualizada para dar prioridade ao `/uploads/`:

```nginx
location ^~ /uploads/ {
    alias /home/rouparia/public_html/backend/uploads/;
}
```

O modificador `^~` garante que esta rota tenha prioridade sobre o regex de cache de imagens.

---

## 📝 Nota
Os outros avisos no console (Tailwind CDN e qrcode.min.js) não são problemas:
- **Tailwind CDN**: Apenas na página track.html (rastreamento QR)
- **qrcode.min.js**: Carrega automaticamente de CDN como fallback

