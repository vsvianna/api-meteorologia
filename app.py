import os
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

app.json.ensure_ascii = False

# Endereços da API externa
URL_CIDADES = "https://geocoding-api.open-meteo.com/v1/search"
URL_CLIMA = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_SEGUNDOS = 10

CAMPOS_ATUAIS = (
    "temperature_2m,relative_humidity_2m,"
    "apparent_temperature,weather_code,wind_speed_10m"
)
CAMPOS_DIARIOS = (
    "weather_code,temperature_2m_max,"
    "temperature_2m_min,precipitation_probability_max,"
    "precipitation_sum"
)


DESCRICOES_CLIMA = {
    0: "Céu limpo",
    1: "Predominantemente limpo",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Neblina",
    48: "Neblina com geada",
    51: "Garoa fraca",
    53: "Garoa moderada",
    55: "Garoa intensa",
    56: "Garoa congelante fraca",
    57: "Garoa congelante intensa",
    61: "Chuva fraca",
    63: "Chuva moderada",
    65: "Chuva forte",
    66: "Chuva congelante fraca",
    67: "Chuva congelante forte",
    71: "Neve fraca",
    73: "Neve moderada",
    75: "Neve forte",
    77: "Grãos de neve",
    80: "Pancadas de chuva fracas",
    81: "Pancadas de chuva moderadas",
    82: "Pancadas de chuva fortes",
    85: "Pancadas de neve fracas",
    86: "Pancadas de neve fortes",
    95: "Trovoadas",
    96: "Trovoadas com granizo fraco",
    99: "Trovoadas com granizo forte",
}


class ErroDeConsulta(Exception):
    def __init__(self, mensagem, status):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.status = status


@app.errorhandler(ErroDeConsulta)
def tratar_erro_de_consulta(erro):
    return jsonify(erro=erro.mensagem), erro.status


def descricao_clima(codigo):
    return DESCRICOES_CLIMA.get(codigo, "Condição não mapeada")


def consultar(url, params):
    try:
        resposta = requests.get(url, params=params, timeout=TIMEOUT_SEGUNDOS)
        resposta.raise_for_status()
        return resposta.json()
    except requests.RequestException:
        raise ErroDeConsulta(
            "Não foi possível consultar o serviço meteorológico", 502
        )

def procurar_cidades(nome, quantidade):
    dados = consultar(
        URL_CIDADES,
        {
            "name": nome,
            "count": quantidade,
            "language": "pt",
            "format": "json",
        },
    )
    return dados.get("results", [])

def primeira_cidade(nome):
    resultados = procurar_cidades(nome, 1)
    if not resultados:
        raise ErroDeConsulta("Cidade não encontrada", 404)
    return resultados[0]

def ler_coordenadas():
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)

    if latitude is None or longitude is None:
        raise ErroDeConsulta("Informe latitude e longitude", 400)
    if not (-90 <= latitude <= 90):
        raise ErroDeConsulta("Latitude inválida", 400)
    if not (-180 <= longitude <= 180):
        raise ErroDeConsulta("Longitude inválida", 400)
    return latitude, longitude

def obter_clima_atual(latitude, longitude):
    dados = consultar(
        URL_CLIMA,
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": CAMPOS_ATUAIS,
            "timezone": "auto",
        },
    )
    atual = dados["current"]
    return {
        "temperatura_c": atual["temperature_2m"],
        "sensacao_termica_c": atual["apparent_temperature"],
        "umidade_percentual": atual["relative_humidity_2m"],
        "vento_kmh": atual["wind_speed_10m"],
        # Novo: o código numérico permite ao front escolher ícone e cor.
        "codigo": atual["weather_code"],
        "condicao": descricao_clima(atual["weather_code"]),
    }

def obter_previsao(latitude, longitude):
    dados = consultar(
        URL_CLIMA,
        {
            "latitude": latitude,
            "longitude": longitude,
            "daily": CAMPOS_DIARIOS,
            "forecast_days": 7,
            "timezone": "auto",
        },
    )
    diario = dados["daily"]

    return [
        {
            "data": diario["time"][i],
            "codigo": diario["weather_code"][i],
            "condicao": descricao_clima(diario["weather_code"][i]),
            "temperatura_maxima_c": diario["temperature_2m_max"][i],
            "temperatura_minima_c": diario["temperature_2m_min"][i],
            "probabilidade_chuva_percentual": (
                diario["precipitation_probability_max"][i]
            ),
            "precipitacao_mm": diario["precipitation_sum"][i],
        }
        for i in range(len(diario["time"]))
    ]

@app.route("/")
def pagina_inicial():
    return render_template("index.html")


@app.route("/status")
def status():
    return jsonify(mensagem="API de Meteorologia", status="online")

@app.route("/cidades/<nome>")
def buscar_cidades(nome):
    resultados = procurar_cidades(nome, 10)
    if not resultados:
        raise ErroDeConsulta("Nenhuma cidade encontrada", 404)
    cidades = [
        {
            "cidade": cidade["name"],
            "estado": cidade.get("admin1"),
            "pais": cidade.get("country"),
            "latitude": cidade["latitude"],
            "longitude": cidade["longitude"],
        }
        for cidade in resultados
    ]
    return jsonify(resultados=cidades)

@app.route("/clima/<cidade>")
def clima_atual(cidade):
    local = primeira_cidade(cidade)
    clima = obter_clima_atual(local["latitude"], local["longitude"])
    return jsonify(
        {"cidade": local["name"], "pais": local.get("country"), **clima}
    )

@app.route("/previsao/<cidade>")
def previsao(cidade):
    local = primeira_cidade(cidade)
    dias = obter_previsao(local["latitude"], local["longitude"])
    return jsonify(
        {"cidade": local["name"], "pais": local.get("country"), "previsao": dias}
    )

@app.route("/clima/coordenadas")
def clima_coordenadas():
    latitude, longitude = ler_coordenadas()
    clima = obter_clima_atual(latitude, longitude)

    return jsonify({"latitude": latitude, "longitude": longitude, **clima})

@app.route("/previsao/coordenadas")
def previsao_coordenadas():
    latitude, longitude = ler_coordenadas()
    dias = obter_previsao(latitude, longitude)

    return jsonify(
        {"latitude": latitude, "longitude": longitude, "previsao": dias}
    )


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")