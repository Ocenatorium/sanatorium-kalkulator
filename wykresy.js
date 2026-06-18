async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Nie udało się wczytać pliku: ${path}`);
  }

  return response.json();
}

function getAgreementAmount(item) {
  if (!Array.isArray(item.agreements)) {
    return 0;
  }

  return item.agreements.reduce((sum, agreement) => {
    return sum + (agreement.amount_pln || 0);
  }, 0);
}

function getSanatoriumAdultsUnitCount(item) {
  return item?.nfz_prices?.sanatorium_adults?.unit_count || 0;
}

function getCity(item) {
  const city = item.provider_place || "Brak danych";
  return String(city).trim();
}

function aggregateSanatoriumContractsByCity(rows) {
  const cityMap = new Map();

  rows.forEach(item => {
    const city = getCity(item);
    const amount = getAgreementAmount(item);
    const unitCount = getSanatoriumAdultsUnitCount(item);

    if (!amount || amount <= 0) {
      return;
    }

    if (!cityMap.has(city)) {
      cityMap.set(city, {
        amount: 0,
        unitCount: 0
      });
    }

    const current = cityMap.get(city);
    current.amount += amount;
    current.unitCount += unitCount;
  });

  return [...cityMap.entries()]
    .map(([city, values]) => ({
      city,
      amount: values.amount,
      unitCount: values.unitCount,
      estimatedPatients: values.unitCount / 21
    }))
    .sort((a, b) => b.amount - a.amount);
}

function formatPLN(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatMillionPLN(value) {
  const millions = value / 1_000_000;

  return `${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0
  }).format(millions)} mln zł`;
}

function formatThousands(value) {
  const thousands = value / 1_000;

  return `ok. ${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0
  }).format(thousands)} tys.`;
}

function renderTopCityHighlight(data) {
  const topCities = data.slice(0, 3);
  const highlight = document.getElementById("topCityHighlight");

  if (!highlight || topCities.length === 0) {
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];

  highlight.innerHTML = `
    <div class="top-city-ranking">
      ${topCities.map((item, index) => `
        <div class="top-city-place top-city-place-${index + 1}">
          <div class="top-city-medal">${medals[index]}</div>
          <div>
            <div class="top-city-rank">${index + 1}. miejsce</div>
            <h3>${item.city}</h3>

<div class="top-city-main-value">
  ${formatMillionPLN(item.amount)}
</div>

<!--
<div class="top-city-patients">
  <span class="top-city-people" aria-hidden="true">👥</span>
  <span>
    <span class="top-city-patients-label">Przewidywana liczba pobytów</span>
    <strong>${formatThousands(item.estimatedPatients)}</strong>
  </span>
</div>
-->

          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCityContractsChart(data) {
  const topCities = data.slice(0, 15);

  const labels = topCities.map(item => item.city);
  const values = topCities.map(item => item.amount);

  const canvas = document.getElementById("cityContractsChart");

  if (!canvas) {
    return;
  }

  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Wartość umów NFZ — lecznictwo uzdrowiskowe",
          data: values
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: context => formatPLN(context.raw)
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: value => formatPLN(value)
          }
        }
      }
    }
  });
}

async function initCharts() {
  try {
    const rows = await fetchJson("data/sanatoria_nfz_prices.json");
    const aggregated = aggregateSanatoriumContractsByCity(rows);

    renderTopCityHighlight(aggregated);
    renderCityContractsChart(aggregated);
  } catch (error) {
    console.error(error);

    const chartCard = document.querySelector(".chart-card");
    if (chartCard) {
      chartCard.innerHTML = "<p>Nie udało się wczytać danych do wykresu.</p>";
    }
  }
}

function initAnalysisSwitcher() {
  const cards = document.querySelectorAll("[data-target]");
  const panels = document.querySelectorAll("[data-analysis-panel]");

  if (cards.length === 0 || panels.length === 0) {
    return;
  }

  function hideAllPanels() {
    panels.forEach(panel => {
      panel.classList.add("is-hidden");
    });
  }

  function deactivateAllCards() {
    cards.forEach(card => {
      card.classList.remove("is-active");
      card.setAttribute("aria-pressed", "false");
    });
  }

  cards.forEach(card => {
    card.addEventListener("click", () => {
      const target = card.dataset.target;
      const isActive = card.classList.contains("is-active");

      deactivateAllCards();
      hideAllPanels();

      if (isActive) {
        return;
      }

      card.classList.add("is-active");
      card.setAttribute("aria-pressed", "true");

      const panel = document.querySelector(`[data-analysis-panel="${target}"]`);
      if (panel) {
        panel.classList.remove("is-hidden");
      }

      if (target === "city-contracts") {
        const chart = Chart.getChart("cityContractsChart");
        if (chart) {
          chart.resize();
        }
      }
    });
  });
}

initAnalysisSwitcher();
initCharts();
