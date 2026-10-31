(() => {
  "use strict";

  // Cidade mostrada na primeira visita.
  const PADRAO = {
    nome: "São Paulo",
    estado: "São Paulo",
    pais: "Brasil",
    latitude: -23.5475,
    longitude: -46.6361,
  };
  const CHAVE_SALVA = "clima:ultima-cidade";

  const $ = (id) => document.getElementById(id);
  const el = {
    form: $("busca"),
    campo: $("cidade"),
    lista: $("sugestoes"),
    aviso: $("aviso"),
    localizacao: $("localizacao"),
    agora: $("agora"),
    semana: $("semana"),
    local: $("local"),
    regiao: $("regiao"),
    temp: $("temp"),
    tempSr: $("temp-sr"),
    icone: $("icone"),
    condicao: $("condicao"),
    hoje: $("hoje"),
    sensacao: $("sensacao"),
    umidade: $("umidade"),
    vento: $("vento"),
    dias: $("dias"),
    jsonClima: $("json-clima"),
    jsonPrevisao: $("json-previsao"),
  };

  // ------------------------------------------------------- utilidades

  function criar(tag, classe, texto) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto !== undefined) no.textContent = texto;
    return no;
  }

  // Todo texto vindo da API entra na página com textContent, nunca com
  // innerHTML, para que um nome de cidade estranho não vire código.
  function avisar(mensagem, erro = false) {
    el.aviso.textContent = mensagem;
    el.aviso.dataset.erro = String(erro && Boolean(mensagem));
  }

  const numero = (valor) => (Number.isFinite(valor) ? valor : null);
  const grau = (valor) => (numero(valor) === null ? "–" : `${Math.round(valor)}°`);
  const porcento = (valor) => (numero(valor) === null ? "–" : `${Math.round(valor)}%`);

  function limparBusca(texto) {
    return texto.replace(/\//g, " ").replace(/\s+/g, " ").trim();
  }

  function rotulo(cidade) {
    return [cidade.cidade, cidade.estado, cidade.pais].filter(Boolean).join(", ");
  }

  // ------------------------------------------- código do tempo (WMO)

  function icone(codigo) {
    if (codigo === 0) return "☀️";
    if (codigo === 1) return "🌤️";
    if (codigo === 2) return "⛅";
    if (codigo === 3) return "☁️";
    if (codigo === 45 || codigo === 48) return "🌫️";
    if (codigo >= 51 && codigo <= 57) return "🌦️";
    if (codigo >= 61 && codigo <= 67) return "🌧️";
    if (codigo >= 71 && codigo <= 77) return "🌨️";
    if (codigo >= 80 && codigo <= 82) return "🌧️";
    if (codigo === 85 || codigo === 86) return "🌨️";
    if (codigo >= 95) return "⛈️";
    return "🌡️";
  }

  // Escolhe a paleta do céu (veja body[data-tempo] no style.css).
  function tempoDoCodigo(codigo) {
    if (codigo <= 1) return "limpo";
    if (codigo <= 3) return "nublado";
    if (codigo === 45 || codigo === 48) return "neblina";
    if ((codigo >= 51 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return "chuva";
    if ((codigo >= 71 && codigo <= 77) || codigo === 85 || codigo === 86) return "neve";
    if (codigo >= 95) return "tempestade";
    return "nublado";
  }

  // ------------------------------------------------------------- API

  async function api(caminho) {
    let resposta;
    try {
      resposta = await fetch(caminho, { headers: { Accept: "application/json" } });
    } catch {
      throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    }

    let corpo = null;
    try {
      corpo = await resposta.json();
    } catch {
      // Resposta sem JSON: segue com a mensagem genérica abaixo.
    }

    if (!resposta.ok) {
      const erro = new Error(corpo?.erro || "Algo deu errado. Tente de novo em instantes.");
      erro.status = resposta.status;
      throw erro;
    }
    return corpo;
  }

  async function buscarCidades(texto) {
    try {
      const dados = await api(`/cidades/${encodeURIComponent(texto)}`);
      return dados.resultados;
    } catch (erro) {
      if (erro.status === 404) return [];
      throw erro;
    }
  }

  // ------------------------------------------------ cidade lembrada

  function lerSalva() {
    try {
      const bruto = localStorage.getItem(CHAVE_SALVA);
      if (!bruto) return null;
      const local = JSON.parse(bruto);
      if (
        local &&
        typeof local.nome === "string" &&
        Number.isFinite(local.latitude) &&
        Number.isFinite(local.longitude)
      ) {
        return local;
      }
    } catch {
      // Armazenamento bloqueado ou conteúdo inválido: usa a cidade padrão.
    }
    return null;
  }

  function salvar(local) {
    try {
      localStorage.setItem(CHAVE_SALVA, JSON.stringify(local));
    } catch {
      // Sem armazenamento, a página só não lembra da última cidade.
    }
  }

  // ----------------------------------------------- sugestões de busca

  let sugestoes = [];
  let indiceAtivo = -1;
  let sequenciaSugestoes = 0;
  let temporizador = 0;

  function fecharLista() {
    el.lista.hidden = true;
    el.campo.setAttribute("aria-expanded", "false");
    el.campo.removeAttribute("aria-activedescendant");
    indiceAtivo = -1;
  }

  function marcarAtivo(indice) {
    indiceAtivo = indice;
    Array.from(el.lista.children).forEach((item, n) => {
      item.setAttribute("aria-selected", String(n === indice));
    });
    if (indice >= 0) {
      el.campo.setAttribute("aria-activedescendant", `opcao-${indice}`);
      el.lista.children[indice].scrollIntoView({ block: "nearest" });
    } else {
      el.campo.removeAttribute("aria-activedescendant");
    }
  }

  function desenharLista(vazia) {
    el.lista.replaceChildren();
    indiceAtivo = -1;

    if (vazia) {
      const item = criar("li", "vazio", "Nenhuma cidade encontrada");
      item.setAttribute("role", "presentation");
      el.lista.append(item);
    } else {
      sugestoes.forEach((cidade, i) => {
        const item = criar("li", "", rotulo(cidade));
        item.id = `opcao-${i}`;
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", "false");
        el.lista.append(item);
      });
    }

    el.lista.hidden = false;
    el.campo.setAttribute("aria-expanded", "true");
  }

  function escolher(cidade) {
    fecharLista();
    el.campo.value = rotulo(cidade);
    el.campo.blur();
    carregar({
      nome: cidade.cidade,
      estado: cidade.estado,
      pais: cidade.pais,
      latitude: cidade.latitude,
      longitude: cidade.longitude,
    });
  }

  el.campo.addEventListener("input", () => {
    clearTimeout(temporizador);
    sequenciaSugestoes += 1;
    const texto = limparBusca(el.campo.value);

    if (texto.length < 2) {
      sugestoes = [];
      fecharLista();
      return;
    }

    // Espera a pessoa parar de digitar antes de consultar a API.
    temporizador = setTimeout(async () => {
      const minha = ++sequenciaSugestoes;
      try {
        const resultado = await buscarCidades(texto);
        if (minha !== sequenciaSugestoes) return; // chegou atrasada
        sugestoes = resultado;
        desenharLista(resultado.length === 0);
      } catch {
        if (minha === sequenciaSugestoes) fecharLista();
      }
    }, 250);
  });

  el.campo.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      fecharLista();
      return;
    }
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    if (sugestoes.length === 0) return;

    evento.preventDefault();
    if (el.lista.hidden) desenharLista(false);

    const total = sugestoes.length;
    if (indiceAtivo < 0) {
      marcarAtivo(evento.key === "ArrowDown" ? 0 : total - 1);
    } else {
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      marcarAtivo((indiceAtivo + passo + total) % total);
    }
  });

  // mousedown (e não click) para agir antes de o campo perder o foco.
  el.lista.addEventListener("mousedown", (evento) => {
    const item = evento.target.closest("li[role='option']");
    if (!item) return;
    evento.preventDefault();
    escolher(sugestoes[Number(item.id.replace("opcao-", ""))]);
  });

  document.addEventListener("click", (evento) => {
    if (!evento.target.closest(".campo")) fecharLista();
  });

  el.form.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (indiceAtivo >= 0 && sugestoes[indiceAtivo]) {
      escolher(sugestoes[indiceAtivo]);
      return;
    }

    const texto = limparBusca(el.campo.value);
    if (texto.length < 2) {
      avisar("Digite pelo menos 2 letras do nome da cidade.", true);
      el.campo.focus();
      return;
    }

    clearTimeout(temporizador);
    sequenciaSugestoes += 1;
    avisar("Buscando cidade…");

    try {
      const resultado = await buscarCidades(texto);
      if (resultado.length === 0) {
        avisar(`Nenhuma cidade encontrada para “${texto}”. Confira o nome e tente de novo.`, true);
        return;
      }
      escolher(resultado[0]);
    } catch (erro) {
      avisar(erro.message, true);
    }
  });

  // ---------------------------------------------------- localização

  el.localizacao.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
      avisar("Seu navegador não oferece localização. Busque pelo nome da cidade.", true);
      return;
    }

    avisar("Obtendo sua localização…");
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const latitude = Number(posicao.coords.latitude.toFixed(4));
        const longitude = Number(posicao.coords.longitude.toFixed(4));
        el.campo.value = "";
        fecharLista();
        carregar({
          nome: "Sua localização",
          regiao: `${latitude}, ${longitude}`,
          latitude,
          longitude,
          temporario: true, // não guarda a localização do aparelho
        });
      },
      (erro) => {
        avisar(
          erro.code === erro.PERMISSION_DENIED
            ? "Permissão de localização negada. Busque pelo nome da cidade."
            : "Não foi possível obter sua localização. Busque pelo nome da cidade.",
          true
        );
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  });

  // ------------------------------------------------------ carregar

  let sequenciaCarga = 0;

  async function carregar(local) {
    const minha = ++sequenciaCarga;
    const consulta = `latitude=${local.latitude}&longitude=${local.longitude}`;

    avisar("Carregando…");
    document.body.setAttribute("aria-busy", "true");

    try {
      // As duas consultas não dependem uma da outra, então vão juntas.
      const [clima, previsao] = await Promise.all([
        api(`/clima/coordenadas?${consulta}`),
        api(`/previsao/coordenadas?${consulta}`),
      ]);
      if (minha !== sequenciaCarga) return; // outra busca começou depois

      mostrar(local, clima, previsao.previsao, consulta);
      if (!local.temporario) salvar(local);
      avisar("");
    } catch (erro) {
      if (minha === sequenciaCarga) avisar(erro.message, true);
    } finally {
      if (minha === sequenciaCarga) document.body.removeAttribute("aria-busy");
    }
  }

  // ------------------------------------------------------ desenhar

  const formatoDia = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit" });

  function nomeDoDia(dataIso, posicao) {
    if (posicao === 0) return "Hoje";
    // Monta a data com ano/mês/dia para não sofrer deslocamento de fuso.
    const [ano, mes, dia] = dataIso.split("-").map(Number);
    const partes = {};
    formatoDia.formatToParts(new Date(ano, mes - 1, dia)).forEach((p) => {
      partes[p.type] = p.value;
    });
    const semana = (partes.weekday || "").replace(".", "");
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${partes.day}`;
  }

  function mostrar(local, clima, dias, consulta) {
    document.body.dataset.tempo = tempoDoCodigo(clima.codigo);

    el.local.textContent = local.nome;
    el.regiao.textContent =
      local.regiao || [local.estado, local.pais].filter(Boolean).join(", ");

    const temperatura = grau(clima.temperatura_c);
    el.temp.textContent = temperatura;
    el.tempSr.textContent =
      temperatura === "–" ? "Temperatura indisponível" : `${Math.round(clima.temperatura_c)} graus Celsius`;
    el.icone.textContent = icone(clima.codigo);
    el.condicao.textContent = clima.condicao;

    const hoje = dias[0];
    el.hoje.textContent = hoje
      ? `Hoje: máxima de ${grau(hoje.temperatura_maxima_c)}, mínima de ${grau(hoje.temperatura_minima_c)}.`
      : "";

    el.sensacao.textContent = grau(clima.sensacao_termica_c);
    el.umidade.textContent = porcento(clima.umidade_percentual);
    el.vento.textContent = numero(clima.vento_kmh) === null ? "–" : `${Math.round(clima.vento_kmh)} km/h`;

    desenharSemana(dias);

    el.jsonClima.href = `/clima/coordenadas?${consulta}`;
    el.jsonPrevisao.href = `/previsao/coordenadas?${consulta}`;
    document.title = `${temperatura} em ${local.nome}`;

    el.agora.hidden = false;
    el.semana.hidden = false;
  }

  function desenharSemana(dias) {
    const minimas = dias.map((d) => numero(d.temperatura_minima_c)).filter((v) => v !== null);
    const maximas = dias.map((d) => numero(d.temperatura_maxima_c)).filter((v) => v !== null);
    const menor = Math.min(...minimas);
    const maior = Math.max(...maximas);
    const amplitude = maior - menor || 1; // evita dividir por zero

    el.dias.replaceChildren();

    dias.forEach((dia, i) => {
      const item = criar("li", "dia");

      item.append(criar("span", "dia__nome", nomeDoDia(dia.data, i)));

      const tempo = criar("span", "dia__tempo");
      tempo.append(criar("span", "dia__icone", icone(dia.codigo)));
      tempo.append(criar("span", "dia__cond", dia.condicao));
      tempo.firstChild.setAttribute("aria-hidden", "true");
      item.append(tempo);

      const faixa = criar("span", "dia__faixa");
      faixa.append(criar("span", "dia__min", grau(dia.temperatura_minima_c)));

      const trilho = criar("span", "trilho");
      trilho.setAttribute("aria-hidden", "true");
      const min = numero(dia.temperatura_minima_c);
      const max = numero(dia.temperatura_maxima_c);
      if (min !== null && max !== null) {
        const barra = criar("span", "barra");
        const inicio = ((min - menor) / amplitude) * 100;
        const largura = Math.max(((max - min) / amplitude) * 100, 6);
        barra.style.left = `${Math.min(inicio, 100 - largura)}%`;
        barra.style.width = `${largura}%`;
        trilho.append(barra);
      }
      faixa.append(trilho);
      faixa.append(criar("span", "dia__max", grau(dia.temperatura_maxima_c)));
      item.append(faixa);

      const chuva = criar("span", "dia__chuva");
      const mm = numero(dia.precipitacao_mm);
      chuva.title =
        mm === null
          ? "Probabilidade de chuva"
          : `Probabilidade de chuva. Volume previsto: ${mm.toLocaleString("pt-BR")} mm`;
      const gota = criar("span", "", "💧");
      gota.setAttribute("aria-hidden", "true");
      chuva.append(gota, ` ${porcento(dia.probabilidade_chuva_percentual)}`);
      chuva.append(criar("span", "sr-only", " de chance de chuva"));
      item.append(chuva);

      el.dias.append(item);
    });
  }

  // ----------------------------------------------------------- início

  carregar(lerSalva() || PADRAO);
})();
