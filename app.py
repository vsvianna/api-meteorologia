
from flask import Flask, jsonify,request    
import requests


app = Flask(__name__)

# Endereços da API externa
URL_CIDADES = "https://geocoding-api.open-meteo.com/v1/search"
URL_CLIMA = "https://api.open-meteo.com/v1/forecast"


def descricao_clima(codigo):
    descricoes = {
        0: "Céu limpo",
        1: "Predominantemente limpo",
        2: "Parcialmente nublado",
        3: "Nublado",
        45: "Neblina",
        48: "Neblina com geada",
        51: "Garoa fraca",
        53: "Garoa moderada",
        55: "Garoa intensa",
        61: "Chuva fraca",
        63: "Chuva moderada",
        65: "Chuva forte",
        71: "Neve fraca",
        73: "Neve moderada",
        75: "Neve forte",
        80: "Pancadas de chuva fracas", 
        81: "Pancadas de chuva moderadas",
        82: "Pancadas de chuva fortes",
        95: "Trovoadas"
    }

    return descricoes.get(codigo, "Condição não mapeada")


@app.route("/")
def inicio():
    return jsonify(
        mensagem="API de Meteorologia",
        status="online"
    )


@app.route("/clima/<cidade>")
def clima_atual(cidade):
    try:
        resposta = requests.get(
            URL_CIDADES,
            params={
                "name": cidade,
                "count": 1,
                "language": "pt",
                "format": "json"
            },
            timeout=10
        )
        resposta.raise_for_status()
        dados_cidade = resposta.json()

        resultados = dados_cidade.get("results", [])

        if not resultados:
            return jsonify(erro="Cidade não encontrada"), 404

        local = resultados[0]

        resposta = requests.get(
            URL_CLIMA,
            params={
                "latitude": local["latitude"],
                "longitude": local["longitude"],
                "current": (
                    "temperature_2m,relative_humidity_2m,"
                    "apparent_temperature,weather_code,wind_speed_10m"
                ),
                "timezone": "auto"
            },
            timeout=10
        )
        resposta.raise_for_status()
        dados = resposta.json()

        atual = dados["current"]

        return jsonify({
            "cidade": local["name"],
            "pais": local.get("country"),
            "temperatura_c": atual["temperature_2m"],
            "sensacao_termica_c": atual["apparent_temperature"],
            "umidade_percentual": atual["relative_humidity_2m"],
            "vento_kmh": atual["wind_speed_10m"],
            "condicao": descricao_clima(atual["weather_code"])
        })

    except requests.RequestException:
        return jsonify(erro="Não foi possível consultar o serviço meteorológico"), 502


@app.route("/previsao/<cidade>")
def previsao(cidade):
    try:
        resposta = requests.get(
            URL_CIDADES,
            params={
                "name": cidade,
                "count": 1,
                "language": "pt",
                "format": "json"
            },
            timeout=10
        )
        resposta.raise_for_status()
        resultados = resposta.json().get("results", [])

        if not resultados:
            return jsonify(erro="Cidade não encontrada"), 404

        local = resultados[0]

        resposta = requests.get(
            URL_CLIMA,
            params={
                "latitude": local["latitude"],
                "longitude": local["longitude"],
                "daily": (
                    "weather_code,temperature_2m_max,"
                    "temperature_2m_min,precipitation_probability_max,"
                    "precipitation_sum"
                ),
                "forecast_days": 7,
                "timezone": "auto"
            },
            timeout=10
        )
        resposta.raise_for_status()
        dados = resposta.json()
        diario = dados["daily"]

        dias = []

        for i in range(len(diario["time"])):
            dias.append({
                "data": diario["time"][i],
                "condicao": descricao_clima(
                    diario["weather_code"][i]
                ),
                "temperatura_maxima_c": diario["temperature_2m_max"][i],
                "temperatura_minima_c": diario["temperature_2m_min"][i],
                "probabilidade_chuva_percentual": (
                    diario["precipitation_probability_max"][i]
                ),
                "precipitacao_mm": diario["precipitation_sum"][i]
            })

        return jsonify({
            "cidade": local["name"],
            "pais": local.get("country"),
            "previsao": dias
        })

    except requests.RequestException:
        return jsonify(erro="Não foi possível consultar o serviço meteorológico"), 502


@app.route("/cidades/<nome>")
def buscar_cidades(nome):
    try:
        resposta = requests.get(
            URL_CIDADES,
            params={
                "name": nome,
                "count": 10,
                "language": "pt",
                "format": "json"
            },
            timeout=10
        )

        resposta.raise_for_status()
        dados = resposta.json()

        resultados = dados.get("results", [])

        if not resultados:
            return jsonify(
                erro="Nenhuma cidade encontrada"
            ), 404

        cidades = []

        for cidade in resultados:
            cidades.append({
                "cidade": cidade["name"],
                "estado": cidade.get("admin1"),
                "pais": cidade.get("country"),
                "latitude": cidade["latitude"],
                "longitude": cidade["longitude"]
            })

        return jsonify(resultados=cidades), 200

    except requests.RequestException:
        return jsonify(
            erro="Falha ao consultar o serviço de cidades"
        ), 502


@app.route("/clima/coordenadas")
def clima_coordenadas():
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)

    if latitude is None or longitude is None:
        return jsonify(
            erro="Informe latitude e longitude"
        ), 400

    if not (-90 <= latitude <= 90):
        return jsonify(erro="Latitude inválida"), 400

    if not (-180 <= longitude <= 180):
        return jsonify(erro="Longitude inválida"), 400

    try:
        resposta = requests.get(
            URL_CLIMA,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,relative_humidity_2m,"
                    "apparent_temperature,weather_code,wind_speed_10m"
                ),
                "timezone": "auto"
            },
            timeout=10
        )
        resposta.raise_for_status()
        dados = resposta.json()
        atual = dados["current"]

        return jsonify({
            "latitude": latitude,
            "longitude": longitude,
            "temperatura_c": atual["temperature_2m"],
            "sensacao_termica_c": atual["apparent_temperature"],
            "umidade_percentual": atual["relative_humidity_2m"],
            "vento_kmh": atual["wind_speed_10m"],
            "condicao": descricao_clima(atual["weather_code"])
        }), 200

    except requests.RequestException:
        return jsonify(
            erro="Falha ao consultar o serviço meteorológico"
        ), 502


@app.route("/previsao/coordenadas")
def previsao_coordenadas():
    latitude = request.args.get("latitude", type=float)
    longitude = request.args.get("longitude", type=float)

    if latitude is None or longitude is None:
        return jsonify(
            erro="Informe latitude e longitude"
        ), 400

    if not (-90 <= latitude <= 90):
        return jsonify(erro="Latitude inválida"), 400

    if not (-180 <= longitude <= 180):
        return jsonify(erro="Longitude inválida"), 400

    try:
        resposta = requests.get(
            URL_CLIMA,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "daily": (
                    "weather_code,temperature_2m_max,"
                    "temperature_2m_min,precipitation_probability_max,"
                    "precipitation_sum"
                ),
                "forecast_days": 7,
                "timezone": "auto"
            },
            timeout=10
        )
        resposta.raise_for_status()
        dados = resposta.json()
        diario = dados["daily"]

        dias = []

        for i in range(len(diario["time"])):
            dias.append({
                "data": diario["time"][i],
                "condicao": descricao_clima(
                    diario["weather_code"][i]
                ),
                "temperatura_maxima_c": diario["temperature_2m_max"][i],
                "temperatura_minima_c": diario["temperature_2m_min"][i],
                "probabilidade_chuva_percentual": (
                    diario["precipitation_probability_max"][i]
                ),
                "precipitacao_mm": diario["precipitation_sum"][i]
            })

        return jsonify({
            "latitude": latitude,
            "longitude": longitude,
            "previsao": dias
        }), 200

    except requests.RequestException:
        return jsonify(
            erro="Falha ao consultar o serviço meteorológico"
        ), 502


if __name__ == "__main__":
    app.run(debug=True)
