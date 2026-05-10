let sanatoria = [];
let patientFees = [];
let privatePriceSummary = null;
let privatePriceSources = [];

const voivodeshipSelect = document.getElementById("voivodeshipSelect");
const citySelect = document.getElementById("citySelect");
const sanatoriumSelect = document.getElementById("sanatoriumSelect");
const selectedSanatoriumInfo = document.getElementById("selectedSanatoriumInfo");

const stayTypeSelect = document.getElementById("stayTypeSelect");
const seasonSelect = document.getElementById("seasonSelect");
const roomSelect = document.getElementById("roomSelect");
const stayDaysPreview = document.getElementById("stayDaysPreview");
const nfzStayDaysResult = document.getElementById("nfzStayDaysResult");
const privateStayDaysResult = document.getElementById("privateStayDaysResult");

const patientTotalResult = document.getElementById("patientTotalResult");
const nfzDailyResult = document.getElementById("nfzDailyResult");
const nfzTotalResult = document.getElementById("nfzTotalResult");
const totalStayValueResult = document.getElementById("totalStayValueResult");
const privateDailyResult = document.getElementById("privateDailyResult");
const privateTotalResult = document.getElementById("privateTotalResult");

const privateDailyLabel = document.getElementById("privateDailyLabelText");
const privateTotalLabel = document.getElementById("privateTotalLabelText");
const stayTypeDetails = document.getElementById("stayTypeDetails");
const roomTypeDetails = document.getElementById("roomTypeDetails");
const daysDetails = document.getElementById("daysDetails");
const dailyFeeDetails = document.getElementById("dailyFeeDetails");
const patientTotalDetails = document.getElementById("patientTotalDetails");
const nfzDailyDetails = document.getElementById("nfzDailyDetails");
const nfzTotalDetails = document.getElementById("nfzTotalDetails");
const totalStayValueDetails = document.getElementById("totalStayValueDetails");
const privateDailyDetails = document.getElementById("privateDailyDetails");
const privateTotalDetails = document.getElementById("privateTotalDetails");

const comparisonBox = document.getElementById("comparisonBox");
const comparisonValue = document.getElementById("comparisonValue");
const comparisonText = document.getElementById("comparisonText");

const privateSourcesDetails = document.getElementById("privateSourcesDetails");
const privateSourcesIntro = document.getElementById("privateSourcesIntro");
const privateSourcesList = document.getElementById("privateSourcesList");

const togglePrivateSourcesButton = document.getElementById("togglePrivateSourcesButton");

let showAllPrivateSources = false;
let lastPrivateSourcesToRender = [];

const STAY_CONFIGS = {
    sanatorium_21: {
        days: 21,
        patientPays: true,
        label: "Leczenie w sanatorium uzdrowiskowym",
        nfzPriceKey: "sanatorium_adults"
    },

    sanatorium_rehab_28: {
        days: 28,
        patientPays: true,
        label: "Rehabilitacja uzdrowiskowa w sanatorium",
        nfzPriceKey: "rehab_sanatorium_adults"
    },

    hospital_21: {
        days: 21,
        patientPays: false,
        label: "Leczenie w szpitalu uzdrowiskowym",
        nfzPriceKey: "hospital_adults"
    },

    hospital_rehab_28: {
        days: 28,
        patientPays: false,
        label: "Rehabilitacja uzdrowiskowa w szpitalu uzdrowiskowym",
        nfzPriceKey: "rehab_hospital_adults"
    },

    ambulatory_0: {
        days: 0,
        patientPays: false,
        label: "Leczenie ambulatoryjne",
        nfzPriceKey: null
    }
};

function hasNumber(value) {
    return value !== null && value !== undefined && !Number.isNaN(Number(value));
}

function formatPLN(value) {
    if (!hasNumber(value)) {
        return "—";
    }

    return new Intl.NumberFormat("pl-PL", {
        style: "currency",
        currency: "PLN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value));
}

function splitCities(cityText) {
    if (!cityText) {
        return [];
    }

    return String(cityText)
        .split("/")
        .map(city => city.trim())
        .filter(Boolean);
}

function getConfirmedLocation(item) {
    const isConfirmed =
        (item.location_status === "manual" || item.location_status === "document") &&
        item.sanatorium_city;

    return isConfirmed ? String(item.sanatorium_city).trim() : "";
}

function getSanatoriumName(item) {
    return item.sanatorium_name_clean || item.provider_name || "brak nazwy";
}

function getStayConfig() {
    const value = stayTypeSelect.value;
    return STAY_CONFIGS[value] || STAY_CONFIGS.sanatorium_21;
}

function getSanatoriumDayPrice(item, stayConfig) {
    if (!item || !item.nfz_prices || !stayConfig.nfzPriceKey) {
        return null;
    }

    const priceObject = item.nfz_prices[stayConfig.nfzPriceKey];

    if (
        !priceObject ||
        priceObject.avg_price_pln === null ||
        priceObject.avg_price_pln === undefined
    ) {
        return null;
    }

    return Number(priceObject.avg_price_pln);
}

function getNfzScopeVoivodeship(selectedSanatorium) {
    if (selectedSanatorium?.voivodeship) {
        return selectedSanatorium.voivodeship;
    }

    if (voivodeshipSelect.value) {
        return voivodeshipSelect.value;
    }

    if (citySelect.value) {
        const sanatoriumFromCity = sanatoria.find(item => {
            const cityList = splitCities(getConfirmedLocation(item));
            return cityList.includes(citySelect.value) && item.voivodeship;
        });

        if (sanatoriumFromCity?.voivodeship) {
            return sanatoriumFromCity.voivodeship;
        }
    }

    return "POLSKA";
}

function getNfzAverageDayPrice(stayConfig, selectedSanatorium) {
    if (!stayConfig.nfzPriceKey) {
        return null;
    }

    if (selectedSanatorium) {
        return getSanatoriumDayPrice(selectedSanatorium, stayConfig);
    }

    const scopeVoivodeship = getNfzScopeVoivodeship(selectedSanatorium);

    const matchingSanatoria = sanatoria.filter(item => {
        if (scopeVoivodeship === "POLSKA") {
            return true;
        }

        return item.voivodeship === scopeVoivodeship;
    });

    const prices = matchingSanatoria
        .map(item => getSanatoriumDayPrice(item, stayConfig))
        .filter(value => hasNumber(value));

    if (prices.length === 0) {
        return null;
    }

    const sum = prices.reduce((total, value) => total + Number(value), 0);
    return sum / prices.length;
}

function getNfzScopeText(selectedSanatorium) {
    if (selectedSanatorium) {
        return "Stawka z danych o umowie NFZ dla wybranego ośrodka.";
    }

    const scopeVoivodeship = getNfzScopeVoivodeship(selectedSanatorium);

    if (scopeVoivodeship === "POLSKA") {
        return "Średnia stawka NFZ za osobodzień z całej Polski dla wybranego rodzaju pobytu.";
    }

    return `Średnia stawka NFZ za osobodzień z woj. ${scopeVoivodeship} dla wybranego rodzaju pobytu.`;
}

function hasContractForStayType(sanatorium, stayConfig) {
    if (!sanatorium) {
        return true;
    }

    if (!stayConfig.nfzPriceKey) {
        return false;
    }

    const priceObject = sanatorium.nfz_prices?.[stayConfig.nfzPriceKey];

    return (
        priceObject !== null &&
        priceObject !== undefined &&
        hasNumber(priceObject.avg_price_pln)
    );
}

function fillStayTypeSelect() {
    const selectedSanatorium = getSelectedSanatorium();
    const currentValue = stayTypeSelect.value;

    stayTypeSelect.innerHTML = "";

    const availableStayTypes = Object.entries(STAY_CONFIGS).filter(
        ([value, config]) => {
            if (!selectedSanatorium) {
                return true;
            }

            return hasContractForStayType(selectedSanatorium, config);
        }
    );

    availableStayTypes.forEach(([value, config]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = config.label;
        stayTypeSelect.appendChild(option);
    });

    const currentStillAvailable = availableStayTypes.some(
        ([value]) => value === currentValue
    );

    if (currentStillAvailable) {
        stayTypeSelect.value = currentValue;
    } else if (availableStayTypes.length > 0) {
        stayTypeSelect.value = availableStayTypes[0][0];
    }
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

function getFilteredSanatoria() {
    const selectedVoivodeship = voivodeshipSelect.value;
    const selectedCity = citySelect.value;

    return sanatoria.filter(item => {
        const cityList = splitCities(getConfirmedLocation(item));

        const matchesVoivodeship =
            !selectedVoivodeship || item.voivodeship === selectedVoivodeship;

        const matchesCity =
            !selectedCity || cityList.includes(selectedCity);

        return matchesVoivodeship && matchesCity;
    });
}

function fillVoivodeshipSelect() {
    const currentValue = voivodeshipSelect.value;

    const voivodeships = [...new Set(
        sanatoria
            .map(item => item.voivodeship)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "pl"));

    voivodeshipSelect.innerHTML = `<option value="">Wszystkie województwa</option>`;

    voivodeships.forEach(voivodeship => {
        const option = document.createElement("option");
        option.value = voivodeship;
        option.textContent = voivodeship;
        voivodeshipSelect.appendChild(option);
    });

    if (currentValue && voivodeships.includes(currentValue)) {
        voivodeshipSelect.value = currentValue;
    }
}

function fillCitySelect() {
    const selectedVoivodeship = voivodeshipSelect.value;
    const currentCity = citySelect.value;
    const cities = new Set();

    sanatoria.forEach(item => {
        if (selectedVoivodeship && item.voivodeship !== selectedVoivodeship) {
            return;
        }

        splitCities(getConfirmedLocation(item)).forEach(city => {
            cities.add(city);
        });
    });

    const sortedCities = [...cities].sort((a, b) => a.localeCompare(b, "pl"));

    citySelect.innerHTML = `<option value="">Wszystkie miejscowości</option>`;

    sortedCities.forEach(city => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });

    if (currentCity && sortedCities.includes(currentCity)) {
        citySelect.value = currentCity;
    } else {
        citySelect.value = "";
    }
}

function fillSanatoriumSelect() {
    const currentSanatoriumCode = sanatoriumSelect.value;
    const filteredSanatoria = getFilteredSanatoria();

    sanatoriumSelect.innerHTML = `<option value="">— wybierz sanatorium —</option>`;

    filteredSanatoria.forEach(item => {
        const option = document.createElement("option");
        option.value = String(item.provider_code);

        const name = getSanatoriumName(item);
        const city = getConfirmedLocation(item);
        const voivodeship = item.voivodeship || "";

        option.textContent = [name, city, voivodeship]
            .filter(Boolean)
            .join(" — ");

        sanatoriumSelect.appendChild(option);
    });

    const stillExists = filteredSanatoria.some(
        item => String(item.provider_code) === currentSanatoriumCode
    );

    if (currentSanatoriumCode && stillExists) {
        sanatoriumSelect.value = currentSanatoriumCode;
    } else {
        sanatoriumSelect.value = "";
    }
}

function getSelectedSanatorium() {
    const selectedCode = sanatoriumSelect.value;

    if (!selectedCode) {
        return null;
    }

    return sanatoria.find(item => String(item.provider_code) === selectedCode) || null;
}

function syncFiltersFromSelectedSanatorium() {
    const selectedSanatorium = getSelectedSanatorium();

    if (!selectedSanatorium) {
        return;
    }

    const firstCity = splitCities(getConfirmedLocation(selectedSanatorium))[0] || "";

    voivodeshipSelect.value = selectedSanatorium.voivodeship || "";
    fillCitySelect();

    if (firstCity) {
        citySelect.value = firstCity;
    }

    fillSanatoriumSelect();
    sanatoriumSelect.value = String(selectedSanatorium.provider_code);
}

function renderSelectedSanatoriumInfo(item) {
    if (!selectedSanatoriumInfo) {
        return;
    }

    if (!item) {
        selectedSanatoriumInfo.textContent =
            "Możesz najpierw wybrać województwo i miejscowość albo od razu wybrać sanatorium z listy.";
        return;
    }

    const name = getSanatoriumName(item);
    const city = getConfirmedLocation(item) || "brak potwierdzonej miejscowości";
    const voivodeship = item.voivodeship || "brak województwa";

    selectedSanatoriumInfo.innerHTML = `
    <strong>${name}</strong><br>
    Miejscowość: ${city}<br>
    Województwo: ${voivodeship}
  `;
}

function getUniqueRooms(fees) {
    const rooms = new Map();

    fees.forEach(item => {
        const roomTypeId = item.room_type_id || item.room_type;
        const roomTypeName = item.room_type || item.room_type_id;

        if (roomTypeId && roomTypeName) {
            rooms.set(String(roomTypeId), roomTypeName);
        }
    });

    return [...rooms.entries()].map(([id, name]) => ({ id, name }));
}

function fillRoomSelect() {
    const rooms = getUniqueRooms(patientFees);

    roomSelect.innerHTML = "";

    rooms.forEach(room => {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = room.name;
        roomSelect.appendChild(option);
    });
}

function findPatientFee(season, roomTypeId) {
    return patientFees.find(item => {
        const itemRoomId = String(item.room_type_id || item.room_type || "");
        return item.season === season && itemRoomId === String(roomTypeId);
    });
}

function setText(element, value) {
    if (element) {
        element.textContent = value;
    }
}

function updateStayDaysPreview() {
    const stayConfig = getStayConfig();

    let nfzDaysText = "";
    let privateDaysText = "";

    if (stayConfig.days === 0) {
        nfzDaysText = "6–18 dni";
        privateDaysText = "—";
    } else {
        nfzDaysText = `${stayConfig.days} dni`;
        privateDaysText = `${stayConfig.days} dni`;
    }

    setText(stayDaysPreview, nfzDaysText);
    setText(nfzStayDaysResult, nfzDaysText);
    setText(privateStayDaysResult, privateDaysText);
}

function getPrivateSeasonKey() {
    return seasonSelect.value === "high" ? "high" : "low";
}

function getPrivateSeasonLabel() {
    return seasonSelect.value === "high" ? "sezon wysoki" : "sezon niski";
}

function getPrivateVoivodeship(selectedSanatorium) {
    if (selectedSanatorium?.voivodeship) {
        return selectedSanatorium.voivodeship;
    }

    if (voivodeshipSelect.value) {
        return voivodeshipSelect.value;
    }

    if (citySelect.value) {
        const sanatoriumFromCity = sanatoria.find(item => {
            const cityList = splitCities(getConfirmedLocation(item));
            return cityList.includes(citySelect.value) && item.voivodeship;
        });

        if (sanatoriumFromCity?.voivodeship) {
            return sanatoriumFromCity.voivodeship;
        }
    }

    return "POLSKA";
}

function getPrivateScopeText(voivodeship) {
    if (!voivodeship || voivodeship === "POLSKA") {
        return "Średnia z całej Polski dla pobytów prywatnych";
    }

    return `Średnia z woj. ${voivodeship} dla pobytów prywatnych`;
}

function updatePrivateResultLabels(privatePriceInfo) {
    const scopeText = privatePriceInfo
        ? getPrivateScopeText(privatePriceInfo.voivodeship)
        : "Średnia dla pobytów prywatnych";

    setText(privateDailyLabel, scopeText);
    setText(privateTotalLabel, scopeText);
}

function getPrivatePriceInfo(days, selectedSanatorium) {
    if (!privatePriceSummary || !privatePriceSummary.prices || days === 0) {
        return null;
    }

    const seasonKey = getPrivateSeasonKey();
    const selectedVoivodeship = getPrivateVoivodeship(selectedSanatorium);

    let voivodeshipUsed = selectedVoivodeship;
    let seasonData = privatePriceSummary.prices?.[selectedVoivodeship]?.[seasonKey];

    if (!seasonData || !seasonData.average_price_per_day_pln) {
        voivodeshipUsed = "POLSKA";
        seasonData = privatePriceSummary.prices?.POLSKA?.[seasonKey];
    }

    if (!seasonData || !seasonData.average_price_per_day_pln) {
        return null;
    }

    const averagePerDay = Number(seasonData.average_price_per_day_pln);
    const total = averagePerDay * days;

    return {
        voivodeship: voivodeshipUsed,
        seasonLabel: getPrivateSeasonLabel(),
        averagePerDay,
        total,
        sampleSize: seasonData.sample_size || 0
    };
}

function getSelectedRoomLabel() {
    const selectedOption = roomSelect.options[roomSelect.selectedIndex];

    if (!selectedOption) {
        return "—";
    }

    return selectedOption.textContent || "—";
}

function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function findTwoPersonPatientFee(season) {
    const feesForSeason = patientFees.filter(item => item.season === season);

    const preferredFee = feesForSeason.find(item => {
        const roomText = normalizeText(item.room_type || item.room_type_id || "");

        return (
            (roomText.includes("dwuosobow") || roomText.includes("2-os")) &&
            (
                roomText.includes("pelnym wezlem") ||
                roomText.includes("pełnym węzłem") ||
                roomText.includes("pelny") ||
                roomText.includes("pełny")
            )
        );
    });

    if (preferredFee) {
        return preferredFee;
    }

    return feesForSeason.find(item => {
        const roomText = normalizeText(item.room_type || item.room_type_id || "");
        return roomText.includes("dwuosobow") || roomText.includes("2-os");
    }) || null;
}

function getComparisonNfzTotalValue(stayConfig, days, nfzDailyRate) {
    if (days === 0 || !hasNumber(nfzDailyRate)) {
        return null;
    }

    const nfzTotalForComparison = Number(nfzDailyRate) * days;

    if (!stayConfig.patientPays) {
        return nfzTotalForComparison;
    }

    const twoPersonFee = findTwoPersonPatientFee(seasonSelect.value);

    if (!twoPersonFee || !hasNumber(twoPersonFee.daily_fee_pln)) {
        return null;
    }

    const patientTotalForTwoPersonRoom = Number(twoPersonFee.daily_fee_pln) * days;

    return nfzTotalForComparison + patientTotalForTwoPersonRoom;
}

function updateComparisonBox(nfzTotalValue, privateTotalValue) {
    if (!comparisonBox || !comparisonValue || !comparisonText) {
        return;
    }

    comparisonBox.classList.remove("more-private", "more-nfz", "same-price");

    if (!hasNumber(nfzTotalValue) || !hasNumber(privateTotalValue)) {
        setText(comparisonValue, "—");
        setText(
            comparisonText,
            "Brakuje danych do porównania wartości pobytu NFZ dla pokoju 2-osobowego ze średnią ceną prywatną."
        );
        return;
    }

    const difference = Number(privateTotalValue) - Number(nfzTotalValue);
    const absDifference = Math.abs(difference);

    setText(comparisonValue, formatPLN(absDifference));

    if (difference > 0) {
        comparisonBox.classList.add("more-private");
        setText(
            comparisonText,
            `Dla pobytu w pokojach 2-osobowym prywatnie wychodzi średnio o ${formatPLN(absDifference)} więcej niż  z NFZ.`
        );
        return;
    }

    if (difference < 0) {
        comparisonBox.classList.add("more-nfz");
        setText(
            comparisonText,
            `Szacunkowa wartość pobytu NFZ liczona dla pokoju 2-osobowego jest o ${formatPLN(absDifference)} wyższa niż średnia cena prywatna dla pokoju 2-osobowego.`
        );
        return;
    }

    comparisonBox.classList.add("same-price");
    setText(
        comparisonText,
        "Średnia cena prywatna i szacunkowa wartość pobytu NFZ dla pokoju 2-osobowego są na tym samym poziomie."
    );
}

function getSourceField(item, possibleNames) {
    for (const name of possibleNames) {
        if (item[name] !== null && item[name] !== undefined && item[name] !== "") {
            return item[name];
        }
    }

    return "";
}

function normalizeSourceText(value) {
    return String(value || "").trim();
}

function getPrivateSourceVoivodeship(item) {
    return normalizeSourceText(
        getSourceField(item, [
            "voivodeship",
            "wojewodztwo",
            "województwo",
            "region"
        ])
    );
}

function getPrivateSourceSeasonKey(item) {
    const rawSeason = normalizeText(
        getSourceField(item, [
            "season",
            "season_key",
            "sezon",
            "private_season"
        ])
    );

    if (!rawSeason) {
        return "";
    }

    if (
        rawSeason.includes("high") ||
        rawSeason.includes("wysoki") ||
        rawSeason.includes("maj") ||
        rawSeason.includes("wrzes")
    ) {
        return "high";
    }

    if (
        rawSeason.includes("low") ||
        rawSeason.includes("niski") ||
        rawSeason.includes("pazdzier") ||
        rawSeason.includes("kwiecien")
    ) {
        return "low";
    }

    return "";
}

function normalizePrivateSource(item) {
    const name = normalizeSourceText(
        getSourceField(item, [
            "sanatorium_name",
            "name",
            "object_name",
            "provider_name",
            "nazwa",
            "osrodek",
            "ośrodek"
        ])
    );

    const city = normalizeSourceText(
        getSourceField(item, [
            "city",
            "sanatorium_city",
            "miejscowosc",
            "miejscowość"
        ])
    );

    const voivodeship = getPrivateSourceVoivodeship(item);

    const selectedSeasonKey = getPrivateSeasonKey();

    const price = selectedSeasonKey === "high"
        ? getSourceField(item, [
            "high_season_price_per_day_pln",
            "reference_price_per_day_pln",
            "price_per_day_pln",
            "average_price_per_day_pln",
            "daily_price_pln",
            "price_pln",
            "cena_za_dobe",
            "cena_doba"
        ])
        : getSourceField(item, [
            "low_season_price_per_day_pln",
            "reference_price_per_day_pln",
            "price_per_day_pln",
            "average_price_per_day_pln",
            "daily_price_pln",
            "price_pln",
            "cena_za_dobe",
            "cena_doba"
        ]);

    const url = normalizeSourceText(
        getSourceField(item, [
            "source_url",
            "url",
            "link",
            "source"
        ])
    );

    return {
        name: name || "Ośrodek bez nazwy",
        city,
        voivodeship,
        price,
        url,
        seasonKey: getPrivateSourceSeasonKey(item)
    };
}

function renderPrivateSourcesList(sources) {
    if (!privateSourcesList || !togglePrivateSourcesButton) {
        return;
    }

    privateSourcesList.innerHTML = "";

    const visibleSources = showAllPrivateSources
        ? sources
        : sources.slice(0, 8);

    visibleSources.forEach(source => {
        const li = document.createElement("li");

        li.textContent = [source.name, source.city]
            .filter(Boolean)
            .join(" — ");

        privateSourcesList.appendChild(li);
    });

    if (sources.length <= 8) {
        togglePrivateSourcesButton.style.display = "none";
        return;
    }

    togglePrivateSourcesButton.style.display = "inline-flex";
    togglePrivateSourcesButton.textContent = showAllPrivateSources
        ? "Pokaż krótszą listę"
        : `Pokaż całą listę źródeł… (${sources.length})`;
}

function renderPrivateSources(privatePriceInfo) {
    if (!privateSourcesDetails || !privateSourcesList || !privateSourcesIntro) {
        return;
    }

    privateSourcesList.innerHTML = "";

    if (!privatePriceSources || privatePriceSources.length === 0) {
        privateSourcesIntro.textContent =
            "Brak osobnego pliku ze źródłami cen prywatnych.";
        return;
    }

    const selectedVoivodeship = privatePriceInfo?.voivodeship || "POLSKA";
    const selectedSeasonKey = getPrivateSeasonKey();

    let normalizedSources = privatePriceSources.map(normalizePrivateSource);

    let filteredSources = normalizedSources.filter(source => {
        const matchesVoivodeship =
            selectedVoivodeship === "POLSKA" ||
            !source.voivodeship ||
            source.voivodeship === selectedVoivodeship;

        const matchesSeason =
            !source.seasonKey || source.seasonKey === selectedSeasonKey;

        return matchesVoivodeship && matchesSeason;
    });

    if (filteredSources.length === 0) {
        filteredSources = normalizedSources;
    }

    const uniqueSources = [];
    const seen = new Set();

    filteredSources.forEach(source => {
        const key = `${source.name}|${source.city}|${source.voivodeship}`;

        if (!seen.has(key)) {
            seen.add(key);
            uniqueSources.push(source);
        }
    });

    privateSourcesIntro.textContent =
        selectedVoivodeship === "POLSKA"
            ? "Średnia cena prywatna jest liczona na podstawie zebranych cenników pobytów prywatnych z różnych województw."
            : `Średnia cena prywatna jest liczona na podstawie zebranych cenników pobytów prywatnych dla woj. ${selectedVoivodeship}.`;

    lastPrivateSourcesToRender = uniqueSources;
    showAllPrivateSources = false;
    renderPrivateSourcesList(lastPrivateSourcesToRender);

    if (uniqueSources.length > 30) {
        const li = document.createElement("li");
        li.textContent = `…oraz ${uniqueSources.length - 30} kolejnych pozycji.`;
        privateSourcesList.appendChild(li);
    }
}

function calculateFee() {
    const stayConfig = getStayConfig();
    const days = stayConfig.days;
    const patientPays = stayConfig.patientPays;

    updateStayDaysPreview();

    const season = seasonSelect.value;
    const roomTypeId = roomSelect.value;
    const selectedSanatorium = getSelectedSanatorium();
    const roomLabel = getSelectedRoomLabel();

    renderSelectedSanatoriumInfo(selectedSanatorium);

    if (days === 0) {
        setText(patientTotalResult, "0,00 zł");
        setText(nfzDailyResult, "—");
        setText(nfzTotalResult, "—");
        setText(totalStayValueResult, "—");
        setText(privateDailyResult, "—");
        setText(privateTotalResult, "—");

        setText(stayTypeDetails, stayConfig.label);
        setText(roomTypeDetails, roomLabel);

        setText(daysDetails, "6–18 dni, bez noclegu");
        setText(dailyFeeDetails, "0,00 zł");
        setText(patientTotalDetails, "0,00 zł");
        setText(nfzDailyDetails, "—");
        setText(nfzTotalDetails, "—");
        setText(totalStayValueDetails, "—");
        setText(privateDailyDetails, "—");
        setText(privateTotalDetails, "—");

        updatePrivateResultLabels(null);
        updateComparisonBox(null, null);
        renderPrivateSources(null);
        return;
    }

    const fee = patientPays ? findPatientFee(season, roomTypeId) : null;
    const dailyPatientFee = patientPays && fee ? Number(fee.daily_fee_pln) : 0;
    const patientTotal = dailyPatientFee * days;

    const nfzDailyRate = getNfzAverageDayPrice(stayConfig, selectedSanatorium);
    const hasNfzDailyRate = hasNumber(nfzDailyRate);
    const nfzScopeText = getNfzScopeText(selectedSanatorium);

    const nfzTotal = hasNfzDailyRate
        ? Number(nfzDailyRate) * days
        : null;

    const totalStayValue = hasNfzDailyRate
        ? nfzTotal + patientTotal
        : null;

    const privatePriceInfo = getPrivatePriceInfo(days, selectedSanatorium);
    updatePrivateResultLabels(privatePriceInfo);
    renderPrivateSources(privatePriceInfo);

    setText(patientTotalResult, formatPLN(patientTotal));
    setText(nfzDailyResult, hasNfzDailyRate ? formatPLN(nfzDailyRate) : "—");
    setText(nfzTotalResult, hasNfzDailyRate ? formatPLN(nfzTotal) : "—");
    setText(totalStayValueResult, hasNfzDailyRate ? formatPLN(totalStayValue) : "—");

    setText(
        privateDailyResult,
        privatePriceInfo ? formatPLN(privatePriceInfo.averagePerDay) : "—"
    );

    setText(
        privateTotalResult,
        privatePriceInfo ? formatPLN(privatePriceInfo.total) : "—"
    );

    setText(stayTypeDetails, stayConfig.label);
    setText(roomTypeDetails, roomLabel);
    setText(daysDetails, `${days} dni`);
    setText(dailyFeeDetails, formatPLN(dailyPatientFee));
    setText(patientTotalDetails, formatPLN(patientTotal));
    setText(nfzDailyDetails, hasNfzDailyRate ? formatPLN(nfzDailyRate) : "—");
    setText(nfzTotalDetails, hasNfzDailyRate ? formatPLN(nfzTotal) : "—");
    setText(totalStayValueDetails, hasNfzDailyRate ? formatPLN(totalStayValue) : "—");

    const nfzDailyRow = nfzDailyDetails?.closest("tr");
    const nfzDailyHowCalculated = nfzDailyRow?.querySelector("td:nth-child(3)");

    setText(
        nfzDailyHowCalculated,
        hasNfzDailyRate
            ? nfzScopeText
            : "Brak danych NFZ dla wybranego rodzaju pobytu."
    );

    setText(
        privateDailyDetails,
        privatePriceInfo ? formatPLN(privatePriceInfo.averagePerDay) : "—"
    );

    setText(
        privateTotalDetails,
        privatePriceInfo ? formatPLN(privatePriceInfo.total) : "—"
    );

    const comparisonNfzTotalValue = getComparisonNfzTotalValue(
        stayConfig,
        days,
        nfzDailyRate
    );

    updateComparisonBox(
        comparisonNfzTotalValue,
        privatePriceInfo ? privatePriceInfo.total : null
    );
}

async function fetchJson(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Nie udało się wczytać pliku ${path}`);
    }

    return response.json();
}

async function fetchOptionalJson(path) {
    try {
        return await fetchJson(path);
    } catch (error) {
        console.warn(`Nie udało się wczytać opcjonalnego pliku ${path}`, error);
        return [];
    }
}
function getDefaultSeasonForToday() {
    const today = new Date();
    const month = today.getMonth() + 1; // 1–12
    const day = today.getDate();

    // Sezon wysoki NFZ: 1 maja – 30 września
    const isHighSeason =
        (month > 5 && month < 9) ||
        (month === 5 && day >= 1) ||
        (month === 9 && day <= 30);

    return isHighSeason ? "high" : "low";
}

function setDefaultRoomType() {
    if (!roomSelect || !roomSelect.options.length) {
        return;
    }

    const options = [...roomSelect.options];

    const scoredOptions = options.map(option => {
        const text = normalizeText(`${option.textContent} ${option.value}`);

        let score = 0;

        // pokój 2-osobowy / dwuosobowy
        if (
            text.includes("dwuosobow") ||
            text.includes("2-os") ||
            text.includes("2 os") ||
            text.includes("2os") ||
            text.includes("ii")
        ) {
            score += 10;
        }

        // pełny węzeł
        if (
            text.includes("pelnym wezlem") ||
            text.includes("pelny wezel") ||
            text.includes("pelny") ||
            text.includes("wezel")
        ) {
            score += 8;
        }

        // higieniczno-sanitarny / sanitarny
        if (
            text.includes("higien") ||
            text.includes("sanitarn")
        ) {
            score += 4;
        }

        // unikamy opcji bez węzła
        if (
            text.includes("bez wezla") ||
            text.includes("bez pelnego") ||
            text.includes("wspolny") ||
            text.includes("wspolnym")
        ) {
            score -= 20;
        }

        // unikamy jedynek, jeśli przypadkiem zawierają podobne słowa
        if (
            text.includes("jednoosobow") ||
            text.includes("1-os") ||
            text.includes("1 os") ||
            text.includes("1os")
        ) {
            score -= 10;
        }

        return { option, score, text };
    });

    scoredOptions.sort((a, b) => b.score - a.score);

    const best = scoredOptions[0];

    if (best && best.score > 0) {
        roomSelect.value = best.option.value;
    }

    // pomocniczo do sprawdzenia w konsoli, potem możesz usunąć
    console.log("Domyślny pokój:", best);
}

async function loadData() {
    try {
        const [
            sanatoriaData,
            locationsData,
            patientFeesData,
            privatePriceData,
            privateSourcesData
        ] = await Promise.all([
            fetchJson("data/sanatoria_nfz_prices.json"),
            fetchJson("data/sanatoria_locations_manual.json"),
            fetchJson("data/patient_fees.json"),
            fetchJson("data/private_sanatorium_price_summary.json"),
            fetchOptionalJson("data/private_sanatorium_price_sources.json")
        ]);

        sanatoria = mergeLocations(sanatoriaData, locationsData);
        patientFees = patientFeesData;
        privatePriceSummary = privatePriceData;

        privatePriceSources = Array.isArray(privateSourcesData)
            ? privateSourcesData
            : (
                privateSourcesData.entries ||
                privateSourcesData.sources ||
                privateSourcesData.items ||
                []
            );

        fillVoivodeshipSelect();
        fillCitySelect();
        fillSanatoriumSelect();
        fillStayTypeSelect();
        fillRoomSelect();

        seasonSelect.value = getDefaultSeasonForToday();
        setDefaultRoomType();

        updateStayDaysPreview();
        calculateFee();
    } catch (error) {
        console.error(error);

        if (selectedSanatoriumInfo) {
            selectedSanatoriumInfo.textContent = `Błąd wczytywania danych: ${error.message}`;
        }
    }
}

voivodeshipSelect.addEventListener("change", () => {
    fillCitySelect();
    fillSanatoriumSelect();
    fillStayTypeSelect();
    calculateFee();
});

citySelect.addEventListener("change", () => {
    fillSanatoriumSelect();
    fillStayTypeSelect();
    calculateFee();
});

sanatoriumSelect.addEventListener("change", () => {
    syncFiltersFromSelectedSanatorium();
    fillStayTypeSelect();
    calculateFee();
});

stayTypeSelect.addEventListener("change", calculateFee);
seasonSelect.addEventListener("change", calculateFee);
roomSelect.addEventListener("change", calculateFee);

if (togglePrivateSourcesButton) {
    togglePrivateSourcesButton.addEventListener("click", () => {
        showAllPrivateSources = !showAllPrivateSources;
        renderPrivateSourcesList(lastPrivateSourcesToRender);
    });
}


loadData();