# FC Músicas Personalizadas

Funil inspirado no anúncio de referência:

1. Cliente responde 4 perguntas.
2. As respostas são enviadas para a QuackAPI.
3. A QuackAPI devolve uma letra de música personalizada em texto.
4. O cliente lê gratuitamente.
5. Se gostar, cria o pedido para transformar a letra em música cantada.
6. O pedido aparece no painel administrativo.

## Abrir localmente

Execute:

```
C:\Projetos\FC-Musicas-Personalizadas\start.bat
```

Site:
`http://127.0.0.1:3090`

Painel:
`http://127.0.0.1:3090/admin`

## QuackAPI

Endpoint usado:
`POST /v1/chat/completions`

A chave local fica em:
`quackapi.local.json`

Esse arquivo está no `.gitignore` e não deve ser enviado ao Git.

Também é possível configurar por variáveis de ambiente:

- QUACKAPI_BASE_URL
- QUACKAPI_API_KEY
- QUACKAPI_MODEL

## Métricas

O painel mostra:
- visitas;
- início do quiz;
- pessoas que chegaram à 4ª pergunta;
- letras geradas;
- pedidos;
- cliques no CTA final.

## Pedidos

Localmente:
`data/orders.json`

Métricas:
`data/analytics.json`

Para publicar para vários clientes simultâneos, o próximo passo recomendado é migrar pedidos e métricas para Supabase/Postgres e colocar a chave da QuackAPI somente nas variáveis do servidor.
