
# API de Meteorologia

API REST desenvolvida em Python e Flask para consultar
condições meteorológicas atuais e previsões de sete dias.

## Tecnologias

- Python
- Flask
- Requests
- Open-Meteo API

## Funcionalidades

- Verificação de disponibilidade da API
- Consulta do clima atual por cidade
- Previsão meteorológica de sete dias por cidade
- Busca de cidades com estado e país
- Consulta do clima por latitude e longitude
- Previsão de sete dias por coordenadas
- Validação de coordenadas e tratamento básico de erros

## Instalação

Clone o repositório e entre na pasta do projeto.

Crie e ative um ambiente virtual:

python -m venv venv

Windows PowerShell:

.\venv\Scripts\Activate.ps1

Instale as dependências:

python -m pip install -r requirements.txt

Execute a aplicação:

python app.py

Acesse:

http://127.0.0.1:5000/

## Rotas

| Método | Rota | Descrição |
|---|---|---|
| GET | / | Status da API |
| GET | /clima/{cidade} | Clima atual |
| GET | /previsao/{cidade} | Previsão de sete dias |
| GET | /cidades/{nome} | Buscar cidades |
| GET | /clima/coordenadas?latitude=-23.55&longitude=-46.63 | Clima por coordenadas |
| GET | /previsao/coordenadas?latitude=-23.55&longitude=-46.63 | Previsão por coordenadas |

## Fonte dos dados

Open-Meteo: https://open-meteo.com/

Projeto educacional desenvolvido para praticar
Python, APIs REST, requisições HTTP e JSON.
