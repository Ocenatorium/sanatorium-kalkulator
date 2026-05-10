let sanatoria = [];

const tableBody = document.getElementById("sanatoriaTableBody");
const searchInput = document.getElementById("searchInput");
const voivodeshipFilter = document.getElementById("voivodeshipFilter");
const cityFilter = document.getElementById("cityFilter");
const resultCount = document.getElementById("resultCount");

function formatAmount(value) {
  if (!value || value === 0) {
    return "brak / 0 zł";
  }

  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0
  }).format(value);
}

function getSanatoriumDayPrice(item) {
  return item.nfz_prices?.sanatorium_adults?.avg_price_pln ?? null;
}

function formatDayPrice(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${Number(value).toFixed(2)} zł`;
}

function getTotalAmount(item) {
  if (!item.agreements || item.agreements.length === 0) {
    return 0;
  }

  return item.agreements.reduce((sum, agreement) => {
    return sum + (agreement.amount_pln || 0);
  }, 0);
}

function isConfirmedLocation(item) {
  return (
    (item.location_status === "manual" || item.location_status === "document") &&
    item.sanatorium_city
  );
}

function getConfirmedLocation(item) {
  return isConfirmedLocation(item) ? item.sanatorium_city.trim() : "";
}

function getLocationCities(item) {
  const location = getConfirmedLocation(item);

  if (!location) {
    return [];
  }

  return location
    .split("/")
    .map(city => city.trim())
    .filter(Boolean);
}

function itemHasCity(item, selectedCity) {
  if (!selectedCity) {
    return true;
  }

  return getLocationCities(item).some(city => city === selectedCity);
}

function mergeLocations(sanatoriaData, locationsData) {
  const locationsByProviderCode = new Map();

  locationsData.forEach(location => {
    if (location.provider_code) {
      locationsByProviderCode.set(String(location.provider_code), location);
    }
  });

  return sanatoriaData.map(item => {
    const providerCode = String(item.provider_code || "");
    const location = locationsByProviderCode.get(providerCode);

    if (!location) {
      return item;
    }

    return {
      ...item,
      sanatorium_city: location.sanatorium_city || "",
      sanatorium_name_clean: location.sanatorium_name_clean || "",
      location_status: location.location_status || "to_check",
      location_note: location.note || ""
    };
  });
}

function renderVoivodeshipOptions(data) {
  voivodeshipFilter.innerHTML = `<option value="">Wszystkie województwa</option>`;

  const voivodeships = [...new Set(
    data
      .map(item => item.voivodeship)
      .filter(Boolean)
  )].sort();

  voivodeships.forEach(voivodeship => {
    const option = document.createElement("option");
    option.value = voivodeship;
    option.textContent = voivodeship;
    voivodeshipFilter.appendChild(option);
  });
}

function renderCityOptions(data, selectedVoivodeship = "", selectedCity = "") {
  cityFilter.innerHTML = `<option value="">Wszystkie miejscowości</option>`;

  const cities = [...new Set(
    data
      .filter(item => !selectedVoivodeship || item.voivodeship === selectedVoivodeship)
      .flatMap(item => getLocationCities(item))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "pl"));

  cities.forEach(city => {
    const option = document.createElement("option");
    option.value = city;
    option.textContent = city;
    cityFilter.appendChild(option);
  });

  if (selectedCity && cities.includes(selectedCity)) {
    cityFilter.value = selectedCity;
  } else {
    cityFilter.value = "";
  }
}

function renderTable(data) {
  tableBody.innerHTML = "";

  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5">Brak wyników dla wybranych filtrów.</td>
      </tr>
    `;
    resultCount.textContent = "Znaleziono 0 ośrodków";
    return;
  }

  data.forEach(item => {
    const totalAmount = getTotalAmount(item);
    const confirmedLocation = getConfirmedLocation(item);

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <strong>${item.provider_name || "brak nazwy"}</strong>
        <div class="small">Kod NFZ: ${item.provider_code || "-"}</div>
      </td>
      <td>${item.voivodeship || "-"}</td>
      <td>${confirmedLocation}</td>
      <td class="amount">${formatAmount(totalAmount)}</td>
      <td class="amount">${formatDayPrice(getSanatoriumDayPrice(item))}</td>
    `;

    tableBody.appendChild(row);
  });

  resultCount.textContent = `Znaleziono ${data.length} ośrodków`;
}

function applyFilters() {
  const searchText = searchInput.value.trim().toLowerCase();
  const selectedVoivodeship = voivodeshipFilter.value;
  const selectedCity = cityFilter.value;

  const filtered = sanatoria.filter(item => {
    const confirmedLocation = getConfirmedLocation(item);

    const text = [
      item.provider_name,
      item.voivodeship,
      item.provider_code,
      confirmedLocation
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = text.includes(searchText);
    const matchesVoivodeship =
      !selectedVoivodeship || item.voivodeship === selectedVoivodeship;
    const matchesCity = itemHasCity(item, selectedCity);

    return matchesSearch && matchesVoivodeship && matchesCity;
  });

  renderTable(filtered);
}

function handleVoivodeshipChange() {
  const selectedVoivodeship = voivodeshipFilter.value;

  renderCityOptions(sanatoria, selectedVoivodeship, "");
  applyFilters();
}

function handleCityChange() {
  const selectedCity = cityFilter.value;

  if (selectedCity) {
    const matchingItem = sanatoria.find(item => itemHasCity(item, selectedCity));

    if (matchingItem?.voivodeship) {
      voivodeshipFilter.value = matchingItem.voivodeship;
      renderCityOptions(sanatoria, matchingItem.voivodeship, selectedCity);
    }
  }

  applyFilters();
}

async function fetchJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Nie udało się wczytać pliku ${path}`);
  }

  return response.json();
}

async function loadData() {
  try {
    const [sanatoriaData, locationsData] = await Promise.all([
      fetchJson("data/sanatoria_nfz_prices.json"),
      fetchJson("data/sanatoria_locations_manual.json")
    ]);

    sanatoria = mergeLocations(sanatoriaData, locationsData);

    renderVoivodeshipOptions(sanatoria);
    renderCityOptions(sanatoria);
    renderTable(sanatoria);
  } catch (error) {
    console.error(error);
    resultCount.textContent = "Błąd wczytywania danych.";
    tableBody.innerHTML = `
      <tr>
        <td colspan="5">
          Nie udało się poprawnie wyświetlić danych.<br>
          Szczegóły: ${error.message}
        </td>
      </tr>
    `;
  }
}

searchInput.addEventListener("input", applyFilters);
voivodeshipFilter.addEventListener("change", handleVoivodeshipChange);
cityFilter.addEventListener("change", handleCityChange);

loadData();