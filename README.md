# API de Meteorologia

API REST em Python e Flask para consultar o clima atual e a previsão de sete dias de qualquer cidade, com uma página web que consome a própria API.

https://api-meteorologia.onrender.com/

## Funcionalidades

- Página web com busca de cidade (com sugestões), clima atual e previsão de sete dias
- Cor de fundo que muda conforme o tempo da cidade consultada (limpo, nublado, chuva, neve, tempestade)
- Botão para usar a localização do aparelho
- Consulta do clima atual e da previsão por nome de cidade ou por latitude e longitude
- Busca de cidades com estado e país
- Validação de coordenadas e tratamento de erros com mensagens e status HTTP adequados

## Tecnologias

- Python e Flask
- Requests
- Open-Meteo API (dados meteorológicos e geocodificação)
- HTML, CSS e JavaScript puro no front-end
- Gunicorn para execução em produção

## Estrutura do projeto

```
api-meteorologia/
├── app.py                 # rotas e acesso à Open-Meteo
├── requirements.txt       # dependências
├── templates/
│   └── index.html         # página web
└── static/
    ├── style.css          # estilos
    └── app.js             # consome as rotas da API
```

## Como rodar localmente

Clone o repositório e entre na pasta do projeto.

Crie e ative um ambiente virtual:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

No Linux ou macOS: `source venv/bin/activate`.

Instale as dependências e execute:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Acesse http://127.0.0.1:5000/

Para ligar o modo debug durante o desenvolvimento, defina `FLASK_DEBUG=1` antes de executar (no PowerShell: `$env:FLASK_DEBUG = "1"`).

## Rotas

| Método | Rota                                                   | Descrição                      |
|--------|--------------------------------------------------------|--------------------------------|
| GET    | /                                                      | Página web                     |
| GET    | /status                                                | Status da API                  |
| GET    | /clima/{cidade}                                        | Clima atual                    |
| GET    | /previsao/{cidade}                                     | Previsão de sete dias          |
| GET    | /cidades/{nome}                                        | Buscar cidades                 |
| GET    | /clima/coordenadas?latitude=-23.55&longitude=-46.63    | Clima por coordenadas          |
| GET    | /previsao/coordenadas?latitude=-23.55&longitude=-46.63 | Previsão por coordenadas       |

### Exemplo de resposta

`GET /clima/coordenadas?latitude=-23.55&longitude=-46.63`

```json
{
  "codigo": 63,
  "condicao": "Chuva moderada",
  "latitude": -23.55,
  "longitude": -46.63,
  "sensacao_termica_c": 25.1,
  "temperatura_c": 24.4,
  "umidade_percentual": 70,
  "vento_kmh": 12.3
}
```

`GET /previsao/coordenadas?latitude=-23.55&longitude=-46.63` (cada item de `previsao` representa um dia; aqui, apenas o primeiro)

```json
{
  "latitude": -23.55,
  "longitude": -46.63,
  "previsao": [
    {
      "codigo": 63,
      "condicao": "Chuva moderada",
      "data": "2026-10-31",
      "precipitacao_mm": 12.4,
      "probabilidade_chuva_percentual": 80,
      "temperatura_maxima_c": 28.0,
      "temperatura_minima_c": 19.0
    }
  ]
}
```

Os valores acima são apenas um exemplo do formato.

### Erros

As falhas devolvem um JSON no formato `{"erro": "mensagem"}`.

| Status | Quando acontece                                                     |
|--------|---------------------------------------------------------------------|
| 400    | Latitude ou longitude ausente, não numérica ou fora do intervalo    |
| 404    | Cidade não encontrada                                               |
| 502    | O serviço da Open-Meteo não respondeu ou devolveu erro              |

## Decisões de código

- As consultas à Open-Meteo e a leitura das coordenadas ficam em funções auxiliares, e as rotas só montam a resposta.
- Os erros são tratados em um único lugar: as funções levantam `ErroDeConsulta`, que carrega a mensagem e o status HTTP, e um `errorhandler` converte tudo em JSON.
- O código numérico do tempo (`codigo`) vai junto com o texto da condição, para que o front-end escolha ícone e cor sem depender da descrição.
- A página usa as rotas de coordenadas: primeiro resolve a cidade escolhida em latitude e longitude, depois busca clima e previsão em paralelo.
- Nomes de cidades vindos da API entram na página com `textContent`, nunca com `innerHTML`.

## Deploy no Render

1. Crie um **Web Service** no Render e conecte este repositório.
2. Em **Build Command**, use `pip install -r requirements.txt`.
3. Em **Start Command**, use `gunicorn app:app`.
4. Escolha o plano gratuito e publique.

## Fonte dos dados

Open-Meteo: https://open-meteo.com/

Projeto educacional desenvolvido para praticar Python, APIs REST, requisições HTTP e JSON.
