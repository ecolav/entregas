-- Script para corrigir datas de pesagens que foram registradas no dia errado
-- Pesagens feitas às 21h-23h59 (BRT) foram registradas no dia seguinte (UTC)

-- 1. VERIFICAR quais registros serão afetados (EXECUTE PRIMEIRO PARA CONFERIR)
SELECT 
    id,
    referenceDate as data_atual,
    createdAt,
    kind,
    DATE(referenceDate, '-1 day') as data_corrigida,
    strftime('%H:%M', createdAt) as hora_criacao
FROM WeighingControl
WHERE 
    -- Registros criados entre 21h e 23h59 BRT (que é 00h-02h59 UTC do dia seguinte)
    strftime('%H', datetime(createdAt, '+3 hours')) BETWEEN '21' AND '23'
    AND date(referenceDate) > date(createdAt, '+3 hours')
ORDER BY createdAt DESC;

-- 2. CORRIGIR as datas (EXECUTE DEPOIS DE CONFERIR)
-- Descomente as linhas abaixo para executar a correção:

/*
UPDATE WeighingControl
SET referenceDate = datetime(referenceDate, '-1 day')
WHERE 
    strftime('%H', datetime(createdAt, '+3 hours')) BETWEEN '21' AND '23'
    AND date(referenceDate) > date(createdAt, '+3 hours');

-- Verificar quantos foram atualizados
SELECT changes() as registros_corrigidos;

-- Conferir os registros corrigidos
SELECT 
    id,
    referenceDate as data_corrigida,
    createdAt,
    kind,
    strftime('%H:%M', createdAt) as hora_criacao
FROM WeighingControl
WHERE 
    strftime('%H', datetime(createdAt, '+3 hours')) BETWEEN '21' AND '23'
ORDER BY createdAt DESC
LIMIT 20;
*/

