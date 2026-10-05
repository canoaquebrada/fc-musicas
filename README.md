# FC Músicas Personalizadas

Funil inspirado no anúncio de referência:

1. Cliente responde 4 perguntas.
2. As respostas são enviadas para a QuackAPI.
3. A QuackAPI devolve uma letra de música personalizada em texto.
4. O cliente lê gratuitamente.
5. Se gostar, cria o pedido para transformar a letra em música cantada.
6. O botão final abre o WhatsApp comercial com todos os dados e a letra gerada.

## WhatsApp de pedidos

Destino configurado:

`5585992019111`

O sistema envia na mensagem:
- nome do cliente;
- WhatsApp do cliente;
- aniversariante e idade;
- relação;
- características;
- história;
- estilo e voz;
- mensagem especial;
- letra completa gerada pela QuackAPI.

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

Esse arquivo está no `.gitignore` e não é enviado ao GitHub.

Na Vercel, a chave fica somente em variável de ambiente.

Variáveis:
- QUACKAPI_BASE_URL
- QUACKAPI_API_KEY
- QUACKAPI_MODEL
- WHATSAPP_NUMBER

## Deploy Vercel

O repositório está ligado ao projeto `fc-musicas` na Vercel. Commits em `main` disparam o deploy de produção.

A versão publicada usa funções serverless para:
- `/api/lyrics/preview`
- `/api/orders`
- `/api/health`
- `/api/analytics`

Os pedidos do deploy público são encaminhados diretamente para o WhatsApp configurado.
