# Script para recarregar o Nginx no servidor
Write-Host "Recarregando Nginx no servidor..." -ForegroundColor Yellow

$commands = @"
systemctl reload nginx
systemctl status nginx | grep Active
curl -I https://rouparia.textilecolav.com/uploads/1760121701742-t0zjx9rqu19.jpg 2>&1 | grep HTTP
exit
"@

$commands | ssh root@162.240.227.159

Write-Host "`nPronto! Verifique se apareceu 'HTTP/1.1 200 OK' acima." -ForegroundColor Green
Write-Host "Se sim, a imagem está funcionando!" -ForegroundColor Green

